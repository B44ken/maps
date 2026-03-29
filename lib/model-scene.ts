import { discoverModel } from './model'
import { buildModelTextureUrl, fetchDecodedNodeData, type DecodedMesh } from './model-texture'
import type { ModelPacket, ModelSceneMesh, ModelSceneResponse } from './types'

const sortNodes = (nodes: ModelPacket[]) =>
  [...nodes].sort((left, right) => right.id.length - left.id.length || left.id.localeCompare(right.id))

const selectDeepestNodes = (nodes: ModelPacket[]) => {
  const sorted = sortNodes(nodes)
  const depth = sorted[0]?.id.length
  return depth === undefined ? [] : sorted.filter(node => node.id.length === depth)
}

const radians = (value: number) => (value * Math.PI) / 180

const getLocalBasis = (lat: number, lng: number) => {
  const sinLat = Math.sin(radians(lat)), cosLat = Math.cos(radians(lat))
  const sinLng = Math.sin(radians(lng)), cosLng = Math.cos(radians(lng))

  return {
    east: [-sinLng, cosLng, 0],
    north: [-sinLat * cosLng, -sinLat * sinLng, cosLat],
    up: [cosLat * cosLng, cosLat * sinLng, sinLat]
  }
}

const dot = (a: ArrayLike<number>, b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

const toLocalPoint = (point: ArrayLike<number>, center: number[], basis: ReturnType<typeof getLocalBasis>) => {
  const delta = [point[0] - center[0], point[1] - center[1], point[2] - center[2]]
  return [dot(delta, basis.east), dot(delta, basis.up), -dot(delta, basis.north)]
}

const transformPosition = (M: ArrayLike<number>, vertices: Uint8Array, i: number) => {
  const [x, y, z] = [vertices[i * 8], vertices[i * 8 + 1], vertices[i * 8 + 2]]

  return [x * M[0] + y * M[4] + z * M[8] + M[12],
  x * M[1] + y * M[5] + z * M[9] + M[13],
  x * M[2] + y * M[6] + z * M[10] + M[14]]
}

const toBase64 = (view: ArrayBufferView) => Buffer.from(view.buffer, view.byteOffset, view.byteLength).toString('base64')

const getTriangles = (verts: Uint8Array, indices: Uint16Array, layerBounds: Uint32Array) => {
  const triangles: number[] = []
  const limit = Math.min(indices.length - 2, layerBounds[3] ?? indices.length - 2)

  for (let index = 0; index < limit; index += 1) {
    const [a, b, c] = [indices[index], indices[index + 1], indices[index + 2]]
    if (verts[a * 8 + 3] !== verts[b * 8 + 3] || verts[b * 8 + 3] !== verts[c * 8 + 3]) continue
    triangles.push(...(index & 1 ? [a, c, b] : [a, b, c]))
  }

  return triangles
}

const decodeUvs = (vertices: Uint8Array, uvOffsetAndScale: Float32Array) => {
  const uvs = new Float32Array((vertices.length / 8) * 2)

  for (let index = 0; index < vertices.length / 8; index += 1) {
    const offset = index * 8
    const u = vertices[offset + 5] * 256 + vertices[offset + 4]
    const v = vertices[offset + 7] * 256 + vertices[offset + 6]

    uvs[index * 2] = (u + uvOffsetAndScale[0]) * uvOffsetAndScale[2]
    uvs[index * 2 + 1] = (v + uvOffsetAndScale[1]) * uvOffsetAndScale[3]
  }

  return uvs
}

const decodeMesh = (
  packet: ModelPacket, meshI: number, matrix: ArrayLike<number>,
  mesh: DecodedMesh, center: number[], basis: ReturnType<typeof getLocalBasis>) => {
  if (!mesh.vertices?.length || !mesh.indices?.length || !mesh.layerBounds?.length)
    return

  const vertN = mesh.vertices.length / 8
  const pos = new Float32Array(vertN * 3)

  for (let i = 0; i < vertN; i += 1) {
    const point = toLocalPoint(transformPosition(matrix, mesh.vertices, i), center, basis)
    pos[i * 3] = point[0]
    pos[i*3 + 1] = point[1]
    pos[i*3 + 2] = point[2]
  }

  const tris = getTriangles(mesh.vertices, mesh.indices, mesh.layerBounds)

  if (!tris.length)
    return

  const result: ModelSceneMesh = { id: `${packet.id}:${meshI}`, positions: toBase64(pos), indices: toBase64(Uint32Array.from(tris)) }

  if (mesh.uvOffsetAndScale)
    result.uvs = toBase64(decodeUvs(mesh.vertices, mesh.uvOffsetAndScale))

  if (mesh.texture)
    result.texture = { url: buildModelTextureUrl(packet, meshI) }

  return result
}

export const discoverModelScene = async (lat: number, lng: number, meters: number): Promise<ModelSceneResponse> => {
  const model = await discoverModel(lat, lng, meters)
  const nodes = selectDeepestNodes(model.nodes)
  const decoded = await Promise.all(nodes.map(async p => ({ packet: p, node: await fetchDecodedNodeData(p) })))
  const center = decoded.length
    ? decoded.reduce((sum, { node }) => {
      const matrix = node.matrixGlobeFromMesh ?? []
      sum[0] += matrix[12] ?? 0
      sum[1] += matrix[13] ?? 0
      sum[2] += matrix[14] ?? 0
      return sum
    }, [0, 0, 0]) : [0, 0, 0]

  if (decoded.length) {
    center[0] /= decoded.length
    center[1] /= decoded.length
    center[2] /= decoded.length
  }

  const basis = getLocalBasis(lat, lng)
  const meshes = decoded.flatMap(({ packet, node }) =>
    (node.meshes ?? []).map((m, i) => decodeMesh(packet, i, node.matrixGlobeFromMesh ?? [], m, center, basis)).filter(m => !!m))

  return { meshes, query: { lat, lng, meters }, nodes: { total: model.nodes.length, rendered: nodes.length } }
}

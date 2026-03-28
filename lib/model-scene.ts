import { discoverModel } from './model'
import { buildModelTextureUrl, fetchDecodedNodeData, type DecodedMesh } from './model-texture'
import type { ModelPacket, ModelSceneMesh, ModelSceneResponse } from './types'

const sortNodes = (nodes: ModelPacket[]) =>
  [...nodes].sort(
    (left, right) => right.id.length - left.id.length || left.id.localeCompare(right.id)
  )

const selectDeepestNodes = (nodes: ModelPacket[]) => {
  const sorted = sortNodes(nodes)
  const depth = sorted[0]?.id.length
  return depth === undefined ? [] : sorted.filter(node => node.id.length === depth)
}

const toRadians = (value: number) => (value * Math.PI) / 180

const getLocalBasis = (lat: number, lng: number) => {
  const latitude = toRadians(lat)
  const longitude = toRadians(lng)
  const sinLat = Math.sin(latitude)
  const cosLat = Math.cos(latitude)
  const sinLng = Math.sin(longitude)
  const cosLng = Math.cos(longitude)

  return {
    east: [-sinLng, cosLng, 0],
    north: [-sinLat * cosLng, -sinLat * sinLng, cosLat],
    up: [cosLat * cosLng, cosLat * sinLng, sinLat]
  }
}

const dot = (left: ArrayLike<number>, right: number[]) =>
  left[0] * right[0] + left[1] * right[1] + left[2] * right[2]

const toLocalPoint = (
  point: ArrayLike<number>,
  center: number[],
  basis: ReturnType<typeof getLocalBasis>
) => {
  const delta = [point[0] - center[0], point[1] - center[1], point[2] - center[2]]

  return [dot(delta, basis.east), dot(delta, basis.up), -dot(delta, basis.north)]
}

const transformPosition = (matrix: ArrayLike<number>, vertices: Uint8Array, index: number) => {
  const offset = index * 8
  const x = vertices[offset]
  const y = vertices[offset + 1]
  const z = vertices[offset + 2]

  return [
    x * matrix[0] + y * matrix[4] + z * matrix[8] + matrix[12],
    x * matrix[1] + y * matrix[5] + z * matrix[9] + matrix[13],
    x * matrix[2] + y * matrix[6] + z * matrix[10] + matrix[14]
  ]
}

const toBase64 = (view: ArrayBufferView) =>
  Buffer.from(view.buffer, view.byteOffset, view.byteLength).toString('base64')

const getTriangles = (vertices: Uint8Array, indices: Uint16Array, layerBounds: Uint32Array) => {
  const triangles: number[] = []
  const limit = Math.min(indices.length - 2, layerBounds[3] ?? indices.length - 2)

  for (let index = 0; index < limit; index += 1) {
    const a = indices[index]
    const b = indices[index + 1]
    const c = indices[index + 2]

    if (a === b || a === c || b === c)
      continue

    if (
      vertices[a * 8 + 3] !== vertices[b * 8 + 3] ||
      vertices[b * 8 + 3] !== vertices[c * 8 + 3]
    )
      continue

    if (index & 1)
      triangles.push(a, c, b)
    else
      triangles.push(a, b, c)
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
  packet: ModelPacket,
  meshIndex: number,
  matrix: ArrayLike<number>,
  mesh: DecodedMesh,
  center: number[],
  basis: ReturnType<typeof getLocalBasis>
) => {
  if (!mesh.vertices?.length || !mesh.indices?.length || !mesh.layerBounds?.length)
    return

  const vertexCount = mesh.vertices.length / 8
  const positions = new Float32Array(vertexCount * 3)

  for (let index = 0; index < vertexCount; index += 1) {
    const point = toLocalPoint(transformPosition(matrix, mesh.vertices, index), center, basis)
    const offset = index * 3
    positions[offset] = point[0]
    positions[offset + 1] = point[1]
    positions[offset + 2] = point[2]
  }

  const triangles = getTriangles(mesh.vertices, mesh.indices, mesh.layerBounds)

  if (!triangles.length)
    return

  const result: ModelSceneMesh = {
    id: `${packet.id}:${meshIndex}`,
    positions: toBase64(positions),
    indices: toBase64(Uint32Array.from(triangles))
  }

  if (mesh.uvOffsetAndScale)
    result.uvs = toBase64(decodeUvs(mesh.vertices, mesh.uvOffsetAndScale))

  if (mesh.texture)
    result.texture = { url: buildModelTextureUrl(packet, meshIndex) }

  return result
}

export const discoverModelScene = async (
  lat: number,
  lng: number,
  meters = 295
): Promise<ModelSceneResponse> => {
  const model = await discoverModel(lat, lng, meters)
  const nodes = selectDeepestNodes(model.nodes)
  const decoded = await Promise.all(
    nodes.map(async packet => ({ packet, node: await fetchDecodedNodeData(packet) }))
  )
  const center = decoded.length
    ? decoded.reduce(
        (sum, { node }) => {
          const matrix = node.matrixGlobeFromMesh ?? []
          sum[0] += matrix[12] ?? 0
          sum[1] += matrix[13] ?? 0
          sum[2] += matrix[14] ?? 0
          return sum
        },
        [0, 0, 0]
      )
    : [0, 0, 0]

  if (decoded.length) {
    center[0] /= decoded.length
    center[1] /= decoded.length
    center[2] /= decoded.length
  }

  const basis = getLocalBasis(lat, lng)
  const meshes = decoded.flatMap(({ packet, node }) =>
    (node.meshes ?? [])
      .map((mesh, index) =>
        decodeMesh(packet, index, node.matrixGlobeFromMesh ?? [], mesh, center, basis)
      )
      .filter((mesh): mesh is ModelSceneMesh => !!mesh)
  )

  return {
    query: { lat, lng, meters },
    nodes: {
      total: model.nodes.length,
      rendered: nodes.length
    },
    meshes
  }
}

import { discoverModel } from './model'
import {
  buildModelTextureUrl,
  fetchDecodedNodeData,
  type DecodedMesh,
  type DecodedNodeData,
  type DecodedTexture
} from './model-texture'
import type {
  ModelPacket,
  ModelSceneMesh,
  ModelSceneResponse,
  ModelSceneTexture
} from './types'
const maxConcurrentNodes = 16

const sortRenderableNodes = (nodes: ModelPacket[]) =>
  [...nodes].sort(
    (left, right) => right.id.length - left.id.length || left.id.localeCompare(right.id)
  )

const selectDeepestNodes = (nodes: ModelPacket[]) => {
  const sorted = sortRenderableNodes(nodes)
  const maxDepth = sorted[0]?.id.length

  return maxDepth === undefined
    ? []
    : sorted.filter(packet => packet.id.length === maxDepth)
}

const selectRenderableNodes = (nodes: ModelPacket[], includeAncestors: boolean) =>
  includeAncestors ? sortRenderableNodes(nodes) : selectDeepestNodes(nodes)

const mapLimit = async <T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>
) => {
  const results = new Array<R>(items.length)
  let nextIndex = 0

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex++
        results[index] = await mapper(items[index], index)
      }
    })
  )

  return results
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

const normalize = (value: number[]) => {
  const length = Math.hypot(value[0], value[1], value[2]) || 1
  return [value[0] / length, value[1] / length, value[2] / length]
}

const toLocalPoint = (
  point: ArrayLike<number>,
  center: number[],
  basis: ReturnType<typeof getLocalBasis>
) => {
  const delta = [
    point[0] - center[0],
    point[1] - center[1],
    point[2] - center[2]
  ]

  return [
    dot(delta, basis.east),
    dot(delta, basis.up),
    -dot(delta, basis.north)
  ]
}

const toLocalDirection = (
  value: ArrayLike<number>,
  basis: ReturnType<typeof getLocalBasis>
) =>
  normalize([dot(value, basis.east), dot(value, basis.up), -dot(value, basis.north)])

const transformPosition = (
  matrix: ArrayLike<number>,
  vertices: Uint8Array,
  index: number
) => {
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

const transformNormal = (
  matrix: ArrayLike<number>,
  normals: Uint8Array,
  index: number,
  basis: ReturnType<typeof getLocalBasis>
) => {
  const offset = index * 4
  const x = normals[offset] - 127
  const y = normals[offset + 1] - 127
  const z = normals[offset + 2] - 127

  return toLocalDirection(
    [
      x * matrix[0] + y * matrix[4] + z * matrix[8],
      x * matrix[1] + y * matrix[5] + z * matrix[9],
      x * matrix[2] + y * matrix[6] + z * matrix[10]
    ],
    basis
  )
}

const toBase64 = (view: ArrayBufferView) =>
  Buffer.from(view.buffer, view.byteOffset, view.byteLength).toString('base64')

const getTriangles = (
  vertices: Uint8Array,
  indices: Uint16Array,
  layerBounds: Uint32Array
) => {
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

const toTexture = (
  packet: ModelPacket,
  meshIndex: number,
  texture?: DecodedTexture | null
): ModelSceneTexture | undefined => {
  if (!texture)
    return

  return {
    kind: 'url',
    width: texture.width,
    height: texture.height,
    flipY: false,
    url: buildModelTextureUrl(packet, meshIndex)
  }
}

const decodeUvs = (
  vertices: Uint8Array,
  uvOffsetAndScale: Float32Array,
  texture?: DecodedTexture | null
) => {
  const uvs = new Float32Array((vertices.length / 8) * 2)

  for (let index = 0; index < vertices.length / 8; index += 1) {
    const offset = index * 8
    const u = vertices[offset + 5] * 256 + vertices[offset + 4]
    let v = vertices[offset + 7] * 256 + vertices[offset + 6]

    uvs[index * 2] = (u + uvOffsetAndScale[0]) * uvOffsetAndScale[2]
    v = (v + uvOffsetAndScale[1]) * uvOffsetAndScale[3]
    uvs[index * 2 + 1] = v
  }

  return uvs
}

const decodeMesh = (
  packet: ModelPacket,
  meshIndex: number,
  id: string,
  matrix: ArrayLike<number>,
  mesh: DecodedMesh,
  center: number[],
  basis: ReturnType<typeof getLocalBasis>
) => {
  if (!mesh.vertices?.length || !mesh.indices?.length || !mesh.layerBounds?.length)
    return null

  const vertexCount = mesh.vertices.length / 8
  const positions = new Float32Array(vertexCount * 3)
  const normals =
    mesh.normals?.length === vertexCount * 4 ? new Float32Array(vertexCount * 3) : null

  for (let index = 0; index < vertexCount; index += 1) {
    const point = toLocalPoint(transformPosition(matrix, mesh.vertices, index), center, basis)
    const offset = index * 3
    positions[offset] = point[0]
    positions[offset + 1] = point[1]
    positions[offset + 2] = point[2]

    if (normals) {
      const normal = transformNormal(matrix, mesh.normals!, index, basis)
      normals[offset] = normal[0]
      normals[offset + 1] = normal[1]
      normals[offset + 2] = normal[2]
    }
  }

  const triangles = getTriangles(mesh.vertices, mesh.indices, mesh.layerBounds)

  if (!triangles.length)
    return null

  const result: ModelSceneMesh = {
    id,
    positions: toBase64(positions),
    indices: toBase64(Uint32Array.from(triangles))
  }

  if (normals)
    result.normals = toBase64(normals)

  if (mesh.uvOffsetAndScale)
    result.uvs = toBase64(decodeUvs(mesh.vertices, mesh.uvOffsetAndScale, mesh.texture))

  const texture = toTexture(packet, meshIndex, mesh.texture)

  if (texture)
    result.texture = texture

  return result
}

export const discoverModelScene = async (
  lat: number,
  lng: number,
  meters = 295,
  includeAncestors = false
): Promise<ModelSceneResponse> => {
  const model = await discoverModel(lat, lng, meters)
  const selectedNodes = selectRenderableNodes(model.nodes, includeAncestors)

  const decodedNodes = await mapLimit(selectedNodes, maxConcurrentNodes, async packet => ({
    packet,
    node: await fetchDecodedNodeData(packet)
  }))

  const center =
    decodedNodes.length === 0
      ? [0, 0, 0]
      : decodedNodes.reduce(
          (sum, { node }) => {
            const matrix = node.matrixGlobeFromMesh ?? []
            sum[0] += matrix[12] ?? 0
            sum[1] += matrix[13] ?? 0
            sum[2] += matrix[14] ?? 0
            return sum
          },
          [0, 0, 0]
        )

  if (decodedNodes.length) {
    center[0] /= decodedNodes.length
    center[1] /= decodedNodes.length
    center[2] /= decodedNodes.length
  }

  const basis = getLocalBasis(lat, lng)
  const meshes: ModelSceneMesh[] = []

  for (const { packet, node } of decodedNodes) {
    for (let index = 0; index < (node.meshes?.length ?? 0); index += 1) {
      const mesh = decodeMesh(
        packet,
        index,
        `${packet.id}:${index}`,
        node.matrixGlobeFromMesh ?? [],
        node.meshes![index],
        center,
        basis
      )

      if (mesh)
        meshes.push(mesh)
    }

    for (let index = 0; index < (node.overlaySurfaceMeshes?.length ?? 0); index += 1) {
      const mesh = decodeMesh(
        packet,
        index,
        `${packet.id}:overlay:${index}`,
        node.matrixGlobeFromMesh ?? [],
        node.overlaySurfaceMeshes![index],
        center,
        basis
      )

      if (mesh)
        meshes.push(mesh)
    }

    if (node.waterMesh) {
      const mesh = decodeMesh(
        packet,
        0,
        `${packet.id}:water`,
        node.matrixGlobeFromMesh ?? [],
        node.waterMesh,
        center,
        basis
      )

      if (mesh)
        meshes.push(mesh)
    }
  }

  return {
    query: {
      lat,
      lng,
      meters
    },
    octants: model.octants,
    nodes: {
      total: model.nodes.length,
      rendered: selectedNodes.length
    },
    meshes
  }
}

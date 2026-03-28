import { createHash } from 'crypto'
import sharp from 'sharp'
import { discoverModel } from './model'
import { discoverModelScene } from './model-scene'
import {
  buildModelTextureUrl,
  decodeModelTexture,
  decodeTextureRgba,
  fetchDecodedNodeData,
  type DecodedNodeData
} from './model-texture'
import type { ModelPacket } from './types'

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

const countDepths = (ids: string[]) =>
  ids.reduce<Record<string, number>>((depths, id) => {
    const depth = String(id.length)
    depths[depth] = (depths[depth] ?? 0) + 1
    return depths
  }, {})

const decodeFloat32 = (value: string) => {
  const bytes = Buffer.from(value, 'base64')
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4)
}

const decodeUint32 = (value: string) => {
  const bytes = Buffer.from(value, 'base64')
  return new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4)
}

const getTriangles = (
  vertices: Uint8Array,
  indices: Uint16Array,
  layerBounds: Uint32Array
) => {
  const triangles: number[] = []

  for (let index = 0; index < Math.min(indices.length - 2, layerBounds[3] ?? indices.length - 2); index += 1) {
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

  return Uint32Array.from(triangles)
}

const getUvs = (
  vertices: Uint8Array,
  uvOffsetAndScale: Float32Array
) => {
  const uvs = new Float32Array((vertices.length / 8) * 2)

  for (let index = 0; index < vertices.length / 8; index += 1) {
    const offset = index * 8
    const u = vertices[offset + 5] * 256 + vertices[offset + 4]
    const v = vertices[offset + 7] * 256 + vertices[offset + 6]
    const vt = (v + uvOffsetAndScale[1]) * uvOffsetAndScale[3]

    uvs[index * 2] = (u + uvOffsetAndScale[0]) * uvOffsetAndScale[2]
    uvs[index * 2 + 1] = vt
  }

  return uvs
}

const maxAbsDiff = (left: Float32Array, right: Float32Array) => {
  if (left.length !== right.length)
    return Infinity

  let max = 0

  for (let index = 0; index < left.length; index += 1)
    max = Math.max(max, Math.abs(left[index] - right[index]))

  return max
}

const sameArray = (left: Uint32Array, right: Uint32Array) => {
  if (left.length !== right.length)
    return false

  for (let index = 0; index < left.length; index += 1)
    if (left[index] !== right[index])
      return false

  return true
}

const hash = (value: Uint8Array | Buffer) =>
  createHash('sha256').update(value).digest('hex')

const validateTextureImage = async (
  textureImage: Awaited<ReturnType<typeof decodeModelTexture>>,
  texture: NonNullable<DecodedNodeData['meshes']>[number]['texture']
) => {
  if (!texture || texture.textureFormat !== 6)
    return {
      contentType: textureImage.contentType,
      pixelsMatch: null as boolean | null
    }

  const raw = await sharp(textureImage.buffer).raw().toBuffer()

  return {
    contentType: textureImage.contentType,
    pixelsMatch: Buffer.compare(raw, decodeTextureRgba(texture)) === 0
  }
}

export const validateModelScene = async (
  lat: number,
  lng: number,
  meters = 295
) => {
  const model = await discoverModel(lat, lng, meters)
  const selectedPackets = selectDeepestNodes(model.nodes)

  const scene = await discoverModelScene(lat, lng, meters)
  const maxDepth = Math.max(...model.nodes.map(packet => packet.id.length))
  const selectedDepths = countDepths(selectedPackets.map(packet => packet.id))
  const totalDepths = countDepths(model.nodes.map(packet => packet.id))

  let referencePacket: ModelPacket | null = null
  let referenceNode: DecodedNodeData | null = null

  for (const packet of selectedPackets) {
    const node = await fetchDecodedNodeData(packet)

    if (node.meshes?.length) {
      referencePacket = packet
      referenceNode = node
      break
    }
  }

  if (!referencePacket || !referenceNode)
    return {
      query: { lat, lng, meters },
      lod: {
        maxDepth,
        selectedOnlyMaxDepth: selectedPackets.every(packet => packet.id.length === maxDepth),
        totalDepths,
        selectedDepths
      },
      referenceNode: null
    }

  const referenceMeshes = await Promise.all(
    (referenceNode.meshes ?? []).map(async (mesh, index) => {
      const id = `${referencePacket.id}:${index}`
      const sceneMesh = scene.meshes.find(candidate => candidate.id === id)
      const textureUrl = buildModelTextureUrl(referencePacket, index)
      const triangles =
        mesh.vertices?.length && mesh.indices?.length && mesh.layerBounds?.length
          ? getTriangles(mesh.vertices, mesh.indices, mesh.layerBounds)
          : null
      const uvs =
        mesh.vertices?.length && mesh.uvOffsetAndScale
          ? getUvs(mesh.vertices, mesh.uvOffsetAndScale)
          : null
      const textureImage =
        sceneMesh?.texture && mesh.texture
          ? await decodeModelTexture(referencePacket, index)
          : null
      const textureImageValidation =
        textureImage && mesh.texture
          ? await validateTextureImage(textureImage, mesh.texture)
          : null

      return {
        id,
        rendered: !!sceneMesh,
        textureFormat: mesh.texture?.textureFormat ?? null,
        trianglesMatch: sceneMesh && triangles ? sameArray(decodeUint32(sceneMesh.indices), triangles) : null,
        uvMaxError: sceneMesh?.uvs && uvs ? maxAbsDiff(decodeFloat32(sceneMesh.uvs), uvs) : null,
        textureUrlMatch: sceneMesh?.texture ? sceneMesh.texture.url === textureUrl : null,
        textureFlipYMatch:
          sceneMesh?.texture && mesh.texture
            ? sceneMesh.texture.flipY === false
            : null,
        textureImageHash: textureImage
          ? {
              decoded: hash(textureImage.buffer).slice(0, 16),
              contentType: textureImage.contentType,
              pixelsMatch: textureImageValidation?.pixelsMatch ?? null
            }
          : null
      }
    })
  )

  return {
    query: { lat, lng, meters },
    lod: {
      maxDepth,
      selectedOnlyMaxDepth: selectedPackets.every(packet => packet.id.length === maxDepth),
      totalDepths,
      selectedDepths,
      remainingAtMaxDepth:
        (totalDepths[String(maxDepth)] ?? 0) - (selectedDepths[String(maxDepth)] ?? 0)
    },
    referenceNode: {
      id: referencePacket.id,
      meshes: referenceMeshes
    }
  }
}

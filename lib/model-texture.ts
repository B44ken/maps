import { createRequire } from 'module'

import decodeDXT from 'decode-dxt'
import sharp from 'sharp'

import { fetchGoogleBuffer } from './google'
import type { ModelPacket } from './types'

const require = createRequire(import.meta.url)
const decodeResource = require('./vendor/decode-resource.cjs') as (
  command: number,
  payload: Uint8Array
) => Promise<{ payload: DecodedNodeData }>

const decodeNodeCommand = 3

export type DecodedTexture = {
  bytes?: Uint8Array
  textureFormat: number
  width: number
  height: number
}

export type DecodedMesh = {
  vertices?: Uint8Array
  indices?: Uint16Array
  layerBounds?: Uint32Array
  uvOffsetAndScale?: Float32Array
  normals?: Uint8Array
  texture?: DecodedTexture | null
}

export type DecodedNodeData = {
  matrixGlobeFromMesh?: ArrayLike<number>
  meshes?: DecodedMesh[]
  overlaySurfaceMeshes?: DecodedMesh[]
  waterMesh?: DecodedMesh | null
}

const nodePromises = new Map<string, Promise<DecodedNodeData>>()

const decodeNodeData = async (payload: Uint8Array) =>
  (await decodeResource(decodeNodeCommand, payload)).payload

export const fetchDecodedNodeData = async (packet: ModelPacket) => {
  if (!nodePromises.has(packet.url))
    nodePromises.set(packet.url, fetchGoogleBuffer(packet.url).then(decodeNodeData))

  return nodePromises.get(packet.url)!
}

export const buildModelTextureUrl = (packet: ModelPacket, meshIndex: number) => {
  const params = new URLSearchParams({
    version: String(packet.version),
    textureFormat: String(packet.textureFormat ?? 6)
  })

  if (packet.imageryEpoch !== undefined)
    params.set('imageryEpoch', String(packet.imageryEpoch))

  return `/api/model/texture/${packet.id}/${meshIndex}?${params}`
}

export const decodeTextureRgba = (texture: DecodedTexture) => {
  if (texture.textureFormat !== 6)
    throw new Error(`raw rgba only supported for textureFormat=6, got ${texture.textureFormat}`)

  const bytes = texture.bytes

  if (!bytes)
    throw new Error('missing dxt texture bytes')

  return Buffer.from(
    decodeDXT(
      new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
      texture.width,
      texture.height,
      'dxt1'
    )
  )
}

export const decodeModelTexture = async (packet: ModelPacket, meshIndex: number) => {
  const node = await fetchDecodedNodeData(packet)
  const texture = node.meshes?.[meshIndex]?.texture

  if (!texture)
    throw new Error(`missing texture for ${packet.id}:${meshIndex}`)

  if (texture.textureFormat === 1)
    return {
      width: texture.width,
      height: texture.height,
      flipY: true,
      contentType: 'image/jpeg',
      buffer: Buffer.from(texture.bytes ?? [])
    }

  if (texture.textureFormat === 6)
    return {
      width: texture.width,
      height: texture.height,
      flipY: false,
      contentType: 'image/png',
      buffer: await sharp(decodeTextureRgba(texture), {
        raw: {
          width: texture.width,
          height: texture.height,
          channels: 4
        }
      })
        .png()
        .toBuffer()
    }

  throw new Error(`unknown textureFormat ${texture.textureFormat}`)
}

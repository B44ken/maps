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
  texture?: DecodedTexture | null
}

export type DecodedNodeData = {
  matrixGlobeFromMesh?: ArrayLike<number>
  meshes?: DecodedMesh[]
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
  if (packet.textureFormat === undefined)
    throw new Error(`missing textureFormat for ${packet.id}`)

  const params = new URLSearchParams({
    version: String(packet.version),
    textureFormat: String(packet.textureFormat)
  })

  if (packet.imageryEpoch !== undefined)
    params.set('imageryEpoch', String(packet.imageryEpoch))

  return `/api/model/texture/${packet.id}/${meshIndex}?${params}`
}

export const decodeTextureRgba = (tex: DecodedTexture) => {
  if (tex.textureFormat !== 6)
    throw new Error(`raw rgba only supported for textureFormat=6, got ${tex.textureFormat}`)

  const b = tex.bytes
  if (!b) throw new Error('missing dxt texture bytes')
  return Buffer.from(decodeDXT(new DataView(b.buffer, b.byteOffset, b.byteLength), tex.width, tex.height, 'dxt1') as unknown as Uint8Array)
}

export const decodeModelTexture = async (packet: ModelPacket, meshIndex: number) => {
  const node = await fetchDecodedNodeData(packet)
  const tex = node.meshes?.[meshIndex]?.texture

  if (!tex)
    throw new Error(`missing texture for ${packet.id}:${meshIndex}`)

  if (tex.textureFormat === 1) {
    if (!tex.bytes)
      throw new Error(`missing jpeg texture bytes for ${packet.id}:${meshIndex}`)

    return {
      contentType: 'image/jpeg',
      buffer: Buffer.from(tex.bytes)
    }
  }

  if (tex.textureFormat === 6)
    return {
      contentType: 'image/png',
      buffer: await sharp(decodeTextureRgba(tex), { raw: { width: tex.width, height: tex.height, channels: 4 }}).png().toBuffer()
    }

  throw new Error(`unknown textureFormat ${tex.textureFormat}`)
}

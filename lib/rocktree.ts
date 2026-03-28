import { parse } from 'protobufjs'

import { fetchGoogleBuffer } from './google'

const rocktreeProto = `
syntax = "proto2";

package geo_globetrotter_proto_rocktree;

message NodeKey {
  optional string path = 1;
  optional uint32 epoch = 2;
}

message NodeMetadata {
  optional uint32 path_and_flags = 1;
  optional uint32 epoch = 2;
  optional uint32 bulk_metadata_epoch = 5;
  optional bytes oriented_bounding_box = 3;
  optional uint32 imagery_epoch = 7;
  optional uint32 available_texture_formats = 8;
}

message BulkMetadata {
  repeated NodeMetadata node_metadata = 1;
  optional NodeKey head_node_key = 2;
  optional uint32 default_imagery_epoch = 5;
  optional uint32 default_available_texture_formats = 6;
}

message PlanetoidMetadata {
  optional NodeMetadata root_node_metadata = 1;
}
`

type RawNodeMetadata = {
  pathAndFlags: number
  epoch?: number
  bulkMetadataEpoch?: number
  orientedBoundingBox?: Uint8Array
  imageryEpoch?: number
  availableTextureFormats?: number
}

type RawBulkMetadata = {
  headNodeKey?: {
    path?: string
  }
  defaultImageryEpoch?: number
  defaultAvailableTextureFormats?: number
  nodeMetadata?: RawNodeMetadata[]
}

type RawPlanetoidMetadata = {
  rootNodeMetadata?: {
    bulkMetadataEpoch?: number
  }
}

export type BulkEntry = {
  path: string
  fullPath: string
  flags: number
  epoch: number
  bulkEpoch: number
  imageryEpoch: number
  textureFormat: number
  useImageryEpoch: boolean
  hasObb: boolean
}

export type BulkPacket = {
  headPath: string
  epoch: number
  entries: BulkEntry[]
  byPath: Map<string, BulkEntry>
}

const root = parse(rocktreeProto).root
const planetoidType = root.lookupType(
  'geo_globetrotter_proto_rocktree.PlanetoidMetadata'
)
const bulkType = root.lookupType('geo_globetrotter_proto_rocktree.BulkMetadata')
const preferredTextureFormats = [6, 1]

const unpackPathAndFlags = (value: number) => {
  const level = 1 + (value & 3)
  let remaining = value >> 2
  let path = ''

  for (let index = 0; index < level; index += 1) {
    path += String(remaining & 7)
    remaining >>= 3
  }

  return { path, flags: remaining }
}

const pickTextureFormat = (mask: number) =>
  preferredTextureFormats.find(format => mask & (1 << (format - 1))) ??
  preferredTextureFormats[0]

const decodePlanetoid = (payload: Uint8Array) =>
  planetoidType.decode(payload) as unknown as RawPlanetoidMetadata

const decodeBulk = (payload: Uint8Array, epoch: number) => {
  const decoded = bulkType.decode(payload) as unknown as RawBulkMetadata
  const headPath = decoded.headNodeKey?.path ?? ''
  const entries =
    decoded.nodeMetadata?.map(node => {
      const meta = unpackPathAndFlags(node.pathAndFlags)
      const textureMask =
        node.availableTextureFormats ??
        decoded.defaultAvailableTextureFormats ??
        preferredTextureFormats[0]

      return {
        path: meta.path,
        fullPath: `${headPath}${meta.path}`,
        flags: meta.flags,
        epoch: node.epoch ?? 0,
        bulkEpoch: node.bulkMetadataEpoch ?? 0,
        imageryEpoch: node.imageryEpoch ?? decoded.defaultImageryEpoch ?? 0,
        textureFormat: pickTextureFormat(textureMask),
        useImageryEpoch: !!(meta.flags & 16),
        hasObb: !!node.orientedBoundingBox?.length
      }
    }) ?? []

  return {
    headPath,
    epoch,
    entries,
    byPath: new Map(entries.map(entry => [entry.path, entry]))
  } satisfies BulkPacket
}

const planetoidPromise = fetchGoogleBuffer(
  'https://kh.google.com/rt/earth/PlanetoidMetadata'
).then(decodePlanetoid)

const bulkPromises = new Map<string, Promise<BulkPacket>>()

export const getRootBulkEpoch = async () => {
  const epoch = (await planetoidPromise).rootNodeMetadata?.bulkMetadataEpoch

  if (epoch === undefined)
    throw new Error('missing root bulk epoch')

  return epoch
}

export const fetchBulk = async (path: string, epoch: number) => {
  const key = `${path}:${epoch}`

  if (!bulkPromises.has(key))
    bulkPromises.set(
      key,
      fetchGoogleBuffer(
        `https://kh.google.com/rt/earth/BulkMetadata/pb=!1m2!1s${path}!2u${epoch}`
      ).then(payload => decodeBulk(payload, epoch))
    )

  return bulkPromises.get(key)!
}

export const getBulkRelativePath = (path: string) =>
  path.slice(Math.floor((path.length - 1) / 4) * 4)

export const getBulkEntry = (bulk: BulkPacket, path: string) =>
  bulk.byPath.get(getBulkRelativePath(path))

export const canDescendToBulk = (entry: BulkEntry | undefined) =>
  !!entry && entry.path.length === 4 && !(entry.flags & 4)

export const hasRich3dData = (entry: BulkEntry | undefined) =>
  !!entry && !(entry.flags & 2)

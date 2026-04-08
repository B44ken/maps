import { parse } from 'protobufjs'

const rocktreeProto = `syntax = "proto2";
package geo_globetrotter_proto_rocktree;
message NodeKey { optional string path = 1; }
message NodeMetadata { optional uint32 path_and_flags = 1; optional bytes oriented_bounding_box = 3; optional uint32 bulk_metadata_epoch = 5; }
message BulkMetadata { repeated NodeMetadata node_metadata = 1; optional NodeKey head_node_key = 2; }
message PlanetoidMetadata { optional NodeMetadata root_node_metadata = 1; }`

export type BulkEntry = { path: string, fullPath: string, flags: number, bulkEpoch: number, hasObb: boolean }

const pb = parse(rocktreeProto).root, planetPb = pb.lookupType('geo_globetrotter_proto_rocktree.PlanetoidMetadata'), bulkPb = pb.lookupType('geo_globetrotter_proto_rocktree.BulkMetadata')

const unpackPathFlags = (value: number) => {
  let remaining = value >> 2, path = ''
  for (let i = 0; i < 1 + (value & 3); i += 1)
    path += String(remaining & 7), remaining >>= 3
  return { path, flags: remaining }
}

const decodeBulk = (pl: Uint8Array): BulkEntry[] => {
  const dec = bulkPb.decode(pl) as any
  const head = dec.headNodeKey?.path ?? ''
  return (dec.nodeMetadata ?? []).map(({ pathAndFlags, bulkMetadataEpoch: bulkEpoch, orientedBoundingBox }: any) => {
    const { flags, path } = unpackPathFlags(pathAndFlags)
    return { path, fullPath: `${head}${path}`, flags, bulkEpoch, hasObb: !!orientedBoundingBox?.length }
  })
}

const planetoid = fetch('https://kh.google.com/rt/earth/PlanetoidMetadata').then(r => r.arrayBuffer()).then(b => planetPb.decode(new Uint8Array(b)) as any)
export const rootEpoch = planetoid.then(p => p.rootNodeMetadata.bulkMetadataEpoch as number)

const cache = new Map<string, Promise<BulkEntry[]>>()
export const fetchBulk = async (path: string, e: number) => {
  if (!cache.has(path))
    cache.set(path, fetch(`https://kh.google.com/rt/earth/BulkMetadata/pb=!1m2!1s${path}!2u${e}`).then(r => r.arrayBuffer()).then(b => decodeBulk(new Uint8Array(b))))
  return cache.get(path)!
}

export const canDescendToBulk = (e: BulkEntry | undefined) => !!e && e.path.length === 4 && !(e.flags & 4)
export const hasRich3dData = (e: BulkEntry | undefined) => !!e && !(e.flags & 2)

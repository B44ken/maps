import {
  canDescendToBulk,
  fetchBulk,
  getBulkEntry,
  getRootBulkEpoch,
  hasRich3dData,
  type BulkEntry,
  type BulkPacket
} from './rocktree'
import type { BulkRef, ModelDiscoveryResponse, NodeRef } from './types'

type Box = { n: number, s: number, w: number, e: number }
type Step = { path: string, epoch: number, entry: BulkEntry }
type Hit = { octant: string, bulk: BulkPacket, chain: Step[] }

const nodeQs = ({ version, textureFormat, imageryEpoch }: NodeRef) =>
  `version=${version}&textureFormat=${textureFormat}${imageryEpoch === undefined ? '' : `&imageryEpoch=${imageryEpoch}`}`

export const buildNodeProxyUrl = (n: NodeRef) => `/api/model/node/${n.id}?${nodeQs(n)}`

const getFirstOctant = (lat: number, lng: number) => {
  if(lat < 0 && lng < -90) return ['02', { n: 0, s: -90, w: -180, e: -90 }] as const
  if(lat < 0 && lng < 0) return ['03', { n: 0, s: -90, w: -90, e: 0 }] as const
  if(lat < 0 && lng < 90) return ['12', { n: 0, s: -90, w: 0, e: 90 }] as const
  if(lat < 0) return ['13', { n: 0, s: -90, w: 90, e: 180 }] as const
  if(lng < -90) return ['20', { n: 90, s: 0, w: -180, e: -90 }] as const
  if(lng < 0) return ['21', { n: 90, s: 0, w: -90, e: 0 }] as const
  if(lng < 90) return ['30', { n: 90, s: 0, w: 0, e: 90 }] as const
  return ['31', { n: 90, s: 0, w: 90, e: 180 }] as const
}

const getNextOctant = (box: Box,lat: number,lng: number) => {
  let { n, s, w, e } = box
  const midLat = (n + s) / 2
  const midLng = (w + e) / 2
  let key = 0

  if (lat < midLat)
    n = midLat
  else {
    s = midLat
    key += 2
  }

  if (n !== 90 && s !== -90)
    if (lng < midLng)
      e = midLng
    else {
      w = midLng
      key += 1
    }

  return [key, { n, s, w, e }] as const
}

const hits = new Map<string, Promise<Hit | null>>()

const resolve = (octant: string) => {
  if (hits.has(octant)) return hits.get(octant)!

  const hit = (async () => {
    let epoch: number = await getRootBulkEpoch()
    let bulk!: BulkPacket
    const chain: Step[] = []

    for (let i = 4; i < octant.length + 4; i += 4) {
      if (chain.length && !canDescendToBulk(chain[chain.length - 1].entry))
        return null

      const path = octant.slice(0, i - 4)
      bulk = await fetchBulk(path, epoch)
      const entry = getBulkEntry(bulk, octant.slice(0, i))

      if (!entry) return null

      chain.push({ path, epoch, entry })
      epoch = entry.bulkEpoch
    }

    return { octant, bulk, chain }
  })()

  hits.set(octant, hit)
  return hit
}

const findLeaves = async (lat: number, lng: number, max = 20): Promise<Hit[]> => {
  const [octant, box] = getFirstOctant(lat, lng)

  const search = async (octant: string, box: Box): Promise<Hit[]> => {
    if (octant.length > max) return []

    const hit = await resolve(octant)
    if (!hit) return []

    const [k, next] = getNextOctant(box, lat, lng)
    const kids = (await Promise.all([search(`${octant}${k}`, next), search(`${octant}${k + 4}`, next)])).flat()

    return kids.length ? kids : [hit]
  }

  return search(octant, box)
}

const toBulkRef = (id: string, version: number): BulkRef => ({ id, version })

const toNodeRef = (entry: BulkEntry): NodeRef => ({
  id: entry.fullPath,
  version: entry.epoch,
  textureFormat: entry.textureFormat,
  imageryEpoch: entry.useImageryEpoch ? entry.imageryEpoch : undefined
})

export const discoverModel = async (lat: number,lng: number): Promise<ModelDiscoveryResponse> => {
  const found = await findLeaves(lat, lng)
  const octants = found.map(x => x.octant)
  const bulk = new Map<string, BulkRef>()
  const nodes = new Map<string, NodeRef>()

  for (const hit of found) {
    for (const step of hit.chain)
      if (step.path)
        bulk.set(step.path, toBulkRef(step.path, step.epoch))

    for (const step of hit.chain)
      if (hasRich3dData(step.entry) && step.entry.hasObb)
        nodes.set(step.entry.fullPath, toNodeRef(step.entry))

    for (const entry of hit.bulk.entries)
      if (hasRich3dData(entry) && entry.hasObb)
        nodes.set(entry.fullPath, toNodeRef(entry))
  }

  const ns = [...nodes.values()]
  const depth = Math.max(...ns.map(n => n.id.length))

  return { query: { lat, lng }, octants, bulk: [...bulk.values()], nodes: ns.filter(n => n.id.length == depth) }
}

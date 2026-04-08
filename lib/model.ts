import { canDescendToBulk, fetchBulk, rootEpoch, hasRich3dData, type BulkEntry } from './rocktree'

export type Model = { lat: number, lng: number, nodes: string[] }

type Hit = { octant: string, bulk: BulkEntry[], chain: BulkEntry[] }

const box = (oc: string): number[] => {
  const row = Number(oc[0]) >> 1, col = (Number(oc[0]) & 1) * 2 + (Number(oc[1]) & 1)
  const box = [row ? 90 : 0, row ? 0 : -90, col * 90 - 180, col * 90 - 90]
  for (const x of oc.slice(2)) {
    const k = Number(x) & 3, lat = (box[0] + box[1]) / 2
    box[k & 2 ? 1 : 0] = lat
    if (box[0] < 90 && box[1] > -90) box[k&1 ? 2:3] = (box[2]+box[3])/2
  }
  return box
}

const getBulkEntry = (entries: BulkEntry[], p: string) => entries.find(e => e.path === p.slice(Math.floor((p.length - 1) / 4) * 4))
const isNode = (entry: BulkEntry | undefined, depth: number) => !!entry && hasRich3dData(entry) && entry.hasObb && entry.fullPath.length === depth

const hits = new Map<string, Promise<Hit | null>>()
const resolve = (octant: string) => {
  if (hits.has(octant)) return hits.get(octant)!
  const hit = (async () => {
    let chain: BulkEntry[] = [], epoch = await rootEpoch, bulk: BulkEntry[] = []
    for (let i = 4; i < octant.length + 4; i += 4) {
      if (chain.length && !canDescendToBulk(chain[chain.length - 1])) return null
      bulk = await fetchBulk(octant.slice(0, i - 4), epoch)
      const entry = getBulkEntry(bulk, octant.slice(0, i))
      if (!entry) return null
      chain.push(entry)
      epoch = entry.bulkEpoch
    }
    return { octant, bulk, chain }
  })()
  hits.set(octant, hit)
  return hit
}

const findLeaves = async (lat: number, lng: number, max = 20): Promise<Hit[]> => {
  const row = Number(lat >= 0), col = lng < -90 ? 0 : lng < 0 ? 1 : lng < 90 ? 2 : 3
  const root = `${row * 2 + (col >> 1)}${(1 - row) * 2 + (col & 1)}`
  const search = async (octant: string, [n, s, w, e]: number[]): Promise<Hit[]> => {
    if (octant.length > max) return []
    const hit = await resolve(octant)
    if (!hit) return []
    const latMid = (n + s) / 2, lngMid = (w + e) / 2
    const k = (lat >= latMid ? 2 : 0) + (n !== 90 && s !== -90 && lng >= lngMid ? 1 : 0)
    const next = [k & 2 ? n : latMid, k & 2 ? latMid : s, w, e]
    if(next[0] < 90 && next[1] > -90) next[k&1 ? 2:3] = lngMid
    const kids = (await Promise.all([search(`${octant}${k}`, next), search(`${octant}${k + 4}`, next)])).flat()
    return kids.length ? kids : [hit]
  }
  return search(root, box(root))
}

const walkOctant = async (octant: string, depth: number, visit?: (entry: BulkEntry) => boolean, seen = new Set<string>()) => {
  const hit = await resolve(octant)
  if (!hit) return false

  if (isNode(hit.chain[hit.chain.length - 1], depth) && visit?.(hit.chain[hit.chain.length - 1])) return true

  const walk = async (entries: BulkEntry[]) => {
    for (const entry of entries) {
      if (!entry.fullPath.startsWith(octant) || entry.fullPath.length > depth) continue
      if (isNode(entry, depth) && visit?.(entry)) return true
      if (!canDescendToBulk(entry) || entry.fullPath.length >= depth) continue

      const key = `${entry.fullPath}:${entry.bulkEpoch}`
      if (seen.has(key)) continue
      seen.add(key)
      if (await walk(await fetchBulk(entry.fullPath, entry.bulkEpoch))) return true
    }
  }

  return walk(hit.bulk)
}

export const discoverOctant = async (oc: string, depth = 20, lat?: number, lng?: number) => {
  const ocs = oc.split(',')
  const nodes = new Set<string>()
  for (const oc of ocs)
    await walkOctant(oc, depth, ent => (nodes.add(ent.fullPath), false))
  if (lat != null && lng != null) return { lat, lng, nodes: [...nodes].sort() }
  const [n, s, w, e] = box(ocs[0])
  return { lat: (n + s) / 2, lng: (w + e) / 2, nodes: [...nodes].sort() }
}

export const discoverAt = async (lat: number, lng: number, size = 17, depth = 20) => {
  const ocs = []
  for (const { octant: o } of await findLeaves(lat, lng, size))
    if (await walkOctant(o, depth, () => true)) ocs.push(o)
  return ocs
}

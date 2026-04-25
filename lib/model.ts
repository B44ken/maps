import { canDescend, fetchBulk, rootEpoch, hasRich3dData, type Bulk } from './rocktree'
import { dist, distBox } from './util'
export type Model = { lat: number, lng: number, nodes: string[] }
type Hit = { octant: string, bulk: Bulk[], chain: Bulk[] }

const box = (oc: string): number[] => {
  const row = Number(oc[0]) >> 1, col = (Number(oc[0]) & 1) * 2 + (Number(oc[1]) & 1)
  const box = [row ? 90 : 0, row ? 0 : -90, col * 90 - 180, col * 90 - 90]
  for (const x of oc.slice(2)) {
    const k = Number(x) & 3, lat = (box[0] + box[1]) / 2
    box[k & 2 ? 1 : 0] = lat
    if (box[0] < 90 && box[1] > -90) box[k & 1 ? 2 : 3] = (box[2] + box[3]) / 2
  }
  return box as number[]
}

const getBulkEntry = (entries: Bulk[], p: string) => entries.find(e => e.path === p.slice(Math.floor((p.length - 1) / 4) * 4))
const isNode = (entry: Bulk | undefined, depth: number) => !!entry && hasRich3dData(entry) && entry.hasObb && entry.fullPath.length === depth

const hits = new Map<string, Promise<Hit | null>>()
const resolve = (octant: string) => {
  if (hits.has(octant)) return hits.get(octant)!
  const hit = (async () => {
    let chain: Bulk[] = [], epoch = await rootEpoch, bulk: Bulk[] = []
    for (let i = 4; i < octant.length + 4; i += 4) {
      if (chain.length && !canDescend(chain[chain.length - 1])) return null
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

const walkOctant = async (octant: string, depth: number, visit?: (entry: Bulk) => boolean, seen = new Set<string>()) => {
  const hit = await resolve(octant)
  if (!hit) return false

  if (isNode(hit.chain[hit.chain.length - 1], depth) && visit?.(hit.chain[hit.chain.length - 1])) return true

  const walk = async (entries: Bulk[]) => {
    for (const entry of entries) {
      if (!entry.fullPath.startsWith(octant) || entry.fullPath.length > depth) continue
      if (isNode(entry, depth) && visit?.(entry)) return true
      if (!canDescend(entry) || entry.fullPath.length >= depth) continue

      const key = `${entry.fullPath}:${entry.bulkEpoch}`
      if (seen.has(key)) continue
      seen.add(key)
      if (await walk(await fetchBulk(entry.fullPath, entry.bulkEpoch))) return true
    }
  }

  return walk(hit.bulk)
}

export const discoverOctants = async (ocs: string[], depth = 20, lat?: number, lng?: number) => {
  const nodes = new Set<string>()
  for (const oc of ocs)
    await walkOctant(oc, depth, ent => (nodes.add(ent.fullPath), false))
  if (lat != null && lng != null) return { lat, lng, nodes: [...nodes].sort() }
  const [n, s, w, e] = box(ocs[0])
  return { lat: (n + s) / 2, lng: (w + e) / 2, nodes: [...nodes].sort() }
}

export const discoverNear = async (lat: number, lng: number, depth = 17, r = 250, start = ''): Promise<string[]> => {
  const stack = ['02', '03', '12', '13', '20', '21', '30', '31'], seen = new Set<string>(), kept: string[] = []

  while (stack.length) {
    const octant = stack.pop()!, path = start + octant
    if (seen.has(path)) continue
    seen.add(path)
    if (distBox(lat, lng, box(path)) > r) continue

    const hit = await resolve(path)
    const entry = hit?.chain.at(-1)
    if (!hit || !entry) continue

    if (path.length == depth || isNode(entry, depth)) {
      kept.push(path)
      continue
    }

    const cull = (xs: Bulk[]) => {
      const fps = xs.filter(({ fullPath: fp }) => fp.startsWith(path) && fp.length > path.length)
      const len = Math.min(...fps.map(f => f.fullPath.length))
      return fps.filter(f => f.fullPath.length === len)
    }

    let fps = cull(hit.bulk)
    if (!fps.length && canDescend(entry)) fps = cull(await fetchBulk(entry.fullPath, entry.bulkEpoch))
    for (const next of fps.map(f => f.fullPath.slice(start.length))) stack.push(next)
  }

  return kept
}
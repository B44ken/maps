import {
  canDescendToBulk,
  fetchBulk,
  getBulkEntry,
  getRootBulkEpoch,
  hasRich3dData,
  type BulkEntry,
  type BulkPacket
} from './rocktree'
import type { ModelDiscoveryResponse, ModelPacket } from './types'

const maxOctantLevel = 20

const buildBulkUrl = (path: string, version: number) =>
  `https://kh.google.com/rt/earth/BulkMetadata/pb=!1m2!1s${path}!2u${version}`

export const buildNodeUrl = (path: string, ver: number, texFmt: number, epoch?: number) =>
  `https://kh.google.com/rt/earth/NodeData/pb=!1m2!1s${path}!2u${ver}!2e${texFmt}${epoch === undefined ? '' : `!3u${epoch}`}!4b0`

const buildNodeProxyUrl = (
  path: string,
  version: number,
  textureFormat: number,
  imageryEpoch?: number
) => {
  const params = new URLSearchParams({
    version: String(version),
    textureFormat: String(textureFormat)
  })

  if (imageryEpoch !== undefined)
    params.set('imageryEpoch', String(imageryEpoch))

  return `/api/model/node/${path}?${params}`
}

const sortPackets = (packets: ModelPacket[]) =>
  packets.sort(
    (left, right) => left.id.length - right.id.length || left.id.localeCompare(right.id)
  )

const getFirstOctant = (lat: number, lng: number) => {
  if (lat < 0) {
    if (lng < -90)
      return ['02', { n: 0, s: -90, w: -180, e: -90 }] as const
    if (lng < 0)
      return ['03', { n: 0, s: -90, w: -90, e: 0 }] as const
    if (lng < 90)
      return ['12', { n: 0, s: -90, w: 0, e: 90 }] as const

    return ['13', { n: 0, s: -90, w: 90, e: 180 }] as const
  }

  if (lng < -90)
    return ['20', { n: 90, s: 0, w: -180, e: -90 }] as const
  if (lng < 0)
    return ['21', { n: 90, s: 0, w: -90, e: 0 }] as const
  if (lng < 90)
    return ['30', { n: 90, s: 0, w: 0, e: 90 }] as const

  return ['31', { n: 90, s: 0, w: 90, e: 180 }] as const
}

const getNextOctant = (box: { n: number; s: number; w: number; e: number },lat: number,lng: number) => {
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

type ChainStep = {
  path: string
  epoch: number
  entry: BulkEntry
}

const resolveNodePath = async (nodePath: string) => {
  let epoch = await getRootBulkEpoch()
  let bulk: BulkPacket | null = null
  let entry: BulkEntry | undefined
  const chain: ChainStep[] = []

  for (let index = 4; index < nodePath.length + 4; index += 4) {
    const bulkPath = nodePath.slice(0, index - 4)
    const subPath = nodePath.slice(0, index)

    if (bulk && !canDescendToBulk(getBulkEntry(bulk, bulkPath)))
      return null

    bulk = await fetchBulk(bulkPath, epoch)
    entry = getBulkEntry(bulk, subPath)

    if (!entry)
      return null

    chain.push({ path: bulkPath, epoch, entry })
    epoch = entry.bulkEpoch
  }

  if (!bulk || !entry)
    return null

  return { bulk, entry, chain }
}

const findOctants = async (lat: number, lng: number, maxLevel: number) => {
  const [startPath, startBox] = getFirstOctant(lat, lng)
  const found = new Map<number, string[]>()

  const search = async (
    nodePath: string,
    box: { n: number; s: number; w: number; e: number }
  ) => {
    if (nodePath.length > maxLevel)
      return

    if (!(await resolveNodePath(nodePath)))
      return

    if (!found.has(nodePath.length))
      found.set(nodePath.length, [])

    found.get(nodePath.length)!.push(nodePath)

    const [nextKey, nextBox] = getNextOctant(box, lat, lng)

    await search(`${nodePath}${nextKey}`, nextBox)
    await search(`${nodePath}${nextKey + 4}`, nextBox)
  }

  await search(startPath, startBox)

  return found
}

const toBulkPacket = (path: string, version: number): ModelPacket => ({
  id: path,
  version,
  url: buildBulkUrl(path, version),
  proxyUrl: `/api/model/bulk/${path}?version=${version}`
})

const toNodePacket = (entry: BulkEntry): ModelPacket => {
  const imageryEpoch = entry.useImageryEpoch ? entry.imageryEpoch : undefined

  return {
    id: entry.fullPath,
    version: entry.epoch,
    textureFormat: entry.textureFormat,
    imageryEpoch,
    url: buildNodeUrl(entry.fullPath, entry.epoch, entry.textureFormat, imageryEpoch),
    proxyUrl: buildNodeProxyUrl(
      entry.fullPath,
      entry.epoch,
      entry.textureFormat,
      imageryEpoch
    )
  }
}

export const discoverModel = async (lat: number,lng: number,meters: number): Promise<ModelDiscoveryResponse> => {
  const octantsByLevel = await findOctants(lat, lng, maxOctantLevel)
  const deepestLevel = [...octantsByLevel.keys()].sort((left, right) => right - left)[0]
  const octants = deepestLevel === undefined ? [] : octantsByLevel.get(deepestLevel) ?? []
  const bulkPackets = new Map<string, ModelPacket>()
  const nodePackets = new Map<string, ModelPacket>()

  for (const octant of octants) {
    const resolved = await resolveNodePath(octant)

    if (!resolved)
      continue

    for (const step of resolved.chain)
      if (step.path)
        bulkPackets.set(step.path, toBulkPacket(step.path, step.epoch))

    for (const step of resolved.chain)
      if (hasRich3dData(step.entry) && step.entry.hasObb)
        nodePackets.set(step.entry.fullPath, toNodePacket(step.entry))

    for (const entry of resolved.bulk.entries)
      if (hasRich3dData(entry) && entry.hasObb)
        nodePackets.set(entry.fullPath, toNodePacket(entry))
  }

  return {
    query: { lat, lng, meters },
    octants,
    bulk: sortPackets([...bulkPackets.values()]),
    nodes: sortPackets([...nodePackets.values()])
  }
}

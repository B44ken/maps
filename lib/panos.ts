import { fetchGoogleJson, haversineMeters, latLngToTile, tileNeighbors } from './google'
import type { PanoDetail, PanoSearchResponse, PanoSummary, TileRef } from './types'

const buildAutocompleteUrl = ({ x, y, z }: TileRef) =>
  `https://www.google.com/maps/photometa/ac/v1?pb=!1m1!1smaps_sv.tactile!6m3!1i${x}!2i${y}!3i${z}!8b1`

const buildPhotometaUrl = (panoId: string) =>
  `https://www.google.com/maps/photometa/v1?authuser=0&hl=en&gl=ca&pb=!1m4!1smaps_sv.tactile!11m2!2m1!1b1!2m2!1sen!2sca!3m3!1m2!1e2!2s${panoId}!4m61!1e1!1e2!1e3!1e4!1e5!1e6!1e8!1e12!1e17!2m1!1e1!4m1!1i48!5m1!1e1!5m1!1e2!6m1!1e1!6m1!1e2!9m36!1m3!1e2!2b1!3e2!1m3!1e2!2b0!3e3!1m3!1e3!2b1!3e2!1m3!1e3!2b0!3e3!1m3!1e8!2b0!3e3!1m3!1e1!2b0!3e3!1m3!1e4!2b0!3e3!1m3!1e10!2b1!3e2!1m3!1e10!2b0!3e3!11m2!3m1!4b1`

export const buildPanoTileUrl = (panoId: string, zoom: number, x: number, y: number) =>
  `https://streetviewpixels-pa.googleapis.com/v1/tile?cb_client=maps_sv.tactile&panoid=${panoId}&x=${x}&y=${y}&zoom=${zoom}&nbt=1&fover=2`

export const buildPanoTileProxyUrl = (panoId: string, zoom: number, x: number, y: number) =>
  `/api/panos/${panoId}/tile?zoom=${zoom}&x=${x}&y=${y}`

const visitArrays = (value: unknown, visitor: (node: unknown[]) => void) => {
  if (!Array.isArray(value)) return

  visitor(value)
  value.forEach(c => visitArrays(c, visitor))
}

const parsePanoNode = (node: unknown[]): Omit<PanoSummary, 'distanceMeters'> | null => {
  if (!Array.isArray(node[0]))
    return null

  const identity = node[0] as any[]

  if (identity[0] !== 2 || typeof identity[1] !== 'string' || !Array.isArray(node[2]))
    return null

  const pose = node[2] as any[]

  return { lat: pose[0][2], lng: pose[0][3], heading: pose[2][0], pitch: pose[2][1], roll: pose[2][2], id: identity[1] }
}

export const discoverPanos = async (lat: number, lng: number, zoom: number, radius: number): Promise<PanoSearchResponse> => {
  const center = latLngToTile(lat, lng, zoom)
  const tiles = tileNeighbors(center, radius)
  const payloads = await Promise.all(tiles.map(t => fetchGoogleJson<unknown>(buildAutocompleteUrl(t))))
  const panos = new Map<string, PanoSummary>()

  payloads.forEach(payload => {
    visitArrays(payload, node => {
      const pano = parsePanoNode(node)
      if (!pano || panos.has(pano.id)) return
      panos.set(pano.id, { ...pano, distanceMeters: haversineMeters(lat, lng, pano.lat, pano.lng) })
    })
  })

  return { query: { lat, lng, zoom, radius }, tiles, panos: [...panos.values()].sort((a, b) => a.distanceMeters - b.distanceMeters) }
}

export const getPanoDetail = async (panoId: string): Promise<PanoDetail> => {
  const payload = (await fetchGoogleJson<unknown[]>(buildPhotometaUrl(panoId))) as any[]
  const root = payload[1]?.[0]
  const titles = root?.[3]?.[2], location = root?.[5]?.[0]?.[1]

  return {
    id: root?.[1]?.[1], lat: location[0]?.[2], lng: location[0]?.[3], heading: location[2]?.[0], pitch: location[2]?.[1], roll: location[2]?.[2],
    title: titles[0]?.[0], subtitle: titles[1]?.[0], previewUrl: buildPanoTileProxyUrl(panoId, 0, 0, 0)
  }
}

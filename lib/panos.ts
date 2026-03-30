import { fetchGoogleJson, haversineMeters, latLngToTile, tileNeighbors } from './google'
import type { PanoSearchResponse, PanoSummary, TileRef } from './types'

const buildAutocompleteUrl = ({ x, y, z }: TileRef) =>
  `https://www.google.com/maps/photometa/ac/v1?pb=!1m1!1smaps_sv.tactile!6m3!1i${x}!2i${y}!3i${z}!8b1`

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

  payloads.forEach(pl => {
    visitArrays(pl, node => {
      const pano = parsePanoNode(node)
      if (!pano || panos.has(pano.id)) return
      panos.set(pano.id, { ...pano, distanceMeters: haversineMeters(lat, lng, pano.lat, pano.lng) })
    })
  })

  return { query: { lat, lng, zoom, radius }, tiles, panos: [...panos.values()].sort((a, b) => a.distanceMeters - b.distanceMeters) }
}

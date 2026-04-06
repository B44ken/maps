import { fetchGoogleJson, haversineMeters, latLngToTile, tileNeighbors } from './google'
import type { Panos, Pano, XYZ } from './types'

const buildAutocompleteUrl = ({ x, y, z }: XYZ) =>
  `https://www.google.com/maps/photometa/ac/v1?pb=!1m1!1smaps_sv.tactile!6m3!1i${x}!2i${y}!3i${z}!8b1`

const visitArrays = (x: unknown, visitor: (node: unknown[]) => void) => {
  if (!Array.isArray(x)) return
  visitor(x)
  x.forEach(y => visitArrays(y, visitor))
}

const parsePanoNode = (node: unknown[]): Pano | null => {
  if (!Array.isArray(node[0]) || node[0][0] !== 2 || typeof node[0][1] !== 'string' || !Array.isArray(node[2])) return null
  return { lat: node[2][0][2], lng: node[2][0][3], height: node[2][1][2], heading: node[2][2][0], pitch: node[2][2][1], roll: node[2][2][2], id: node[0][1], dist: -1 }
}

export const discoverPanos = async (lat: number, lng: number, zoom: number, radius: number): Promise<Panos> => {
  const center = latLngToTile(lat, lng, zoom)
  const tiles = tileNeighbors(center, radius)
  const payloads = await Promise.all(tiles.map(t => fetchGoogleJson<unknown>(buildAutocompleteUrl(t))))
  const panos = new Map<string, Pano>()

  payloads.forEach(pl => {
    visitArrays(pl, node => {
      const pano = parsePanoNode(node)
      if (!pano || panos.has(pano.id)) return
      panos.set(pano.id, { ...pano, dist: haversineMeters(lat, lng, pano.lat, pano.lng) })
    })
  })

  return { query: { lat, lng, zoom, radius }, tiles, panos: [...panos.values()].sort((a, b) => a.dist - b.dist) }
}

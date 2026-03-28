import { fetchGoogleJson, haversineMeters, latLngToTile, tileNeighbors } from './google'
import type {
  PanoDetailResponse,
  PanoSearchResponse,
  PanoSummary,
  TileRef
} from './types'

const buildAutocompleteUrl = ({ x, y, z }: TileRef) =>
  `https://www.google.com/maps/photometa/ac/v1?pb=!1m1!1smaps_sv.tactile!6m3!1i${x}!2i${y}!3i${z}!8b1`

const buildPhotometaUrl = (panoId: string) =>
  `https://www.google.com/maps/photometa/v1?authuser=0&hl=en&gl=ca&pb=!1m4!1smaps_sv.tactile!11m2!2m1!1b1!2m2!1sen!2sca!3m3!1m2!1e2!2s${panoId}!4m61!1e1!1e2!1e3!1e4!1e5!1e6!1e8!1e12!1e17!2m1!1e1!4m1!1i48!5m1!1e1!5m1!1e2!6m1!1e1!6m1!1e2!9m36!1m3!1e2!2b1!3e2!1m3!1e2!2b0!3e3!1m3!1e3!2b1!3e2!1m3!1e3!2b0!3e3!1m3!1e8!2b0!3e3!1m3!1e1!2b0!3e3!1m3!1e4!2b0!3e3!1m3!1e10!2b1!3e2!1m3!1e10!2b0!3e3!11m2!3m1!4b1`

export const buildPanoTileUrl = (
  panoId: string,
  zoom: number,
  x: number,
  y: number
) =>
  `https://streetviewpixels-pa.googleapis.com/v1/tile?cb_client=maps_sv.tactile&panoid=${panoId}&x=${x}&y=${y}&zoom=${zoom}&nbt=1&fover=2`

export const buildPanoTileProxyUrl = (
  panoId: string,
  zoom: number,
  x: number,
  y: number
) => `/api/panos/${panoId}/tile?zoom=${zoom}&x=${x}&y=${y}`

const visitArrays = (value: unknown, visitor: (node: unknown[]) => void) => {
  if (!Array.isArray(value))
    return

  visitor(value)
  value.forEach(child => visitArrays(child, visitor))
}

const parsePanoNode = (node: unknown[]): Omit<PanoSummary, 'distanceMeters'> | null => {
  if (!Array.isArray(node[0]))
    return null

  const identity = node[0] as any[]

  if (identity[0] !== 2 || typeof identity[1] !== 'string')
    return null

  if (!Array.isArray(node[2]))
    return null

  const pose = node[2] as any[]
  const labelNode = Array.isArray(node[3]) ? (node[3] as any[]) : []
  const lat = pose[0]?.[2]
  const lng = pose[0]?.[3]
  const heading = pose[2]?.[0]
  const pitch = pose[2]?.[1]
  const roll = pose[2]?.[2]

  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    typeof heading !== 'number' ||
    typeof pitch !== 'number' ||
    typeof roll !== 'number'
  )
    return null

  return {
    id: identity[1],
    lat,
    lng,
    heading,
    pitch,
    roll,
    label: labelNode[2]?.[0]?.[0] ?? ''
  }
}

export const discoverPanos = async (
  lat: number,
  lng: number,
  zoom = 17,
  radius = 1
): Promise<PanoSearchResponse> => {
  const center = latLngToTile(lat, lng, zoom)
  const tiles = tileNeighbors(center, radius)
  const payloads = await Promise.all(
    tiles.map(tile => fetchGoogleJson<unknown>(buildAutocompleteUrl(tile)))
  )
  const panos = new Map<string, PanoSummary>()

  payloads.forEach(payload => {
    visitArrays(payload, node => {
      const pano = parsePanoNode(node)

      if (!pano || panos.has(pano.id))
        return

      panos.set(pano.id, {
        ...pano,
        distanceMeters: haversineMeters(lat, lng, pano.lat, pano.lng)
      })
    })
  })

  return {
    query: { lat, lng, zoom, radius },
    tiles,
    panos: [...panos.values()].sort(
      (left, right) => left.distanceMeters - right.distanceMeters
    )
  }
}

export const getPanoDetail = async (panoId: string): Promise<PanoDetailResponse> => {
  const payload = (await fetchGoogleJson<unknown[]>(buildPhotometaUrl(panoId))) as any[]
  const root = payload[1]?.[0] as any[] | undefined
  const titleBlock = root?.[3]?.[2] ?? []
  const poseBlock = root?.[5]?.[0] as any[] | undefined
  const location = poseBlock?.[1] ?? []

  return {
    pano: {
      id: root?.[1]?.[1] ?? panoId,
      title: titleBlock[0]?.[0] ?? '',
      subtitle: titleBlock[1]?.[0] ?? '',
      lat: location[0]?.[2] ?? 0,
      lng: location[0]?.[3] ?? 0,
      heading: location[2]?.[0] ?? 0,
      pitch: location[2]?.[1] ?? 0,
      roll: location[2]?.[2] ?? 0,
      previewUrl: buildPanoTileProxyUrl(panoId, 0, 0, 0)
    }
  }
}

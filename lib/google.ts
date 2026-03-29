import type { TileRef } from './types'

const googleInit = {
  headers: { 'accept-language': 'en-CA,en;q=0.9', referer: 'https://www.google.com/maps', 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36' },
} as const

export const stripGooglePrefix = (text: string) => text.replace(/^\)\]\}'\n?/, '')

export const fetchGoogleText = async (url: string) => {
  const response = await fetch(url, googleInit)
  if (!response.ok) throw new Error(`google request failed: ${response.status} ${url}`)
  return response.text()
}

export const fetchGoogleBuffer = async (url: string) => {
  const response = await fetch(url, googleInit)
  if (!response.ok) throw new Error(`google request failed: ${response.status} ${url}`)
  return new Uint8Array(await response.arrayBuffer())
}

export const fetchGoogleJson = async <T>(url: string) =>
  JSON.parse(stripGooglePrefix(await fetchGoogleText(url))) as T

export const proxyGoogle = async (url: string) => {
  const res = await fetch(url, googleInit)
  const ct = res.headers.get('content-type')

  return new Response(await res.arrayBuffer(), { status: res.status, headers: { 'content-type': ct ?? '' } })
}

export const latLngToTile = (lat: number, lng: number, zoom: number): TileRef => {
  const scale = 2 ** zoom
  lat = (lat * Math.PI) / 180
  const x = Math.floor(((lng + 180) / 360) * scale)
  const y = Math.floor(((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * scale)

  return { x, y, z: zoom }
}

export const tileNeighbors = ({ x, y, z }: TileRef, radius: number) => {
  const tiles: TileRef[] = []

  for (let dy = -radius; dy <= radius; dy += 1)
    for (let dx = -radius; dx <= radius; dx += 1)
      tiles.push({ x: x + dx, y: y + dy, z })

  return tiles
}

export const haversineMeters = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const radians = (value: number) => (value * Math.PI) / 180
  const R = 6371000
  const dLat = radians(lat2 - lat1), dLng = radians(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export const readNumber = (value: string | null, name: string) => {
  if (!Number.isFinite(Number(value))) throw new Error(`invalid ${name}: ${value}`)
  return Number(value)
}

export const readParamNumbers = (url: URL, params: string[]): Record<string, number> =>
  params.reduce((acc, i: string) => ({ ...acc, [i]: readNumber(url.searchParams.get(i), i) }), {})
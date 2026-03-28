import type { TileRef } from './types'

const googleUserAgent =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const googleHeaders = {
  'accept-language': 'en-CA,en;q=0.9',
  referer: 'https://www.google.com/maps',
  'user-agent': googleUserAgent
}

export const stripGooglePrefix = (text: string) => text.replace(/^\)\]\}'\n?/, '')

export const fetchGoogleText = async (url: string) => {
  const response = await fetch(url, {
    headers: googleHeaders,
    cache: 'no-store'
  })

  if (!response.ok)
    throw new Error(`google request failed: ${response.status} ${url}`)

  return response.text()
}

export const fetchGoogleBuffer = async (url: string) => {
  const response = await fetch(url, {
    headers: googleHeaders,
    cache: 'no-store'
  })

  if (!response.ok)
    throw new Error(`google request failed: ${response.status} ${url}`)

  return new Uint8Array(await response.arrayBuffer())
}

export const fetchGoogleJson = async <T>(url: string) =>
  JSON.parse(stripGooglePrefix(await fetchGoogleText(url))) as T

export const proxyGoogle = async (url: string) => {
  const response = await fetch(url, {
    headers: googleHeaders,
    cache: 'no-store'
  })

  return new Response(await response.arrayBuffer(), {
    status: response.status,
    headers: {
      'content-type':
        response.headers.get('content-type') ?? 'application/octet-stream'
    }
  })
}

export const latLngToTile = (lat: number, lng: number, zoom: number): TileRef => {
  const scale = 2 ** zoom
  const latitude = (lat * Math.PI) / 180
  const x = Math.floor(((lng + 180) / 360) * scale)
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latitude) + 1 / Math.cos(latitude)) / Math.PI) / 2) *
      scale
  )

  return { x, y, z: zoom }
}

export const tileNeighbors = ({ x, y, z }: TileRef, radius: number) => {
  const tiles: TileRef[] = []

  for (let dy = -radius; dy <= radius; dy += 1)
    for (let dx = -radius; dx <= radius; dx += 1)
      tiles.push({ x: x + dx, y: y + dy, z })

  return tiles
}

export const haversineMeters = (
  leftLat: number,
  leftLng: number,
  rightLat: number,
  rightLng: number
) => {
  const toRadians = (value: number) => (value * Math.PI) / 180
  const earthRadius = 6371000
  const dLat = toRadians(rightLat - leftLat)
  const dLng = toRadians(rightLng - leftLng)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(leftLat)) *
      Math.cos(toRadians(rightLat)) *
      Math.sin(dLng / 2) ** 2

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export const readNumber = (
  value: string | null,
  name: string,
  fallback?: number
) => {
  if (value === null) {
    if (fallback !== undefined)
      return fallback

    throw new Error(`missing ${name}`)
  }

  const parsed = Number(value)

  if (!Number.isFinite(parsed))
    throw new Error(`invalid ${name}`)

  return parsed
}

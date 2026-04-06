import type { XYZ } from './types'

const g = {
  headers: { 'accept-language': 'en-CA,en;q=0.9', referer: 'https://www.google.com/maps', 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36' },
} as const
const cc = { 'cache-control': 's-maxage=604800' }

export const fetchGoogleBuffer = async (url: string) => {
  const r = await fetch(url, g)
  if (!r.ok) throw new Error(`google request failed: ${r.status} ${url}`)
  return new Uint8Array(await r.arrayBuffer())
}

export const fetchGoogleJson = async <T>(url: string) =>
  JSON.parse((await fetch(url, g).then(async r => {
    if (!r.ok) throw new Error(`google request failed: ${r.status} ${url}`)
    return r.text()
  })).replace(/^\)\]\}'\n?/, '')) as T

export const proxyGoogle = async (url: string) => {
  const r = await fetch(url, g)
  const ct = r.headers.get('content-type')

  return new Response(await r.arrayBuffer(), { status: r.status, headers: { 'content-type': ct ?? '', ...cc } })
}

export const json = (body: unknown) => Response.json(body, { headers: cc })

export const bytes = (body: BodyInit, contentType: string) =>
  new Response(body, { headers: { 'content-type': contentType, ...cc } })

export const latLngToTile = (lat: number, lng: number, zoom: number): XYZ => {
  const n = 2 ** zoom
  lat = (lat * Math.PI) / 180
  const x = Math.floor(((lng + 180) / 360) * n)
  const y = Math.floor(((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * n)

  return { x, y, z: zoom }
}

export const tileNeighbors = ({ x, y, z }: XYZ, r: number) => {
  const tiles: XYZ[] = []

  for (let dy = -r; dy <= r; dy += 1)
    for (let dx = -r; dx <= r; dx += 1)
      tiles.push({ x: x + dx, y: y + dy, z })

  return tiles
}

export const haversineMeters = (a: number, b: number, c: number, d: number) => {
  const r = (n: number) => n * Math.PI / 180
  const da = r(c - a), db = r(d - b)
  const x = Math.sin(da / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(db / 2) ** 2
  return 12742000 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

export const readNumber = (value: string | null, name: string) => {
  if (!Number.isFinite(Number(value))) throw new Error(`invalid ${name}: ${value}`)
  return Number(value)
}

export const readParamNumbers = (url: URL, names: string[]): Record<string, number> =>
  Object.fromEntries(names.map(k => [k, readNumber(url.searchParams.get(k), k)]))

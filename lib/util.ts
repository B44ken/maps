const { cos, tan, floor, sqrt, log, pow, max, PI: pi } = Math, r = pi/180

export const dist = (a: number, b: number, c: number, d: number) => sqrt((c-a)**2 + ((d-b) * cos(r*a))**2) * 111_319

export const distBox = (lat: number, lng: number, [n, s, w, e]: number[]) => sqrt(max(0, s-lat, lat-n)**2 + (max(0, w-lng, lng-e) * cos(r*lat))**2) * 111_319

const gh = { headers: { 'accept-language': 'en-CA', referer: 'https://google.com', 'user-agent': 'Mozilla/5.0; Chrome/136.0.0.0' } }
export const fetchJson = async <T>(url: string): Promise<T> => JSON.parse((await fetch(url, gh).then(r => r.text())).replace(/^\)\]\}'\n?/, '')) as T
export const fetchBuffer = async (url: string) => fetch(url, gh).then(r => r.arrayBuffer()).then(b => new Uint8Array(b))

export const json = (body: unknown) => Response.json(body, { headers: { 'cache-control': 's-maxage=604800' } })
export const bytes = (body: BodyInit, ct: string) => new Response(body, { headers: { 'content-type': ct, 'cache-control': 's-maxage=604800' } })

export const readNumbers = (url: string, ...names: string[]): Record<string, number> => {
  const usp = new URLSearchParams(new URL(url).search)
  return names.reduce((a, n) =>  ({ ...a, [n]: usp.get(n) == null ? undefined : Number(usp.get(n)) }), {})
}
import { json, readNumbers } from '@/lib/util'
import { discoverPanos } from '@/lib/panos'

export async function GET({ url }: { url: string }) {
  const { lat, lng, zoom = 17 } = readNumbers(url, 'lat', 'lng', 'zoom')
  return json(await discoverPanos(lat, lng, zoom))
}

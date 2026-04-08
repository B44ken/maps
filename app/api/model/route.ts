import { json, readNumbers } from '@/lib/google'
import { discoverAt } from '@/lib/model'

export async function GET({ url }: { url: string }) {
  const { lat, lng, size = 17, depth = 20 } = readNumbers(url, 'lat', 'lng', 'size', 'depth')
  const octants = await discoverAt(lat, lng, size, depth)
  return octants.length ? json({ octants }) : Response.json({}, { status: 404 })
}

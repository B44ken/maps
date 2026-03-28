import { readNumber } from '@/lib/google'
import { discoverPanos } from '@/lib/panos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const lat = readNumber(url.searchParams.get('lat'), 'lat')
  const lng = readNumber(url.searchParams.get('lng'), 'lng')
  const zoom = readNumber(url.searchParams.get('zoom'), 'zoom', 17)
  const radius = readNumber(url.searchParams.get('radius'), 'radius', 1)

  return Response.json(await discoverPanos(lat, lng, Math.trunc(zoom), Math.trunc(radius)))
}

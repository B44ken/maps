import { readNumber } from '@/lib/google'
import { discoverModel } from '@/lib/model'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const lat = readNumber(url.searchParams.get('lat'), 'lat')
  const lng = readNumber(url.searchParams.get('lng'), 'lng')
  const meters = readNumber(url.searchParams.get('meters'), 'meters', 295)

  return Response.json(await discoverModel(lat, lng, meters))
}

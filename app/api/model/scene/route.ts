import { readNumber } from '@/lib/google'
import { discoverModelScene } from '@/lib/model-scene'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const lat = readNumber(url.searchParams.get('lat'), 'lat')
  const lng = readNumber(url.searchParams.get('lng'), 'lng')
  const meters = readNumber(url.searchParams.get('meters'), 'meters', 295)
  const includeAncestors = !!readNumber(
    url.searchParams.get('includeAncestors'),
    'includeAncestors',
    0
  )

  return Response.json(await discoverModelScene(lat, lng, meters, includeAncestors))
}

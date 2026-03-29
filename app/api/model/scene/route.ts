import { readParamNumbers } from '@/lib/google'
import { discoverModelScene } from '@/lib/model-scene'
export const runtime = 'nodejs',  dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const { lat, lng, meters } = readParamNumbers(url, ['lat', 'lng', 'meters'])
  return Response.json(await discoverModelScene(lat, lng, meters))
}

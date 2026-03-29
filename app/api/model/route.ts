import { readParamNumbers } from '@/lib/google'
import { discoverModel } from '@/lib/model'
export const runtime = 'nodejs',  dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { lat, lng, meters } = readParamNumbers(new URL(request.url), ['lat', 'lng', 'meters'])
  return Response.json(await discoverModel(lat, lng, meters))
}

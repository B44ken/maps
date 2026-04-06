import { json, readParamNumbers } from '@/lib/google'
import { discoverPanos } from '@/lib/panos'
export const runtime = 'nodejs', dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { lat, lng, zoom, radius } = readParamNumbers(new URL(request.url), ['lat', 'lng', 'radius'])
  return json(await discoverPanos(lat, lng, 17, Math.trunc(radius)))
}

import { readParamNumbers } from '@/lib/google'
import { discoverPanos } from '@/lib/panos'
export const runtime = 'nodejs', dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { lat, lng, zoom, radius } = readParamNumbers(new URL(request.url), ['lat', 'lng', 'zoom', 'radius'])
  return Response.json(await discoverPanos(lat, lng, Math.trunc(zoom), Math.trunc(radius)))
}

import { json, readParamNumbers } from '@/lib/google'
import { discoverModel } from '@/lib/model'

export async function GET(request: Request) {
  const { lat, lng, depth } = readParamNumbers(new URL(request.url), ['lat', 'lng', 'depth'])
  return json(await discoverModel(lat, lng, depth || 17))
}
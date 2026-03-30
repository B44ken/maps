import { json, readParamNumbers } from '@/lib/google'
import { discoverModel } from '@/lib/model'

export async function GET(request: Request) {
  const { lat, lng } = readParamNumbers(new URL(request.url), ['lat', 'lng'])
  return json(await discoverModel(lat, lng))
}
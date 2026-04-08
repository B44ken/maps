import { readNumbers } from '@/lib/google'
import { discoverAt } from '@/lib/model'

export const GET = async ({ url }: { url: string }) => {
  const { lat, lng, size = 17, depth = 20 } = readNumbers(url, 'lat', 'lng', 'size', 'depth')
  const ocs = await discoverAt(lat, lng, size, depth)
  return new Response(null, ocs.length ? { status: 301, headers: { location: `/model/${ocs.join(',')}?lat=${lat}&lng=${lng}&depth=${depth}` } } : { status: 404, statusText: 'no model data here?' })
}

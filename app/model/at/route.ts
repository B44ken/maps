import { readNumbers } from '@/lib/util'
import { discoverNear, discoverOctants } from '@/lib/model'
import { modelGlb } from '@/lib/export'

export const GET = async ({ url }: { url: string }) => {
  const { lat, lng, depth = 17, r = 250 } = readNumbers(url, 'lat', 'lng', 'depth', 'r', 'start')
  const ocs = await discoverNear(lat, lng, depth, r)
  if(!ocs.length) return new Response(null, { status: 404, statusText: 'no model data here?' })
  const model = await discoverOctants(ocs, depth, lat, lng)
  if (!model.nodes.length) return new Response('not found', { status: 404 })
  return new Response(await modelGlb(model), { headers: { 'Content-Type': 'model/gltf-binary' } })
}
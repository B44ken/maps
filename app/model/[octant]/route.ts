import { bytes, readNumbers } from '@/lib/google'
import { modelGlb } from '@/lib/export'
import { discoverOctant } from '@/lib/model'

export const GET = async (request: Request, context: any) => {
  const octant = (await context.params).octant as string
  const { depth = 20, lat, lng } = readNumbers(request.url, 'depth', 'lat', 'lng')
  const model = await discoverOctant(octant, depth, lat, lng)
  if (!model.nodes.length) return new Response('not found', { status: 404 })
  return bytes((await modelGlb(model))!, 'model/gltf-binary')
}

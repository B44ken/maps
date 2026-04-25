import { bytes, readNumbers } from '@/lib/util'
import { modelGlb } from '@/lib/export'
import { discoverOctants } from '@/lib/model'

export const GET = async (request: Request, context: any) => {
  const octants = (await context.params).octant.split(',')
  const { depth = 20, lat, lng } = readNumbers(request.url, 'depth', 'lat', 'lng')
  const model = await discoverOctants(octants, depth, lat, lng)
  if (!model.nodes.length) return new Response('not found', { status: 404 })
  return bytes((await modelGlb(model))!, 'model/gltf-binary')
}
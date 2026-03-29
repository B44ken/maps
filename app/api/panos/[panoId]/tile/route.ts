import { proxyGoogle, readParamNumbers } from '@/lib/google'
import { buildPanoTileUrl } from '@/lib/panos'
export const runtime = 'nodejs', dynamic = 'force-dynamic'

export async function GET(request: Request,context: { params: Promise<{ panoId: string }> }) {
  const { panoId } = await context.params
  const { zoom, x, y } = readParamNumbers(new URL(request.url), ['zoom', 'x', 'y'])
  return proxyGoogle(buildPanoTileUrl(panoId, Math.trunc(zoom), Math.trunc(x), Math.trunc(y)))
}

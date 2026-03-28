import { proxyGoogle, readNumber } from '@/lib/google'
import { buildPanoTileUrl } from '@/lib/panos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  context: { params: Promise<{ panoId: string }> }
) {
  const url = new URL(request.url)
  const { panoId } = await context.params
  const zoom = readNumber(url.searchParams.get('zoom'), 'zoom', 0)
  const x = readNumber(url.searchParams.get('x'), 'x', 0)
  const y = readNumber(url.searchParams.get('y'), 'y', 0)

  return proxyGoogle(
    buildPanoTileUrl(panoId, Math.trunc(zoom), Math.trunc(x), Math.trunc(y))
  )
}

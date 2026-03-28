import { proxyGoogle, readNumber } from '@/lib/google'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  context: { params: Promise<{ nodeId: string }> }
) {
  const url = new URL(request.url)
  const { nodeId } = await context.params
  const version = readNumber(url.searchParams.get('version'), 'version', 1007)

  return proxyGoogle(
    `https://kh.google.com/rt/earth/BulkMetadata/pb=!1m2!1s${nodeId}!2u${Math.trunc(version)}`
  )
}

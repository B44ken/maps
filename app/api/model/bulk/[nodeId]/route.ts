import { proxyGoogle, readParamNumbers } from '@/lib/google'
export const runtime = 'nodejs', dynamic = 'force-dynamic'

export async function GET(request: Request,context: { params: Promise<{ nodeId: string }> }) {
  const { nodeId } = await context.params
  const { version } = readParamNumbers(new URL(request.url), ['version'])
  return proxyGoogle(`https://kh.google.com/rt/earth/BulkMetadata/pb=!1m2!1s${nodeId}!2u${Math.trunc(version)}`)
}

import { proxyGoogle, readNumber, readParamNumbers } from '@/lib/google'
export const runtime = 'nodejs', dynamic = 'force-dynamic'

export async function GET(request: Request,context: { params: Promise<{ nodeId: string }> }) {
  const url = new URL(request.url)
  const { searchParams } = url
  const { nodeId } = await context.params
  const { version, textureFormat } = readParamNumbers(url, ['version', 'textureFormat'])
  const ie = searchParams.get('imageryEpoch')
  const ieValue = ie === null ? '' : `!3u${Math.trunc(readNumber(ie, 'imageryEpoch'))}`

  return proxyGoogle(`https://kh.google.com/rt/earth/NodeData/pb=!1m2!1s${nodeId}!2u${Math.trunc(version)}!2e${Math.trunc(textureFormat)}${ieValue}!4b0`)
}
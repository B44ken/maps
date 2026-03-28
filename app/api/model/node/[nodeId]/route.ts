import { proxyGoogle, readNumber } from '@/lib/google'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  context: { params: Promise<{ nodeId: string }> }
) {
  const url = new URL(request.url)
  const { nodeId } = await context.params
  const version = readNumber(url.searchParams.get('version'), 'version', 973)
  const textureFormat = readNumber(
    url.searchParams.get('textureFormat'),
    'textureFormat',
    6
  )
  const imageryEpochValue = url.searchParams.get('imageryEpoch')
  const imageryEpoch =
    imageryEpochValue === null
      ? ''
      : `!3u${Math.trunc(readNumber(imageryEpochValue, 'imageryEpoch'))}`

  return proxyGoogle(
    `https://kh.google.com/rt/earth/NodeData/pb=!1m2!1s${nodeId}!2u${Math.trunc(
      version
    )}!2e${Math.trunc(textureFormat)}${imageryEpoch}!4b0`
  )
}

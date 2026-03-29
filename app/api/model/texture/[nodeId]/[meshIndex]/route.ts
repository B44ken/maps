import { readNumber, readParamNumbers } from '@/lib/google'
import { buildNodeUrl } from '@/lib/model'
import { decodeModelTexture } from '@/lib/model-texture'
import type { ModelPacket } from '@/lib/types'
export const runtime = 'nodejs', dynamic = 'force-dynamic'

export async function GET(request: Request,context: { params: Promise<{ nodeId: string; meshIndex: string }> }) {
  const { nodeId, meshIndex } = await context.params
  const url = new URL(request.url)
  const mesh = Math.trunc(Number(meshIndex))
  const { version, textureFormat } = readParamNumbers(url, ['version', 'textureFormat'])
  const ie = url.searchParams.get('imageryEpoch')
  const imageryEpoch = ie === null ? undefined : readNumber(ie, 'imageryEpoch')

  const packet: ModelPacket = {
    id: nodeId, version, textureFormat, imageryEpoch, proxyUrl: '',
    url: buildNodeUrl(nodeId, version, textureFormat, imageryEpoch)
  }

  const texture = await decodeModelTexture(packet, mesh)
  return new Response(Uint8Array.from(texture.buffer), { headers: { 'content-type': texture.contentType} })
}

import { readNumber } from '@/lib/google'
import { buildNodeUrl } from '@/lib/model'
import { decodeModelTexture } from '@/lib/model-texture'
import type { ModelPacket } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  context: { params: Promise<{ nodeId: string; meshIndex: string }> }
) {
  const { nodeId, meshIndex } = await context.params
  const url = new URL(request.url)
  const mesh = Math.trunc(Number(meshIndex))
  const version = readNumber(url.searchParams.get('version'), 'version')
  const textureFormat = readNumber(url.searchParams.get('textureFormat'), 'textureFormat', 6)
  const imageryEpochValue = url.searchParams.get('imageryEpoch')
  const imageryEpoch =
    imageryEpochValue === null ? undefined : readNumber(imageryEpochValue, 'imageryEpoch')

  const packet: ModelPacket = {
    id: nodeId,
    version,
    textureFormat,
    imageryEpoch,
    url: buildNodeUrl(nodeId, version, textureFormat, imageryEpoch),
    proxyUrl: ''
  }

  const texture = await decodeModelTexture(packet, mesh)
  const body = Uint8Array.from(texture.buffer)

  return new Response(body, {
    headers: {
      'content-type': texture.contentType
    }
  })
}

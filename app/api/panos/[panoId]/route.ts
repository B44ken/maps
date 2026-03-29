import { json } from '@/lib/google'
import { getPanoDetail } from '@/lib/panos'
export const runtime = 'nodejs', dynamic = 'force-dynamic'

export async function GET(_request: Request,context: { params: Promise<{ panoId: string }> }) {
  const { panoId } = await context.params
  return json({ pano: await getPanoDetail(panoId) })
}

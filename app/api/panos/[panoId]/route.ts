import { getPanoDetail } from '@/lib/panos'
export const runtime = 'nodejs', dynamic = 'force-dynamic'

export async function GET(_request: Request,context: { params: Promise<{ panoId: string }> }) {
  const { panoId } = await context.params
  return Response.json(await getPanoDetail(panoId))
}

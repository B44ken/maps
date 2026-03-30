import { proxyGoogle } from '@/lib/google'

export const GET = async (_: any, context: { params: Promise<{ i: string }> }) =>
  proxyGoogle(`https://kh.google.com/rt/earth/NodeData/pb=!1m2!1s${(await context.params).i}!2u!2e6!4b0`)
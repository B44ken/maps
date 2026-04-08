import { bytes, readNumbers } from '@/lib/google'
import { panoJpg } from 'lib/export'

export const GET = async ({ url }: Request, { params }: { params: Promise<{ id: string }> }) =>
    panoJpg((await params).id, readNumbers(url, 'zoom').zoom ?? 5).then(j => bytes(j, 'image/jpeg'))
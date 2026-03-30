import { proxyGoogle, readParamNumbers } from "@/lib/google";

export const GET = async (req: Request, context: { params: Promise<{ i: string }> }) => {
    const { i } = await context.params
    const { zoom, x, y } = readParamNumbers(new URL(req.url), ['zoom', 'x', 'y'])
    return proxyGoogle(`https://streetviewpixels-pa.googleapis.com/v1/tile?cb_client=maps_sv.tactile&panoid=${i}&x=${x}&y=${y}&zoom=${zoom}&nbt=1&fover=2`)
}
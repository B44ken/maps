import { D } from "b44ui"
import { RefObject, useEffect, useRef, useState } from "react"

export const PanoViewer = ({ id, zoom, loader }: { id: string, zoom: number, loader: RefObject<HTMLCanvasElement> }) => {
    const sX = 2**zoom, sY = Math.ceil(2**(zoom-1)), scale = 256
    const viewer = useRef<HTMLCanvasElement>(null!)
    const [view, setView] = useState<{ x: number, y: number, w: number, h: number }>({ x: 0.4, y: 0.4, w: 0.2, h: 0.2 })

    const mouse = (ev: React.MouseEvent) =>
        setView(v => ev.buttons == 0 ? v : {x: v.x + ev.movementX / (sX * scale), y: v.y + ev.movementY / (sY * scale), w: v.w, h: v.h})

    useEffect(() => {
        const ctxL = loader.current.getContext('2d')!
        const images = Array.from({length: sY}).map((_, y) => Array.from({length: sX}).map((_, x) => `/api/panos/${id}?zoom=${zoom}&x=${x}&y=${y}`))
        let pending = images.length * images[0].length
        images.forEach((row, y) => row.forEach((src, x) => {
            const img = new Image()
            img.src = src
            img.onload = () => {
                ctxL.drawImage(img, x*scale, y*scale, scale, scale)
                if(pending-- == 1) setView({ x: 0.4, y: 0.4, w: 0.2, h: 0.2 })
            }
        }))
    }, [id, zoom])

    useEffect(() => {
        const ctxV = viewer.current.getContext('2d')!, cvw = viewer.current.width, cvh = viewer.current.height
        ctxV.clearRect(0, 0, cvw, cvh)
        ctxV.drawImage(loader.current, view.x*sX*scale, view.y*sY*scale, view.w*sX*scale, view.h*sY*scale, 0, 0, cvw, cvh)
    }, [view])

    return <D>
        <canvas onMouseMove={mouse} ref={viewer} height={innerWidth/2} width={innerWidth} style={{display: 'block', aspectRatio: '2/1' }} />
        <canvas width={sX * scale} height={sY * scale} ref={loader} style={{display: 'none'}} />
    </D>
}
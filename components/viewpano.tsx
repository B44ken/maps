import { useEffect, useRef, useState } from 'react'

export const PanoViewer = ({ src, zoom = 2 }: { src: string, zoom?: number }) => {
  const cvs = useRef<HTMLCanvasElement>(null!), img = useRef(new Image()), ctx = cvs.current?.getContext('2d'), ic = img.current
  const [{ x, y, w, h }, move] = useState({ x: 0, y: 0, w: 0, h:0 })

  ic.addEventListener('load', () => move({ x: -ic.width, y: -ic.height, w: zoom*ic.width, h: zoom*ic.height }))
  useEffect(() => { ic.src = src }, [src])
  useEffect(() => void (w && ctx?.drawImage(ic, x, y, w, h)), [x, y])

  const mouse = (ev: React.MouseEvent) => move(v => ev.buttons == 0 ? v : { ...v, x: v.x + zoom*ev.movementX, y: v.y + zoom*ev.movementY })
  return <canvas ref={cvs} width={1600} height={800} onMouseMove={mouse} style={{ display: 'block', width: '100%', aspectRatio: '2/1', cursor: 'grab' }} />
}
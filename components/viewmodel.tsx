'use client'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { buildModelScene, latLngToModel, wgs84Height } from '@/lib/model-scene'
import type { Model, Pano } from '@/lib/types'

const tex = (x: { data: Uint8Array, w: number, h: number }) => {
  const t = new THREE.DataTexture(x.data, x.w, x.h, THREE.RGBAFormat)
  t.colorSpace = 'srgb', t.needsUpdate = true
  return t
}

export function ModelViewer({ model, panos, panoId, world, fetches }: { model: Model; panos: Pano[]; panoId: string | null; world: React.RefObject<THREE.Scene>; fetches: Record<string, number> }) {
  const ref = useRef<HTMLDivElement>(null!), camRef = useRef<THREE.PerspectiveCamera | null>(null), controlRef = useRef<OrbitControls | null>(null)
  const focusPano = () => {
    if(!panoId || !camRef.current || !controlRef.current) return
    const pano = panos.find(p => p.id == panoId)
    if(!pano) return

    const [x, , z] = latLngToModel(model.query.lat, model.query.lng, pano.lat, pano.lng)
    const cam = camRef.current, control = controlRef.current
    const y = control.target.y + wgs84Height(pano.lat) - wgs84Height(model.query.lat) + pano.height
    const dx = cam.position.x - control.target.x, dy = cam.position.y - control.target.y, dz = cam.position.z - control.target.z

    control.target.set(x, control.target.y, z)
    cam.position.set(x + dx, y + dy, z + dz)
    cam.lookAt(control.target)
  }
  
  useEffect(() => {
    const host = ref.current
    let frame = 0
    const geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [], texts: THREE.Texture[] = []

    host.replaceChildren()

    void (async () => {
      const meshes = await buildModelScene(model, fetches)

      world.current = new THREE.Scene()
      const cam = new THREE.PerspectiveCamera(), render = new THREE.WebGLRenderer(), control = new OrbitControls(cam, render.domElement)
      camRef.current = cam
      controlRef.current = control
      host.replaceChildren(render.domElement)

      for (const mesh of meshes) {
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3))
        g.setIndex(new THREE.BufferAttribute(mesh.indices, 1))

        if (mesh.uvs) g.setAttribute('uv', new THREE.BufferAttribute(mesh.uvs, 2))

        const m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
        m.map = tex(mesh.texture)
        texts.push(m.map)

        geos.push(g)
        mats.push(m)
        world.current.add(new THREE.Mesh(g, m))
      }

      const box = new THREE.Box3().setFromObject(world.current)
      const c = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3()).length() || 200

      control.target.copy(c)
      cam.position.set(c.x + size * 0.7, c.y + size * 0.45, c.z + size)
      focusPano()

      render.setSize(750 * window.devicePixelRatio, 650 * window.devicePixelRatio, false)

      const tick = () => {
        control.update()
        render.render(world.current, cam)
        frame = requestAnimationFrame(tick)
      }
      tick()
    })()

    return () => {
      cancelAnimationFrame(frame)
      camRef.current = controlRef.current = null
      host.replaceChildren()
    }
  }, [model, panos])

  useEffect(() => {
    focusPano()
  }, [panoId])

  return <>
    <style>{`canvas { width: 100%; }`}</style>
    <div ref={ref} />
  </>
}

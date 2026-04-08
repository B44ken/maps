'use client'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

import { latLngToModel, wgs84Height } from '@/lib/model-space'
import type { Pano } from '@/lib/panos'

const disposeMaterial = (mat: THREE.Material) => {
  Object.values(mat).forEach(v => (v instanceof THREE.Texture) && v.dispose())
  mat.dispose()
}

const disposeObject = (root: THREE.Object3D) =>
  root.traverse(x => {
    if (!(x instanceof THREE.Mesh)) return
    x.geometry.dispose()
    Array.isArray(x.material) ? x.material.forEach(disposeMaterial) : disposeMaterial(x.material)
  })

export function ModelViewer({ src, lat, lng, pano }: { src: string, lat: number, lng: number, pano?: Pano }) {
  const ref = useRef<HTMLDivElement>(null!)
  const camRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlRef = useRef<OrbitControls | null>(null)

  const focusPano = () => {
    if (!pano || !camRef.current || !controlRef.current) return

    const [x, , z] = latLngToModel(lat, lng, pano.lat, pano.lng)
    const cam = camRef.current, control = controlRef.current
    const y = control.target.y + wgs84Height(pano.lat) - wgs84Height(lat) + pano.height
    const dx = cam.position.x - control.target.x, dy = cam.position.y - control.target.y, dz = cam.position.z - control.target.z

    control.target.set(x, control.target.y, z)
    cam.position.set(x + dx, y + dy, z + dz)
    cam.lookAt(control.target)
  }
  
  useEffect(() => {
    const host = ref.current, scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(45, 75/65, 10, 10_000), render = new THREE.WebGLRenderer(), control = new OrbitControls(cam, render.domElement)
    let frame = 0, object: THREE.Object3D, live = true

    camRef.current = cam
    controlRef.current = control
    host.replaceChildren()
    host.replaceChildren(render.domElement)
    render.setSize(750 * window.devicePixelRatio, 650 * window.devicePixelRatio, false)

    void (async () => {
      object = (await new GLTFLoader().loadAsync(src)).scene
      if (!live) return disposeObject(object)

      scene.add(object)
      const box = new THREE.Box3().setFromObject(object)
      const c = box.getCenter(new THREE.Vector3())
      const radius = box.getSize(new THREE.Vector3()).length() || 200

      control.target.copy(c)
      cam.position.set(c.x + radius * 0.7, c.y + radius * 0.45, c.z + radius)
      focusPano()

      const tick = () => {
        control.update()
        render.render(scene, cam)
        frame = requestAnimationFrame(tick)
      }
      tick()
    })()

    return () => {
      live = false
      cancelAnimationFrame(frame)
      controlRef.current?.dispose()
      object && disposeObject(object)
      render.dispose()
      camRef.current = null
      controlRef.current = null
      host.replaceChildren()
    }
  }, [src])

  useEffect(() => void focusPano(), [lat, lng, pano])

  return <> <style>{`canvas { width: 100%; }`}</style> <div ref={ref} /> </>
}

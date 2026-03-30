'use client'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { buildModelScene } from '@/lib/model-scene'
import type { ModelResponse } from '@/lib/types'

const tex = (x: Awaited<ReturnType<typeof buildModelScene>>[number]['texture']) => {
  const t = new THREE.DataTexture(x.data, x.w, x.h, THREE.RGBAFormat)
  t.colorSpace = THREE.SRGBColorSpace
  t.needsUpdate = true
  return t
}

export function ModelViewer({ model }: { model: ModelResponse }) {
  const ref = useRef<HTMLDivElement>(null!)

  useEffect(() => {
    const host = ref.current
    let dead = false, frame = 0
    const gs: THREE.BufferGeometry[] = [], ms: THREE.Material[] = [], ts: THREE.Texture[] = []
    const done: (() => void)[] = []

    host.replaceChildren()

    void (async () => {
      const meshes = await buildModelScene(model)
      if (dead) return

      const world = new THREE.Scene(), cam = new THREE.PerspectiveCamera(), render = new THREE.WebGLRenderer(), control = new OrbitControls(cam, render.domElement)
      done.push(control.dispose, render.dispose)

      host.replaceChildren(render.domElement)

      for (const mesh of meshes) {
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3))
        g.setIndex(new THREE.BufferAttribute(mesh.indices, 1))

        if (mesh.uvs)
          g.setAttribute('uv', new THREE.BufferAttribute(mesh.uvs, 2))

        const m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
        m.map = tex(mesh.texture)
        ts.push(m.map)

        gs.push(g)
        ms.push(m)
        world.add(new THREE.Mesh(g, m))
      }

      const box = new THREE.Box3().setFromObject(world)
      const c = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3()).length() || 200

      control.target.copy(c)
      cam.position.set(c.x + size * 0.7, c.y + size * 0.45, c.z + size)
      cam.near = Math.max(1, size / 500)
      cam.far = size * 10
      cam.lookAt(c)

      render.setSize(750, 750, false)

      const tick = () => {
        control.update()
        render.render(world, cam)
        frame = requestAnimationFrame(tick)
      }

      tick()
    })()

    return () => {
      dead = true
      cancelAnimationFrame(frame)
      done.forEach(f => f())
      ts.forEach(t => t.dispose())
      ms.forEach(m => m.dispose())
      gs.forEach(g => g.dispose())
      host.replaceChildren()
    }
  }, [model])

  return <div ref={ref} />
}

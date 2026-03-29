'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import type { ModelSceneResponse } from '@/lib/types'

const decodeFloat32 = (value: string) => {
  const bytes = Uint8Array.from(atob(value), char => char.charCodeAt(0))
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4)
}

const decodeUint32 = (value: string) => {
  const bytes = Uint8Array.from(atob(value), char => char.charCodeAt(0))
  return new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4)
}

export function ModelViewer({ scene }: { scene: ModelSceneResponse | null }) {
  const hostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!hostRef.current || !scene) return

    const host = hostRef.current
    const world = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera()
    const renderer = new THREE.WebGLRenderer()
    const controls = new OrbitControls(camera, renderer.domElement)
    const loader = new THREE.TextureLoader()
    const geometries: THREE.BufferGeometry[] = []
    const materials: THREE.Material[] = []
    const textures: THREE.Texture[] = []

    host.replaceChildren(renderer.domElement)

    for (const mesh of scene.meshes) {
      const geom = new THREE.BufferGeometry()
      geom.setAttribute('position', new THREE.BufferAttribute(decodeFloat32(mesh.positions), 3))
      geom.setIndex(new THREE.BufferAttribute(decodeUint32(mesh.indices), 1))

      if (mesh.uvs)
        geom.setAttribute('uv', new THREE.BufferAttribute(decodeFloat32(mesh.uvs), 2))

      const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })

      if (mesh.texture) {
        const texture = loader.load(mesh.texture.url)
        texture.colorSpace = THREE.SRGBColorSpace
        texture.flipY = false
        material.map = texture
        textures.push(texture)
      }

      geometries.push(geom)
      materials.push(material)
      world.add(new THREE.Mesh(geom, material))
    }

    const box = new THREE.Box3().setFromObject(world)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3()).length() || 200

    controls.target.copy(center)
    camera.position.set(center.x + size * 0.7, center.y + size * 0.45, center.z + size)
    camera.lookAt(center)

    renderer.setSize(750, 750, false)

    let frame = 0
    const tick = () => {
      controls.update()
      renderer.render(world, camera)
      frame = requestAnimationFrame(tick)
    }

    tick()

    return () => {
      cancelAnimationFrame(frame)
      controls.dispose()
      renderer.dispose()
      textures.forEach(texture => texture.dispose())
      materials.forEach(material => material.dispose())
      geometries.forEach(geometry => geometry.dispose())
      host.replaceChildren()
    }
  }, [scene])

  return <div ref={hostRef} style={{ width: '100%', aspectRatio: '3 / 2' }} />
}

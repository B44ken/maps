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
    if (!hostRef.current || !scene)
      return

    const host = hostRef.current
    const world = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 5000)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    const controls = new OrbitControls(camera, renderer.domElement)
    const root = new THREE.Group()
    const loader = new THREE.TextureLoader()
    const geometries: THREE.BufferGeometry[] = []
    const materials: THREE.Material[] = []
    const textures: THREE.Texture[] = []

    world.background = new THREE.Color('#efe7d9')
    world.add(new THREE.HemisphereLight('#fff7e8', '#9ca38f', 2))
    world.add(root)

    const light = new THREE.DirectionalLight('#fff7e8', 1.4)
    light.position.set(120, 220, 80)
    world.add(light)

    renderer.setPixelRatio(window.devicePixelRatio)
    host.innerHTML = ''
    host.appendChild(renderer.domElement)

    for (const mesh of scene.meshes) {
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(decodeFloat32(mesh.positions), 3))
      geometry.setIndex(new THREE.BufferAttribute(decodeUint32(mesh.indices), 1))

      if (mesh.uvs)
        geometry.setAttribute('uv', new THREE.BufferAttribute(decodeFloat32(mesh.uvs), 2))

      geometry.computeVertexNormals()

      const material = mesh.texture
        ? new THREE.MeshBasicMaterial({ color: '#fff', side: THREE.DoubleSide })
        : new THREE.MeshStandardMaterial({
            color: '#d8c8ab',
            roughness: 0.92,
            metalness: 0,
            side: THREE.DoubleSide
          })

      if (mesh.texture) {
        const texture = loader.load(mesh.texture.url)
        texture.colorSpace = THREE.SRGBColorSpace
        texture.flipY = false
        material.map = texture
        textures.push(texture)
      }

      geometries.push(geometry)
      materials.push(material)
      root.add(new THREE.Mesh(geometry, material))
    }

    const box = new THREE.Box3().setFromObject(root)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3()).length() || 200

    controls.target.copy(center)
    controls.enableDamping = true
    controls.maxDistance = size * 6
    camera.position.set(center.x + size * 0.7, center.y + size * 0.45, center.z + size)
    camera.lookAt(center)

    const resize = () => {
      const width = host.clientWidth
      const height = host.clientHeight
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(host)

    let frame = 0

    const tick = () => {
      controls.update()
      renderer.render(world, camera)
      frame = requestAnimationFrame(tick)
    }

    tick()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      controls.dispose()
      renderer.dispose()
      textures.forEach(texture => texture.dispose())
      materials.forEach(material => material.dispose())
      geometries.forEach(geometry => geometry.dispose())
      host.innerHTML = ''
    }
  }, [scene])

  return <div className="viewer" ref={hostRef} />
}

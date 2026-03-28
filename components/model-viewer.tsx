'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import type { ModelSceneResponse, ModelSceneTexture } from '@/lib/types'

const decodeFloat32 = (value: string) => {
  const bytes = Uint8Array.from(atob(value), char => char.charCodeAt(0))
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4)
}

const decodeUint32 = (value: string) => {
  const bytes = Uint8Array.from(atob(value), char => char.charCodeAt(0))
  return new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4)
}

const earthRadius = 6378137

const toRadians = (value: number) => (value * Math.PI) / 180

const toLocalBounds = (
  lat: number,
  lng: number,
  bounds: { north: number; south: number; east: number; west: number }
) => {
  const latScale = (Math.PI * earthRadius) / 180
  const lngScale = latScale * Math.cos(toRadians(lat))
  const west = (bounds.west - lng) * lngScale
  const east = (bounds.east - lng) * lngScale
  const north = -(bounds.north - lat) * latScale
  const south = -(bounds.south - lat) * latScale

  return {
    centerX: (west + east) / 2,
    centerZ: (north + south) / 2,
    width: Math.max(1, east - west),
    depth: Math.max(1, south - north)
  }
}

const createTexture = (
  source: ModelSceneTexture,
  loader: THREE.TextureLoader,
  onLoad: () => void
) => {
  const texture = loader.load(source.url, onLoad)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.flipY = source.flipY
  return texture
}

type Props = {
  scene: ModelSceneResponse | null
  bounds?: {
    north: number
    south: number
    east: number
    west: number
  }
}

export function ModelViewer({ scene, bounds }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!hostRef.current || !scene)
      return

    const host = hostRef.current
    const world = new THREE.Scene()
    world.background = new THREE.Color(bounds ? '#ffffff' : '#f6efe3')

    const camera = bounds
      ? new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 5000)
      : new THREE.PerspectiveCamera(50, 1, 0.1, 5000)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    const controls = bounds ? null : new OrbitControls(camera, renderer.domElement)
    const root = new THREE.Group()
    const textureLoader = new THREE.TextureLoader()
    const geometries: THREE.BufferGeometry[] = []
    const materials: THREE.Material[] = []
    const textures: THREE.Texture[] = []

    renderer.setPixelRatio(window.devicePixelRatio)
    host.innerHTML = ''
    host.appendChild(renderer.domElement)

    world.add(root)

    if (!bounds) {
      world.add(new THREE.HemisphereLight('#fff3d8', '#9ca38f', 2.2))

      const light = new THREE.DirectionalLight('#fff7e8', 1.6)
      light.position.set(120, 220, 80)
      world.add(light)

      const grid = new THREE.GridHelper(600, 24, '#c49d78', '#dbc8b0')
      grid.position.y = -1
      world.add(grid)
    }

    const render = () => renderer.render(world, camera)

    for (const mesh of scene.meshes) {
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(decodeFloat32(mesh.positions), 3)
      )
      geometry.setIndex(new THREE.BufferAttribute(decodeUint32(mesh.indices), 1))

      if (mesh.normals)
        geometry.setAttribute('normal', new THREE.BufferAttribute(decodeFloat32(mesh.normals), 3))
      else
        geometry.computeVertexNormals()

      if (mesh.uvs)
        geometry.setAttribute('uv', new THREE.BufferAttribute(decodeFloat32(mesh.uvs), 2))

      const material = mesh.texture
        ? new THREE.MeshBasicMaterial({
            alphaTest: 0.5,
            color: '#ffffff',
            side: THREE.DoubleSide
          })
        : new THREE.MeshStandardMaterial({
            color: '#d8c8ab',
            roughness: 0.92,
            metalness: 0,
            side: THREE.DoubleSide
          })

      if (mesh.texture) {
        const texture = createTexture(mesh.texture, textureLoader, render)
        material.map = texture
        textures.push(texture)
      }

      const object = new THREE.Mesh(geometry, material)
      geometries.push(geometry)
      materials.push(material)
      root.add(object)
    }

    const box = new THREE.Box3().setFromObject(root)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3()).length() || 200
    const localBounds = bounds
      ? toLocalBounds(scene.query.lat, scene.query.lng, bounds)
      : null

    if (controls) {
      controls.target.copy(center)
      controls.enableDamping = true
      controls.maxDistance = size * 6
      camera.position.set(center.x + size * 0.7, center.y + size * 0.45, center.z + size)
      camera.lookAt(center)
    } else {
      camera.position.set(
        localBounds?.centerX ?? center.x,
        Math.max(400, size * 2),
        localBounds?.centerZ ?? center.z
      )
      camera.up.set(0, 0, -1)
      camera.lookAt(localBounds?.centerX ?? center.x, 0, localBounds?.centerZ ?? center.z)
    }

    const resize = () => {
      const width = host.clientWidth
      const height = host.clientHeight
      renderer.setSize(width, height, false)

      if (camera instanceof THREE.PerspectiveCamera) {
        camera.aspect = width / height
        camera.updateProjectionMatrix()
        return
      }

      const targetWidth = (localBounds?.width ?? Math.max(200, box.max.x - box.min.x)) * 1.04
      const targetHeight =
        (localBounds?.depth ?? Math.max(200, box.max.z - box.min.z)) * 1.04
      const aspect = width / height
      const sceneAspect = targetWidth / targetHeight
      const halfWidth = sceneAspect > aspect ? targetWidth / 2 : (targetHeight * aspect) / 2
      const halfHeight = sceneAspect > aspect ? targetWidth / aspect / 2 : targetHeight / 2

      camera.left = -halfWidth
      camera.right = halfWidth
      camera.top = halfHeight
      camera.bottom = -halfHeight
      camera.updateProjectionMatrix()
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(host)

    let frame = 0

    const tick = () => {
      controls?.update()
      render()
      frame = requestAnimationFrame(tick)
    }

    tick()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      controls?.dispose()
      renderer.dispose()
      for (const texture of textures)
        texture.dispose()
      for (const material of materials)
        material.dispose()
      for (const geometry of geometries)
        geometry.dispose()
      host.innerHTML = ''
    }
  }, [bounds, scene])

  return <div className="viewer" ref={hostRef} />
}

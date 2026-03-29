import decodeDXT from 'decode-dxt'

import { buildNodeProxyUrl } from './model'
import type { ModelDiscoveryResponse, NodeRef } from './types'

type DecodedMesh = {
  vertices: Uint8Array, indices: Uint16Array, layerBounds: Uint32Array, uvOffsetAndScale?: Float32Array
  texture: { textureFormat: number, bytes: Uint8Array, width: number, height: number }
}

type DecodedNode = { matrixGlobeFromMesh: ArrayLike<number>, meshes: DecodedMesh[] }

const decodeNode = import('./vendor/decode-resource.cjs').then(m => m.default as (c: number, p: Uint8Array) => Promise<{ payload: DecodedNode }>)

type SceneTexture = { data: Uint8Array; w: number; h: number }

export type SceneMesh = {
  positions: Float32Array
  indices: Uint32Array
  uvs?: Float32Array
  texture: SceneTexture
}

const decodeDxt1 = decodeDXT as unknown as (data: DataView, w: number, h: number, fmt: 'dxt1') => Uint8Array

const basis = (lat: number, lng: number) => {
  const a = lat * Math.PI / 180, b = lng * Math.PI / 180
  const sa = Math.sin(a), ca = Math.cos(a), sb = Math.sin(b), cb = Math.cos(b)

  return {
    east: [-sb, cb, 0],
    north: [-sa * cb, -sa * sb, ca],
    up: [ca * cb, ca * sb, sa]
  }
}

const dot = (a: ArrayLike<number>, b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

const local = (p: ArrayLike<number>, c: number[], b: ReturnType<typeof basis>) => {
  const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]]
  return [dot(d, b.east), dot(d, b.up), -dot(d, b.north)]
}

const pos = (m: ArrayLike<number>, vs: Uint8Array, i: number) => {
  const [x, y, z] = [vs[i * 8], vs[i * 8 + 1], vs[i * 8 + 2]]

  return [
    x * m[0] + y * m[4] + z * m[8] + m[12],
    x * m[1] + y * m[5] + z * m[9] + m[13],
    x * m[2] + y * m[6] + z * m[10] + m[14]
  ]
}

const getNode = async (n: NodeRef) => {
  const url = buildNodeProxyUrl(n)
  const r = await fetch(url)
  if (!r.ok) throw new Error(`node request failed: ${r.status} ${url}`)
  return (await (await decodeNode)(3, new Uint8Array(await r.arrayBuffer()))).payload
}

const getNodes = (ns: NodeRef[]) => Promise.all(ns.map(getNode))

const tris = (vs: Uint8Array, ids: Uint16Array, lbs: Uint32Array) => {
  const out: number[] = []
  const n = Math.min(ids.length - 2, lbs[3])

  for (let i = 0; i < n; i += 1) {
    const [a, b, c] = [ids[i], ids[i + 1], ids[i + 2]]
    if (vs[a * 8 + 3] !== vs[b * 8 + 3] || vs[b * 8 + 3] !== vs[c * 8 + 3]) continue
    out.push(...(i & 1 ? [a, c, b] : [a, b, c]))
  }

  return out
}

const uvs = (vs: Uint8Array, s: Float32Array) => {
  const out = new Float32Array(vs.length / 4)

  for (let i = 0; i < vs.length / 8; i += 1) {
    const j = i * 8
    const u = vs[j + 5] * 256 + vs[j + 4]
    const v = vs[j + 7] * 256 + vs[j + 6]

    out[i * 2] = (u + s[0]) * s[2]
    out[i * 2 + 1] = (v + s[1]) * s[3]
  }

  return out
}

const tex = (x: DecodedMesh): SceneTexture => {
  const t = x.texture
  return {
    w: t.width, h: t.height,
    data: decodeDxt1(new DataView(t.bytes.buffer, t.bytes.byteOffset, t.bytes.byteLength), t.width, t.height, 'dxt1')
  }
}

const mesh = (m: ArrayLike<number>, x: DecodedMesh, c: number[], b: ReturnType<typeof basis>): SceneMesh => {
  const n = x.vertices.length / 8
  const ps = new Float32Array(n * 3)

  for (let j = 0; j < n; j += 1) {
    const p0 = local(pos(m, x.vertices, j), c, b)
    ps[j * 3] = p0[0]
    ps[j * 3 + 1] = p0[1]
    ps[j * 3 + 2] = p0[2]
  }

  const is = tris(x.vertices, x.indices, x.layerBounds)

  return {
    positions: ps,
    indices: Uint32Array.from(is),
    uvs: x.uvOffsetAndScale ? uvs(x.vertices, x.uvOffsetAndScale) : undefined,
    texture: tex(x)
  }
}

const center = (ns: DecodedNode[]) =>
  ns.reduce((a, n) => {
    const m = n.matrixGlobeFromMesh
    return [a[0] + m[12], a[1] + m[13], a[2] + m[14]]
  }, [0, 0, 0]).map((c: number) => c / ns.length)

const meshes = (ns: DecodedNode[], c: number[], b: ReturnType<typeof basis>) =>
  ns.flatMap(n => n.meshes.map(x => mesh(n.matrixGlobeFromMesh, x, c, b)))

export const buildModelScene = async (model: ModelDiscoveryResponse) => {
  const ns = await getNodes(model.nodes)
  return meshes(ns, center(ns), basis(model.query.lat, model.query.lng))
}

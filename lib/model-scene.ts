//@ts-ignore
import decodeDXT from 'decode-dxt'
// @ts-ignore
import decodeNode from './vendor/decode-resource.cjs'
import type { ModelResponse } from './types'

type DecodedMesh = {
  vertices: Uint8Array, indices: Uint16Array, uvOffsetAndScale?: Float32Array
  texture: { bytes: Uint8Array, width: number, height: number }
}
type DecodedNode = { matrixGlobeFromMesh: ArrayLike<number>, meshes: DecodedMesh[] }

const basis = (lat: number, lng: number) => {
  const a = lat * Math.PI / 180, b = lng * Math.PI / 180
  const sa = Math.sin(a), ca = Math.cos(a), sb = Math.sin(b), cb = Math.cos(b)
  return {
    east: [-sb, cb, 0],
    north: [-sa * cb, -sa * sb, ca],
    up: [ca * cb, ca * sb, sa]
  }
}

const pos = (m: ArrayLike<number>, vs: Uint8Array, i: number) => {
  const j = i * 8, x = vs[j], y = vs[j + 1], z = vs[j + 2]
  return [
    x * m[0] + y * m[4] + z * m[8] + m[12],
    x * m[1] + y * m[5] + z * m[9] + m[13],
    x * m[2] + y * m[6] + z * m[10] + m[14]
  ]
}

const getNodes = (n: string[]): Promise<DecodedNode[]> => 
  Promise.all(n.map(i => fetch(`/api/model/${i}`)
      .then(r => r.arrayBuffer()).then(b => decodeNode(3, b)).then(r => r.payload)))

const tris = ({ vertices: v, indices: i }: DecodedMesh) => {
  const out = []
  for (let x = 0; x < i.length - 2; x++) {
    const a = i[x], b = i[x + 1], c = i[x + 2]
    if (v[a * 8 + 3] === v[b * 8 + 3] && v[b * 8 + 3] === v[c * 8 + 3])
      x & 1 ? out.push(a, c, b) : out.push(a, b, c)
  }
  return out
}

const uvs = (vs: Uint8Array, s: Float32Array) => {
  const out = new Float32Array(vs.length / 4)
  for (let i = 0; i < vs.length / 8; i++) {
    out[i * 2] = (vs[i*8 + 5] * 256 + vs[i*8 + 4] + s[0]) * s[2]
    out[i * 2 + 1] = (vs[i*8 + 7] * 256 + vs[i*8 + 6] + s[1]) * s[3]
  }
  return out
}

const findCenter = (ns: DecodedNode[]) =>
  ns.reduce((a, { matrixGlobeFromMesh: m }) => [a[0] + m[12], a[1] + m[13], a[2] + m[14]], [0, 0, 0]).map(x => x / ns.length)

export const buildModelScene = async (m: ModelResponse) => {
  const ns = await getNodes(m.nodes)
  const center = findCenter(ns)
  const b = basis(m.query.lat, m.query.lng)

  const localCoords = (pt: ArrayLike<number>) => {
    const dx = pt[0] - center[0], dy = pt[1] - center[1], dz = pt[2] - center[2]
    return [
      dx * b.east[0] + dy * b.east[1] + dz * b.east[2],
      dx * b.up[0] + dy * b.up[1] + dz * b.up[2],
      -(dx * b.north[0] + dy * b.north[1] + dz * b.north[2])
    ]
  }

  const mesh = (m: ArrayLike<number>, x: DecodedMesh) => {
    const n = x.vertices.length / 8
    const ps = new Float32Array(n * 3)

    for (let j = 0; j < n; j++) {
      const [a, b, c] = localCoords(pos(m, x.vertices, j))
      ps[j*3] = a, ps[j*3 + 1] = b, ps[j*3 + 2] = c
    }

    return {
      positions: ps, indices: Uint32Array.from(tris(x)),
      uvs: x.uvOffsetAndScale ? uvs(x.vertices, x.uvOffsetAndScale) : undefined,
      texture: {
        w: x.texture.width, h: x.texture.height,
        data: decodeDXT(new DataView(x.texture.bytes.buffer), x.texture.width, x.texture.height, 'dxt1')
      }
    }
  }

  return ns.flatMap(n => n.meshes.map(x => mesh(n.matrixGlobeFromMesh, x)))
}
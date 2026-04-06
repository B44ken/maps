// @ts-ignore
import decodeNode from './vendor/decode-resource.cjs'
import decodeDXT from 'decode-dxt'
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

export const buildModelScene = async (m: ModelResponse, fetches: Record<string, number>) => {
  const nodes: DecodedNode[] = await Promise.all(m.nodes.map(i => {
    fetches[i] = 0
    return fetch(`/api/model/${i}`).then(r => r.arrayBuffer()).then(b => decodeNode(3, b)).then(r => {
      fetches[i] = 1
      return r.payload
    })
  }))

  const b = basis(m.query.lat, m.query.lng)

  const rotateLocal = (pt: ArrayLike<number>) => [
      pt[0] * b.east[0] + pt[1] * b.east[1] + pt[2] * b.east[2],
      pt[0] * b.up[0] + pt[1] * b.up[1] + pt[2] * b.up[2],
      -(pt[0] * b.north[0] + pt[1] * b.north[1] + pt[2] * b.north[2])
    ]

  const mesh = (m: ArrayLike<number>, x: DecodedMesh) => {
    const n = x.vertices.length / 8
    const ps = new Float32Array(n * 3)

    for (let j = 0; j < n; j++) {
      const [a, b, c] = rotateLocal(pos(m, x.vertices, j))
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

  return nodes.flatMap(n => n.meshes.map(x => mesh(n.matrixGlobeFromMesh, x)))
}
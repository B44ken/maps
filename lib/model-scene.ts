import { decode } from './retroplasma/decode-resource'
import decodeDXT from 'decode-dxt'
import { fetchBuffer } from './util'
import { basis, rotateLocal } from './model-space'
import type { Model } from './model'

const decodeList = (ids: string[]) => Promise.allSettled(ids.map(i => fetchBuffer(`https://kh.google.com/rt/earth/NodeData/pb=!1m2!1s${i}!2u!2e6!4b0`).then(decode)))
  .then(rs => rs.flatMap(r => r.status == 'fulfilled' ? [r.value] : []))

const decodeBatch = async (ids: string[], sz = 500) => {
  const out = []
  for (let i = 0; i < ids.length; i += sz)
      out.push(...await decodeList(ids.slice(i, i + sz)))
  return out
}

const pos = (m: ArrayLike<number>, vs: Uint8Array, i: number) => {
  const x = vs[i*8], y = vs[i*8 + 1], z = vs[i*8 + 2]
  return [x*m[0]+y*m[4]+z*m[8]+m[12], x*m[1]+y*m[5]+z*m[9]+m[13], x*m[2]+y*m[6]+z*m[10]+m[14]]
}

export const buildMesh = async (m: Model): Promise<{posns:Float32Array<ArrayBuffer>,inds:Uint32Array<ArrayBuffer>,uvs:Float32Array<ArrayBuffer>,tex:{w:number,h:number,data:Uint8Array}}[]> => {
  const load = await decodeBatch(m.nodes)
  console.log(`nodes ${m.nodes.length}, loaded ${load.length}`)

  return load.flatMap(node => node.meshes.map(n => {
    const posns = new Float32Array(n.verts.length / 8 * 3)
    for (let j = 0; j < posns.length; j += 3) {
      const p = pos(node.matrix, n.verts, j / 3)
      // p[1] += wgs84Height(m.lat)
      const [px, py, pz] = rotateLocal(basis(m.lat, m.lng), p)
      posns[j] = px, posns[j + 1] = py, posns[j + 2] = pz
    }

    const inds = new Uint32Array((n.inds.length - 2) * 3)
    for (let x = 0; x < n.inds.length - 2; x++) {
      const a = n.inds[x], b = n.inds[x + 1], c = n.inds[x + 2]
      if (n.verts[a*8 + 3] == n.verts[b*8 + 3] && n.verts[b*8 + 3] == n.verts[c*8 + 3])
        inds.set(x & 1 ? [a, c, b] : [a, b, c], x * 3)
    }

    const uvs = new Float32Array(n.verts.length / 4)
    for(let i = 0; i < n.verts.length; i += 8) {
      uvs[i/4]   = (n.verts[i+5] << 8 | n.verts[i+4] + n.uv[0]) * n.uv[2]
      uvs[i/4+1] = (n.verts[i+7] << 8 | n.verts[i+6] + n.uv[1]) * n.uv[3]
    }

    return { posns, inds, uvs, tex: { ...n.tex, data: decodeDXT(new DataView(n.tex.data.buffer), n.tex.w, n.tex.h, 'dxt1') } }
  }))
}
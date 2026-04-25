import sharp from 'sharp'
import { Document, NodeIO } from '@gltf-transform/core'
import { KHRMaterialsUnlit } from '@gltf-transform/extensions'
import { buildMesh } from './model-scene'
import { fetchBuffer } from './util'
import type { Model } from './model'

export const modelGlb = async (model: Model) => {
  const doc = new Document(), scene = doc.createScene(), buf = doc.createBuffer(), unlit = doc.createExtension(KHRMaterialsUnlit)

  for (const { posns, inds, uvs, tex } of await buildMesh(model))
    scene.addChild(doc.createNode().setMesh(doc.createMesh().addPrimitive(doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(posns).setBuffer(buf))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(inds).setBuffer(buf))
      .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(uvs).setBuffer(buf))
      .setMaterial(doc.createMaterial().setBaseColorTexture(doc.createTexture().setImage(await sharp(tex.data, { raw: { width: tex.w, height: tex.h, channels: 4 } }).png().toBuffer()).setMimeType('image/png')).setMetallicFactor(0).setExtension('KHR_materials_unlit', unlit.createUnlit())))))

  return await new NodeIO().registerExtensions([KHRMaterialsUnlit]).writeBinary(doc)
}

const pano = (id: string, zoom: number, x: number, y: number) => fetchBuffer(`https://streetviewpixels-pa.googleapis.com/v1/tile?cb_client=maps_sv.tactile&panoid=${id}&x=${x}&y=${y}&zoom=${zoom}&nbt=1&fover=2`)
export const panoJpg = async (id: string, zoom: number, s = 512) => {
  const w = 2 ** zoom, h = Math.ceil(2 ** (zoom - 1))
  return new Uint8Array(await sharp({ create: { width: w*s, height: h*s, channels: 3, background: 'black' } }).composite(
    await Promise.all(Array.from({ length: w }, (_, x) => Array.from({ length: h }, async (_, y) => ({
      left: x*s, top: y*s, input: await sharp(await pano(id, zoom, x, y)).resize(s).toBuffer()
    }))).flat())).jpeg().toBuffer())
}

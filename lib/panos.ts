import { fetchJson } from './util'
const { cos, tan, floor, sqrt, log, pow, PI: pi } = Math, r = Math.PI / 180

export type Pano = { id: string, lat: number, lng: number, dist: number, height: number }

const photometa = ({ x, y, z }: { x: number, y: number, z: number }): Promise<any> => fetchJson(`https://www.google.com/maps/photometa/ac/v1?pb=!1m1!1smaps_sv.tactile!6m3!1i${x}!2i${y}!3i${z}!8b1`)
const neighbors = ({ x, y, z }: { x: number, y: number, z: number }) => [0,1,-1].flatMap((X,_,a) => a.map(Y => ({x:x+X,y:y+Y,z})))
const dist = (a: number, b: number, c: number, d: number) => sqrt((c-a)**2 + ((d-b) * cos(r*a))**2) * 111_319
const tileXYZ = (lat: number, lng: number, z: number) => ({ x: floor((lng+180)*pow(2,z)/360 ), y: floor(((1 - log(tan(lat*r) + 1 / cos(lat*r)) / pi) / 2) * pow(2,z)), z })

export const discoverPanos = async (qlat: number, qlng: number, z: number) =>
  (await Promise.all(neighbors(tileXYZ(qlat, qlng, z)).map(photometa)))
    .flat(4).filter((b: any) => typeof b?.[0]?.[1] == 'string')
    .map(([[,id],,[[,,lat,lng],[height]]]) => ({ id, lat, lng, height, dist: dist(qlat, qlng, lat, lng) }))
    .filter((p,_,a) => a.find(q => q.id == p.id) == p)

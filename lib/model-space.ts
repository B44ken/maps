export const basis = (lat: number, lng: number) => {
  const a = lat * Math.PI / 180, b = lng * Math.PI / 180
  const sa = Math.sin(a), ca = Math.cos(a), sb = Math.sin(b), cb = Math.cos(b)
  return {
    east: [-sb, cb, 0],
    north: [-sa * cb, -sa * sb, ca],
    up: [ca * cb, ca * sb, sa]
  }
}

export const rotateLocal = (b: ReturnType<typeof basis>, pt: ArrayLike<number>) => [
  pt[0] * b.east[0] + pt[1] * b.east[1] + pt[2] * b.east[2],
  pt[0] * b.up[0] + pt[1] * b.up[1] + pt[2] * b.up[2],
  -(pt[0] * b.north[0] + pt[1] * b.north[1] + pt[2] * b.north[2])
]

const latLngToGlobe = (lat: number, lng: number) => {
  lat *= Math.PI / 180, lng *= Math.PI / 180
  const sa = Math.sin(lat), ca = Math.cos(lat), sb = Math.sin(lng), cb = Math.cos(lng)
  return [6378137 * ca * cb, 6378137 * ca * sb, 6378137 * sa]
}

export const latLngToModel = (originLat: number, originLng: number, lat: number, lng: number) =>
  rotateLocal(basis(originLat, originLng), latLngToGlobe(lat, lng))

export const wgs84Height = (lat: number) => {
  const s = Math.sin(lat * Math.PI / 180), c = Math.cos(lat * Math.PI / 180)
  const n = 6378137 / Math.sqrt(1 - 6.69437999014e-3 * s * s)
  return Math.sqrt((n * c) ** 2 + (n * (1 - 6.69437999014e-3) * s) ** 2)
}

export type XYZ = { x: number, y: number, z: number }
export type Pano = { id: string, lat: number, lng: number, heading: number, pitch: number, roll: number, dist: number, height: number }
export type Panos = { query: { lat: number, lng: number, zoom: number, radius: number }, tiles: XYZ[], panos: Pano[] }
export type Model = { query: { lat: number, lng: number }, octants: string[], bulk: string[], nodes: string[] }

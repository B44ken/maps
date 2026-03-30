export type TileRef = { x: number, y: number, z: number }
export type PanoSummary = { id: string, lat: number, lng: number, heading: number, pitch: number, roll: number, distanceMeters: number }
export type PanoSearchResponse = { query: { lat: number, lng: number, zoom: number, radius: number }, tiles: TileRef[], panos: PanoSummary[] }
export type ModelResponse = { query: { lat: number, lng: number }, octants: string[], bulk: string[], nodes: string[] }

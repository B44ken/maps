export type TileRef = { x: number, y: number, z: number }
export type PanoSummary = { id: string, lat: number, lng: number, heading: number, pitch: number, roll: number, distanceMeters: number }
export type PanoSearchResponse = { query: { lat: number, lng: number, zoom: number, radius: number }, tiles: TileRef[], panos: PanoSummary[] }
export type PanoDetail = { id: string, title: string, subtitle: string, lat: number, lng: number, heading: number, pitch: number, roll: number, previewUrl: string }
export type BulkRef = { id: string, version: number }
export type NodeRef = BulkRef & { textureFormat: number, imageryEpoch?: number }
export type ModelDiscoveryResponse = { query: { lat: number, lng: number }, octants: string[], bulk: BulkRef[], nodes: NodeRef[] }
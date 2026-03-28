export type TileRef = {
  x: number
  y: number
  z: number
}

export type PanoSummary = {
  id: string
  lat: number
  lng: number
  heading: number
  pitch: number
  roll: number
  label: string
  distanceMeters: number
}

export type PanoSearchResponse = {
  query: {
    lat: number
    lng: number
    zoom: number
    radius: number
  }
  tiles: TileRef[]
  panos: PanoSummary[]
}

export type PanoDetail = {
  id: string
  title: string
  subtitle: string
  lat: number
  lng: number
  heading: number
  pitch: number
  roll: number
  previewUrl: string
}

export type PanoDetailResponse = {
  pano: PanoDetail
}

export type ModelPacket = {
  id: string
  version: number
  url: string
  proxyUrl: string
  textureFormat?: number
  imageryEpoch?: number
}

export type ModelDiscoveryResponse = {
  query: {
    lat: number
    lng: number
    meters: number
  }
  octants: string[]
  bulk: ModelPacket[]
  nodes: ModelPacket[]
}

export type ModelSceneMesh = {
  id: string
  positions: string
  uvs?: string
  indices: string
  texture?: {
    url: string
  }
}

export type ModelSceneResponse = {
  query: {
    lat: number
    lng: number
    meters: number
  }
  nodes: {
    total: number
    rendered: number
  }
  meshes: ModelSceneMesh[]
}

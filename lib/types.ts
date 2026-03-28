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

export type PanoLevel = {
  zoom: number
  height: number
  width: number
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
  countryCode: string
  dimensions: {
    height: number
    width: number
  }
  tileSize: {
    width: number
    height: number
  }
  levels: PanoLevel[]
  previewUrl: string
}

export type PanoDetailResponse = {
  pano: PanoDetail
  links: Array<Omit<PanoSummary, 'distanceMeters'>>
  tiles: {
    template: string
    recommendedZoom: number
  }
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
  sceneUrl: string
  octants: string[]
  attribution: string[]
  bulk: ModelPacket[]
  nodes: ModelPacket[]
}

export type ModelSceneMesh = {
  id: string
  positions: string
  normals?: string
  uvs?: string
  indices: string
  texture?: ModelSceneTexture
}

export type ModelSceneTexture =
  {
    kind: 'url'
    width: number
    height: number
    flipY: boolean
    url: string
  }

export type ModelSceneResponse = {
  query: {
    lat: number
    lng: number
    meters: number
  }
  octants: string[]
  nodes: {
    total: number
    rendered: number
  }
  meshes: ModelSceneMesh[]
}

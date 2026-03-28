# api

minimal next.js api for reverse-engineered google maps pano + 3d tile access.

## overview

the app exposes two families:

- `panos`: discover nearby street view panos from a `(lat,lng)`, fetch pano metadata, proxy pano tiles
- `model`: discover 3d model packets near a `(lat,lng)` by walking google earth bulk metadata, then proxy those packets
- `model scene`: decode nearby model packets into renderable local-space meshes with uv data and textures

this stays intentionally close to the captured traffic instead of inventing a new abstraction layer.

## panos

### `get /api/panos?lat=<number>&lng=<number>&zoom=<int>&radius=<int>`

discovers nearby panos by:

- converting `(lat,lng)` to slippy tile coords
- querying `photometa/ac/v1` for the center tile plus a square tile radius around it
- deduping returned pano ids

defaults:

- `zoom=17`
- `radius=1`

response:

```json
{
  "query": {
    "lat": 43.65958,
    "lng": -79.41944,
    "zoom": 17,
    "radius": 1
  },
  "tiles": [
    { "x": 36617, "y": 47831, "z": 17 }
  ],
  "panos": [
    {
      "id": "w7wWPLwRSS23O_eKADOnBw",
      "lat": 43.65866557313161,
      "lng": -79.42434854827698,
      "heading": 157.45042419433594,
      "pitch": 89.25074005126953,
      "roll": 1.539294481277466,
      "distanceMeters": 421.4
    }
  ]
}
```

### `get /api/panos/<pano_id>`

loads full pano metadata from `photometa/v1`.

response:

```json
{
  "pano": {
    "id": "w7wWPLwRSS23O_eKADOnBw",
    "title": "602 Ossington Ave",
    "subtitle": "Toronto, Ontario",
    "lat": 43.65866557313161,
    "lng": -79.42434854827698,
    "heading": 157.45042419433594,
    "pitch": 89.25074005126953,
    "roll": 1.539294481277466,
    "countryCode": "CA",
    "dimensions": { "height": 8192, "width": 16384 },
    "tileSize": { "width": 512, "height": 512 },
    "levels": [
      { "zoom": 0, "height": 256, "width": 512 },
      { "zoom": 1, "height": 512, "width": 1024 }
    ],
    "previewUrl": "/api/panos/w7wWPLwRSS23O_eKADOnBw/tile?zoom=0&x=0&y=0"
  },
  "links": [
    {
      "id": "QItbhxzfTSBaeT5mR_PQQA",
      "lat": 43.65857457378939,
      "lng": -79.42431763384106,
      "heading": 164.78285217285156,
      "pitch": 90.36193084716797,
      "roll": 1.057096004486084,
      "label": "Ossington Ave"
    }
  ],
  "tiles": {
    "template": "/api/panos/w7wWPLwRSS23O_eKADOnBw/tile?zoom={zoom}&x={x}&y={y}",
    "recommendedZoom": 3
  }
}
```

### `get /api/panos/<pano_id>/tile?zoom=<int>&x=<int>&y=<int>`

proxies `streetviewpixels-pa.googleapis.com/v1/tile`.

## model

### `get /api/model?lat=<number>&lng=<number>&meters=<number>`

discovers nearby 3d model packets by:

- fetching `kh.google.com/rt/earth/PlanetoidMetadata`
- converting `(lat,lng)` into candidate octant paths
- walking the bulk metadata tree until the deepest existing octant covering that point
- returning:
  - the bulk metadata packets along that path
  - the rich-3d node packets inside the deepest covering bulk

`sceneUrl` is included as a convenience link for comparing the point in google maps. it is not used for discovery.

defaults:

- `meters=295`

response:

```json
{
  "query": {
    "lat": 43.65958,
    "lng": -79.41944,
    "meters": 295
  },
  "sceneUrl": "https://www.google.com/maps/@43.65958,-79.41944,295m/data=!3m1!1e3",
  "octants": ["21426373504061726636"],
  "attribution": [],
  "bulk": [
    {
      "id": "2142637350406172",
      "version": 0,
      "url": "https://kh.google.com/rt/earth/BulkMetadata/pb=!1m2!1s2142637350406172!2u0",
      "proxyUrl": "/api/model/bulk/2142637350406172?version=0"
    }
  ],
  "nodes": [
    {
      "id": "21426373504061726636",
      "version": 973,
      "textureFormat": 6,
      "url": "https://kh.google.com/rt/earth/NodeData/pb=!1m2!1s21426373504061726636!2u973!2e6!4b0",
      "proxyUrl": "/api/model/node/21426373504061726636?version=973&textureFormat=6"
    }
  ]
}
```

### `get /api/model/bulk/<node_id>?version=<int>`

proxies `kh.google.com/rt/earth/BulkMetadata`.

### `get /api/model/node/<node_id>?version=<int>&textureFormat=<int>&imageryEpoch=<int>`

proxies `kh.google.com/rt/earth/NodeData`.

extra query params:

- `textureFormat=<int>` defaults to `6`
- `imageryEpoch=<int>` is optional and only used when the node metadata requires it

### `get /api/model/texture/<node_id>/<mesh_index>?version=<int>&textureFormat=<int>&imageryEpoch=<int>`

fetches a `NodeData` packet, decodes the selected mesh texture, and serves it as a normal image.

response:

- `image/jpeg` when the mesh texture is already jpeg
- `image/png` when the mesh texture is `textureFormat=6`

notes:

- `textureFormat=6` is `dxt1`; the route decodes it server-side and re-encodes as png so the browser gets ordinary rgba texture data without bmp channel-order ambiguity

### `get /api/model/scene?lat=<number>&lng=<number>&meters=<number>&includeAncestors=<0|1>`

decodes renderable mesh data for a point by:

- reusing the same octant walk as `/api/model`
- keeping only the nodes at the deepest discovered octree depth
- fetching and decoding all of those deepest `NodeData` packets
- transforming vertices into a local east/north/up frame near the query point
- preserving mesh uv data
- exposing per-mesh texture image urls when the node payload includes them

defaults:

- `meters=295`
- `includeAncestors=0`

notes:

- this route intentionally omits shallower ancestor nodes so the scene stays single-lod
- most textured urban nodes currently come back as png texture urls decoded from `textureFormat=6` packets
- decoded scene uv transforms already account for the rocktree v-axis inversion, so scene textures are emitted with `flipY=false`
- `includeAncestors=1` keeps the full discovered node set, which is useful for validation and coverage checks but can reintroduce overlapping mixed-lod geometry

response:

```json
{
  "query": {
    "lat": 43.65958,
    "lng": -79.41944,
    "meters": 295
  },
  "octants": ["21426373504061726636"],
  "nodes": {
    "total": 388,
    "rendered": 287
  },
  "meshes": [
    {
      "id": "21426373504061726636:0",
      "positions": "<base64 float32 xyz buffer>",
      "normals": "<base64 float32 xyz buffer>",
      "uvs": "<base64 float32 uv buffer>",
      "indices": "<base64 uint32 triangle index buffer>",
      "texture": {
        "kind": "url",
        "width": 256,
        "height": 512,
        "flipY": false,
        "url": "/api/model/texture/21426373504061726636/0?version=973&textureFormat=6"
      }
    }
  ]
}
```

### `get /api/model/scene/validate?lat=<number>&lng=<number>&meters=<number>`

validates the scene output against the upstream exporter logic by:

- recomputing the selected lod set for the same `(lat,lng)`
- reporting the depth histogram for all discovered nodes and for the deepest-only subset
- picking the first selected node and comparing each mesh against the exporter math for:
  - triangle strip expansion
  - uv generation
  - `textureFormat=6` image encoding roundtripped back to raw rgba pixels

defaults:

- `meters=295`

response:

```json
{
  "query": {
    "lat": 43.65958,
    "lng": -79.41944,
    "meters": 295
  },
  "lod": {
    "maxDepth": 20,
    "selectedOnlyMaxDepth": true,
    "totalDepths": { "12": 1, "16": 1, "17": 4, "18": 16, "19": 79, "20": 287 },
    "selectedDepths": { "20": 287 }
  },
  "referenceNode": {
    "id": "21426373504061726636",
    "meshes": [
      {
        "id": "21426373504061726636:0",
        "trianglesMatch": true,
        "uvMaxError": 0,
        "textureHashMatch": true
      }
    ]
  }
}
```

## implementation notes

- pano discovery is direct and deterministic from the captured `photometa` endpoints
- model discovery is direct and deterministic from google earth’s octree metadata
- only rich-3d nodes are returned; terrain-only octants are skipped
- raw model packets are proxied as `application/x-protobuffer`
- scene rendering keeps only the deepest discovered nodes for a single-lod scene
- scene textures are served from a separate server-decoded image route
- `/api/model/scene/validate` is the sanity-check route for lod selection and mesh/texture extraction
- the ui is a thin client over these routes: search form, nearby pano list, pano tile viewer, model packet inspector

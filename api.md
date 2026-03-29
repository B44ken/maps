# api

minimal next.js api for reverse-engineered google maps panos and google earth model packets.

## overview

- `panos`: find nearby street view panos, load one pano, proxy its image tiles
- `model`: find nearby google earth bulk and node packets
- `model scene`: decode the deepest nearby node packets into renderable meshes with uv-mapped texture urls

## panos

### `get /api/panos?lat=<number>&lng=<number>&zoom=<int>&radius=<int>`

finds nearby pano ids from `photometa/ac/v1`.

response:

```json
{
  "query": { "lat": 43.65958, "lng": -79.41944, "zoom": 17, "radius": 1 },
  "tiles": [{ "x": 36617, "y": 47831, "z": 17 }],
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

loads one pano from `photometa/v1`.

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
    "previewUrl": "/api/panos/w7wWPLwRSS23O_eKADOnBw/tile?zoom=0&x=0&y=0"
  }
}
```

### `get /api/panos/<pano_id>/tile?zoom=<int>&x=<int>&y=<int>`

proxies `streetviewpixels-pa.googleapis.com/v1/tile`.

## model

### `get /api/model?lat=<number>&lng=<number>&meters=<number>`

walks the rocktree bulk chain for the point and returns the deepest covering octants plus the bulk and rich-3d node packets around them.

response:

```json
{
  "query": { "lat": 43.65958, "lng": -79.41944, "meters": 295 },
  "octants": ["21426373504061726636"],
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

### `get /api/model/texture/<node_id>/<mesh_index>?version=<int>&textureFormat=<int>&imageryEpoch=<int>`

decodes one mesh texture from a node packet and serves it as:

- `image/jpeg` for jpeg textures
- `image/png` for `textureFormat=6` dxt1 textures

### `get /api/model/scene?lat=<number>&lng=<number>&meters=<number>`

decodes all deepest nearby node packets into local-space triangle meshes.

notes:

- only the deepest node depth is rendered
- uv transforms already include the rocktree v flip
- textures are separate image urls, not inline bytes

response:

```json
{
  "query": { "lat": 43.65958, "lng": -79.41944, "meters": 295 },
  "nodes": { "total": 388, "rendered": 287 },
  "meshes": [
    {
      "id": "21426373504061726636:0",
      "positions": "<base64 float32 xyz buffer>",
      "uvs": "<base64 float32 uv buffer>",
      "indices": "<base64 uint32 triangle index buffer>",
      "texture": {
        "url": "/api/model/texture/21426373504061726636/0?version=973&textureFormat=6"
      }
    }
  ]
}
```

## implementation notes

- `PlanetoidMetadata` and `BulkMetadata` are decoded with a minimal inline `rocktree.proto`
- `NodeData` is decoded with vendored upstream logic in [lib/vendor/decode-resource.cjs](/Users/brad/downloads/gmapscdx/lib/vendor/decode-resource.cjs)
- api routes validate required query params and stop defaulting missing inputs
- the page only uses the routes above. compare and validation routes were intentionally removed

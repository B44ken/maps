# api

minimal next.js api for reverse-engineered google maps panos and google earth model packets.

## overview

- `panos`: find nearby street view panos, load one pano, proxy its image tiles
- `model`: find nearby google earth bulk and node packets
- the app builds renderable meshes and textures client-side from `model` node packets

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

### `get /api/model?lat=<number>&lng=<number>`

walks the rocktree bulk chain for the point and returns the deepest covering octants plus the final rich-3d node refs the app should render.

notes:

- `bulk` and `nodes` are request refs, not prebuilt fetch urls
- `nodes` is already the final render set, so the client fetches it directly

response:

```json
{
  "query": { "lat": 43.65958, "lng": -79.41944 },
  "octants": ["21426373504061726636"],
  "bulk": [
    {
      "id": "2142637350406172",
      "version": 0
    }
  ],
  "nodes": [
    {
      "id": "21426373504061726636",
      "version": 973,
      "textureFormat": 6
    }
  ]
}
```

### `get /api/model/bulk/<node_id>?version=<int>`

proxies `kh.google.com/rt/earth/BulkMetadata`.

### `get /api/model/node/<node_id>?version=<int>&textureFormat=<int>&imageryEpoch=<int>`

proxies `kh.google.com/rt/earth/NodeData`.

## implementation notes

- `PlanetoidMetadata` and `BulkMetadata` are decoded with a minimal inline `rocktree.proto`
- `NodeData` is decoded with vendored upstream logic in [lib/vendor/decode-resource.cjs](/Users/brad/downloads/gmapscdx/lib/vendor/decode-resource.cjs)
- api responses send `cache-control: s-maxage=604800`
- api routes validate required query params and stop defaulting missing inputs
- the client decodes each node once and uses that result for both geometry and textures
- mesh assembly happens in the client so typed arrays stay typed arrays instead of being base64-wrapped into json first
- the page only uses the routes above. compare and validation routes were intentionally removed

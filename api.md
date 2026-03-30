# api
next.js api for google maps panos and 3d model packets.

####  `get /api/panos?lat=<float>&lng=<float>&zoom=<int>&radius=<int>`
finds nearby pano ids

#### `get /api/panos/<id>?zoom=<int>&x=<int>&y=<int>`
proxy for pano images

#### `get /api/model?lat=<float>&lng=<float>`
walks rocktree octrees for the point, returns refs to the deepest octants.

#### `get /api/model/<id>`
proxy for octant meshes
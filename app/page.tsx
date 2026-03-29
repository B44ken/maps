'use client'

import { useEffect, useState } from 'react'

import { ModelViewer } from '@/components/model-viewer'
import type {
  ModelSceneResponse,
  PanoDetailResponse,
  PanoSearchResponse
} from '@/lib/types'
import { App, Card, Input, Btn, Grid, D, Muted, Scroll, H2, B } from 'b44ui'

const defaultLat = '43.66'
const defaultLng = '-79.42'
const defaultMeters = '295'
const defaultZoom = '17'
const defaultRadius = '1'
const visiblePanos = 64

const readInitial = () => {
  const params = new URLSearchParams(window.location.search)
  return { lat: params.get('lat') ?? defaultLat, lng: params.get('lng') ?? defaultLng }
}

export default function Page() {
  const [lat, setLat] = useState(defaultLat)
  const [lng, setLng] = useState(defaultLng)
  const [panos, setPanos] = useState<PanoSearchResponse | null>(null)
  const [selectedPano, setSelectedPano] = useState<PanoDetailResponse | null>(null)
  const [scene, setScene] = useState<ModelSceneResponse | null>(null)

  const loadPano = async (panoId: string) => {
    const resp = await fetch(`/api/panos/${panoId}`)
    if (!resp.ok) throw new Error(`pano request failed: ${resp.status}`)
    setSelectedPano(await resp.json())
  }

  const load = async (nextLat = lat, nextLng = lng) => {
    const panoSearch = new URLSearchParams({ lat: nextLat, lng: nextLng, zoom: defaultZoom, radius: defaultRadius })
    const modelSearch = new URLSearchParams({ lat: nextLat, lng: nextLng, meters: defaultMeters })
    const [panosResponse, sceneResponse] = await Promise.all([
      fetch(`/api/panos?${panoSearch}`),
      fetch(`/api/model/scene?${modelSearch}`)
    ])

    if (!panosResponse.ok || !sceneResponse.ok)
      throw new Error('scene request failed')

    const nextPanos = (await panosResponse.json()) as PanoSearchResponse
    setPanos(nextPanos)
    setScene((await sceneResponse.json()) as ModelSceneResponse)

    const panoId = nextPanos.panos[0]?.id

    if (panoId)
      await loadPano(panoId)
    else
      setSelectedPano(null)

    const url = new URL(window.location.href)
    url.searchParams.set('lat', nextLat)
    url.searchParams.set('lng', nextLng)
    window.history.replaceState(null, '', url)
  }

  useEffect(() => {
    const initial = readInitial()
    setLat(initial.lat)
    setLng(initial.lng)
    void load(initial.lat, initial.lng)
  }, [])

  return <App htScreen>
    <Card row>
      <H2 grow>maps viewer</H2>
      <Input state={[lat, setLat]} placeholder='lat' /> 
      <Input state={[lng, setLng]} placeholder='lng' />
      <Btn onClick={() => void load()}>Load</Btn>
    </Card>

    <Grid grow>
      <Card>
        <b>panos (found {panos?.panos.length ?? 0})</b>

        <D wd={1} col align='mid'>
          <D style={{ aspectRatio: '2/1', overflow: 'hidden' }}>
            <img src={selectedPano?.pano.previewUrl} />
          </D>
        </D>

        <Scroll>
          <Grid cols={3} gap={3}>
            {panos?.panos.slice(0, visiblePanos).map(({ lat, lng }, i) =>
              <Btn key={i} p={2} row onClick={() => loadPano(panos.panos[i].id)}>
                <B grow>{lat.toFixed(4)}, {lng.toFixed(4)}</B>
                <Muted>{panos.panos[i].distanceMeters.toFixed()}m away</Muted>
              </Btn>
            )}
          </Grid>
        </Scroll>
      </Card>

      <Card>
        <b>model</b>
        <ModelViewer scene={scene} />
      </Card>
    </Grid>
  </App>
}

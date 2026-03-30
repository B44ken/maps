'use client'
import type { ModelResponse, PanoSearchResponse } from '@/lib/types'
import { useEffect, useState } from 'react'
import { ModelViewer } from '@/components/model-viewer'
import { App, Card, Input, Btn, Grid, D, Muted, Scroll, H2, B } from 'b44ui'

const lat0 = '43.66', lng0 = '-79.42', zoom0 = '17', radius0 = '1', blank = 'data:,'

export default function Page() {
  const [lat, setLat] = useState(lat0)
  const [lng, setLng] = useState(lng0)
  const [panos, setPanos] = useState<PanoSearchResponse | null>(null)
  const [panoUrl, setPanoUrl] = useState(blank)
  const [model, setModel] = useState<ModelResponse | null>(null)

  const loadPano = (id: string) => setPanoUrl(`/api/panos/${id}?zoom=0&x=0&y=0`)

  const load = async (a = lat, b = lng) => {
    const [panoReq, modelReq] = await Promise.all([
      fetch(`/api/panos?lat=${a}&lng=${b}&zoom=${zoom0}&radius=${radius0}`),
      fetch(`/api/model?lat=${a}&lng=${b}`)
    ])

    if (!panoReq.ok || !modelReq.ok)
      throw new Error('model request failed')

    const panos = (await panoReq.json()) as PanoSearchResponse
    setPanos(panos)
    setModel((await modelReq.json()) as ModelResponse)

    if (panos.panos.length)
      loadPano(panos.panos[0].id)
    else
      setPanoUrl(blank)

    const u = new URL(window.location.href)
    u.searchParams.set('lat', a)
    u.searchParams.set('lng', b)
    window.history.replaceState(null, '', u)
  }

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const lat = p.get('lat') || lat0, lng = p.get('lng') || lng0
    setLat(lat)
    setLng(lng)
    void load(lat, lng)
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
        <b>panos (found {panos?.panos.length})</b>

        <D wd={1} col align='mid'>
          <D style={{ aspectRatio: '2/1', overflow: 'hidden' }}>
            <img src={panoUrl} />
          </D>
        </D>

        <Scroll>
          <Grid cols={3} gap={3}>
            {panos?.panos.map(({ id, lat, lng, distanceMeters }) =>
              <Btn key={id} p={2} row onClick={() => loadPano(id)}>
                <B grow>{lat.toFixed(4)}, {lng.toFixed(4)}</B>
                <Muted>{distanceMeters.toFixed()}m away</Muted>
              </Btn>
            )}
          </Grid>
        </Scroll>
      </Card>

      <Card>
        <b>model</b>
        {model && <ModelViewer model={model} />}
      </Card>
    </Grid>
  </App>
}

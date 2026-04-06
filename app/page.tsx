'use client'
import type { Model, Panos } from '@/lib/types'
import { useEffect, useRef, useState } from 'react'
import { ModelViewer } from '@/components/viewmodel'
import { App, Card, Input, Btn, Grid, D, Muted, Scroll, H2, B, Progress, Select } from 'b44ui'
import { Scene } from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { PanoViewer } from '@/components/viewpano'

export default function Page() {
  const [panos, setPanos] = useState<Panos | null>(null)
  const [model, setModel] = useState<Model | null>(null)
  const [fetchRate, setFetchRate] = useState(0)
  const [panoId, setPanoId] = useState<string | null>(null)
  let [ll, setLl] = useState(['43.661', '-79.392'])
  const fetches = useRef<Record<string, number>>({}).current
  const downloader = useRef<HTMLAnchorElement>(null!)
  const panoLoader = useRef<HTMLCanvasElement>(null!)
  const world = useRef<Scene>(new Scene())
  const [panoZoom, setZoom] = useState(3), [modelDepth, setDepth] = useState('17')

  setInterval(() => setFetchRate(Object.values(fetches).reduce((a, b) => a + b, 0) / Object.keys(fetches).length), 16)

  const load = async () => {
    const [panoReq, modelReq] = await Promise.all([
      fetch(`/api/panos?lat=${ll[0]}&lng=${ll[1]}`),
      fetch(`/api/model?lat=${ll[0]}&lng=${ll[1]}&depth=${modelDepth}`)
    ])

    if (!panoReq.ok || !modelReq.ok) throw new Error('model request failed')
    const panos = (await panoReq.json()) as Panos
    setPanos(panos)
    setPanoId(panos.panos[0]?.id)
    setModel((await modelReq.json()) as Model)
  }

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const lat = p.get('lat') || ll[0], lng = p.get('lng') || ll[1]
    setLl([lat, lng])
    void load()
  }, [])

  const getGlb = () =>
    new GLTFExporter().parseAsync(world.current, { binary: true }).then(f => {
      const url = URL.createObjectURL(new Blob([f as ArrayBuffer], { type: 'model/gltf-binary' }))
      downloader.current.href = url
      downloader.current.download = `model_${ll[0]}_${ll[1]}.glb`
      downloader.current.click()
      URL.revokeObjectURL(url)
    })
    
  const getPano = () => {
    downloader.current.href = panoLoader.current.toDataURL('image/jpeg')
    downloader.current.download = `pano_${panoId}.jpg`
    downloader.current.click()
  }

  return <App htScreen>
    <a style={{ display: 'none' }} ref={downloader}></a>
    <Card row>
      <H2 grow>maps viewer</H2>

      <Select onChange={e => e.target.value && setZoom(Number(e.target.value))}>
        <option value={''}>pano zoom</option>
        <option value={'5'}>full (5)</option>
        <option value={'3'}>medium (3)</option>
        <option value={'1'}>lowest (1)</option>
      </Select>
      <Select onChange={e => e.target.value && setDepth(e.target.value)}>
        <option value={''}>model depth</option>
        <option value={'20'}>full (20)</option>
        <option value={'19'}>medium (19)</option>
        <option value={'17'}>low (17)</option>
      </Select>

      <Input state={[ll[0], a => setLl([a as string, ll[1]])]} placeholder='lat' />
      <Input state={[ll[1], b => setLl([ll[0], b as string])]} placeholder='lng' />
      <Btn onClick={() => void load()}>load</Btn>
    </Card>

    <Grid grow>
      <Card>
        <D row>
          <B grow wd={0.16}>panos (found {panos?.panos.length})</B>
          <Btn click={getPano}>export pano</Btn>
        </D>

        {panoId && <PanoViewer id={panoId} zoom={panoZoom} loader={panoLoader} />}

        <Scroll>
          <Grid cols={3} gap={3}>
            {panos?.panos.map(({ id, lat, lng, dist: distanceMeters }) =>
              <Btn key={id} p={2} row click={() => setPanoId(id)}>
                <B grow>{lat.toFixed(4)}, {lng.toFixed(4)}</B>
                <Muted>{(distanceMeters / 1000).toFixed(3)}km</Muted>
              </Btn>
            )}
          </Grid>
        </Scroll>
      </Card>

      <Card>
        <D row>
          <B grow wd={0.16}>model</B>
          {fetchRate > 0 && fetchRate < 1 ? <Progress color='purple' value={fetchRate} wd={0.6} /> : null}
          {fetchRate == 1 && <Btn click={getGlb}>export glb</Btn>}
        </D>
        {model && panos && <ModelViewer {...{ model, panos: panos.panos, panoId, world, fetches }} />}
      </Card>
    </Grid>
  </App>
}

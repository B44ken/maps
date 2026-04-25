'use client'
import { useEffect, useState } from 'react'
import { ModelViewer } from '@/components/viewmodel'
import { App, Card, Input, Btn, Grid, D, Muted, Scroll, H2, B, Select } from 'b44ui'
import { PanoViewer } from '@/components/viewpano'
import { Pano } from '@/lib/panos'

const download = (url: string, name: string) => {
  const a = document.createElement('a')
  a.href = url, a.download = name
  a.click()
}

export default () => {
  const [lat, setLat] = useState('43.661'), [lng, setLng] = useState('-79.392')
  const [panos, setPanos] = useState<Pano[]>([]), [id, setId] = useState('')
  const [zoom, setZoom] = useState(3), [radius, setRadius] = useState('200'), [depth, setDepth] = useState('17')
  const [model, setModel] = useState(`/model/at?lat=${lat}&lng=${lng}&depth=${depth}&r=${radius}`)
  const pano = panos?.find(x => x.id == id)

  const load = async (qlat = lat, qlng = lng) => {
    const next: Pano[] = await fetch(`/api/panos?lat=${qlat}&lng=${qlng}`).then(r => r.json())
    setPanos(next)
    setId(next[0]?.id)
    setModel(`/model/at?lat=${qlat}&lng=${qlng}&depth=${depth}&r=${radius}`)
    history.replaceState(null, '', `/panos?lat=${qlat}&lng=${qlng}`)
  }
  useEffect(() => void load(), [lat, lng])
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('lat')) setLat(p.get('lat')!)
    if (p.get('lng')) setLng(p.get('lng')!)
  }, [])

  return <App htScreen>
    <Card row>
      <H2 grow>maps viewer</H2>

      <Select title='pano zoom' state={[zoom, setZoom]} options={{ 'full (5)': 5, 'medium (3)': 3, 'lowest (1)': 1 }} />
      <Select title='model depth' state={[depth, setDepth]} options={{ '17': '17', '18': '18', '19': '19', '20': '20' }} />
      <Input state={[radius, setRadius]} placeholder='model radius' />
      <Input state={[lat, setLat]} placeholder='lat' /> <Input state={[lng, setLng]} placeholder='lng' />
      <Btn click={() => void load()}>load</Btn>
    </Card>

    <Grid grow>
      <Card>
        <D row> <B grow wd={0.16}>panos (found {panos.length})</B> <Btn click={() => download(`/panos/${id}`, `${id}.jpg`)}>export pano</Btn> </D>
        { pano && <PanoViewer src={`/panos/${id}`} /> }
        <Scroll>  <Grid cols={3}>
            {panos.map(p => <Btn key={p.id} p={2} gap={3} row click={() => setId(p.id)}> <B>{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</B> <Muted>{Math.round(p.dist)}m away</Muted> </Btn> )}
        </Grid> </Scroll>
      </Card>
      <Card>
        <D row> <B grow wd={0.16}>model</B> <Btn click={() => download(model, `maps_lat${lat}_lng${lng}_d${depth}_r${radius}.glb`)}>export glb</Btn> </D>
        <ModelViewer src={model} lat={Number(lat)} lng={Number(lng)} pano={pano} />
      </Card>
    </Grid>
  </App>
}

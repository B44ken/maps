'use client'

import { useEffect, useState } from 'react'

import { ModelViewer } from '@/components/model-viewer'
import type {
  ModelDiscoveryResponse,
  ModelSceneResponse,
  PanoDetailResponse,
  PanoSearchResponse
} from '@/lib/types'

const defaultLat = '43.6595809'
const defaultLng = '-79.4194418'
const visiblePanos = 64
const visiblePackets = 128

const readInitial = () => {
  if (typeof window === 'undefined')
    return { lat: defaultLat, lng: defaultLng }

  const params = new URLSearchParams(window.location.search)

  return {
    lat: params.get('lat') ?? defaultLat,
    lng: params.get('lng') ?? defaultLng
  }
}

export default function Page() {
  const [lat, setLat] = useState(defaultLat)
  const [lng, setLng] = useState(defaultLng)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [panos, setPanos] = useState<PanoSearchResponse | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [selectedPano, setSelectedPano] = useState<PanoDetailResponse | null>(null)
  const [model, setModel] = useState<ModelDiscoveryResponse | null>(null)
  const [scene, setScene] = useState<ModelSceneResponse | null>(null)

  const loadPano = async (panoId: string) => {
    setSelectedId(panoId)
    const response = await fetch(`/api/panos/${panoId}`, { cache: 'no-store' })

    if (!response.ok)
      throw new Error(`pano request failed: ${response.status}`)

    setSelectedPano(await response.json())
  }

  const load = async (nextLat = lat, nextLng = lng) => {
    setLoading(true)
    setError('')

    const search = new URLSearchParams({ lat: nextLat, lng: nextLng })
    const [panosResponse, modelResponse, sceneResponse] = await Promise.all([
      fetch(`/api/panos?${search}`, { cache: 'no-store' }),
      fetch(`/api/model?${search}`, { cache: 'no-store' }),
      fetch(`/api/model/scene?${search}`, { cache: 'no-store' })
    ])

    if (!panosResponse.ok || !modelResponse.ok || !sceneResponse.ok)
      throw new Error('scene request failed')

    const nextPanos = (await panosResponse.json()) as PanoSearchResponse
    setPanos(nextPanos)
    setModel((await modelResponse.json()) as ModelDiscoveryResponse)
    setScene((await sceneResponse.json()) as ModelSceneResponse)

    const panoId = nextPanos.panos[0]?.id

    if (panoId)
      await loadPano(panoId)
    else {
      setSelectedId('')
      setSelectedPano(null)
    }

    const url = new URL(window.location.href)
    url.searchParams.set('lat', nextLat)
    url.searchParams.set('lng', nextLng)
    window.history.replaceState(null, '', url)
    setLoading(false)
  }

  useEffect(() => {
    const initial = readInitial()
    setLat(initial.lat)
    setLng(initial.lng)

    load(initial.lat, initial.lng).catch(error => {
      setError(String(error))
      setLoading(false)
    })
  }, [])

  return (
    <main className="shell">
      <form
        className="search"
        onSubmit={event => {
          event.preventDefault()
          load().catch(error => {
            setError(String(error))
            setLoading(false)
          })
        }}
      >
        <input value={lat} onChange={event => setLat(event.target.value)} inputMode="decimal" />
        <input value={lng} onChange={event => setLng(event.target.value)} inputMode="decimal" />
        <button disabled={loading}>{loading ? 'loading…' : 'load'}</button>
      </form>

      {error ? <p className="error">{error}</p> : null}

      <section className="grid">
        <article className="panel">
          <div className="panel-head">
            <h2>panos</h2>
            <span>{panos?.panos.length ?? 0}</span>
          </div>

          <div className="list">
            {panos?.panos.slice(0, visiblePanos).map(pano => (
              <button
                key={pano.id}
                className={pano.id === selectedId ? 'item active' : 'item'}
                onClick={() => {
                  loadPano(pano.id).catch(error => setError(String(error)))
                }}
                type="button"
              >
                <strong>{pano.id}</strong>
                <span>
                  {pano.distanceMeters.toFixed(0)}m · {pano.lat.toFixed(5)}, {pano.lng.toFixed(5)}
                </span>
              </button>
            ))}
          </div>

          {selectedPano ? (
            <div className="detail">
              <img alt={selectedPano.pano.title || selectedPano.pano.id} src={selectedPano.pano.previewUrl} />
              <strong>{selectedPano.pano.title || selectedPano.pano.id}</strong>
              <span>{selectedPano.pano.subtitle}</span>
            </div>
          ) : null}
        </article>

        <article className="panel">
          <div className="panel-head">
            <h2>model</h2>
            <span>
              {scene ? `${scene.nodes.rendered}/${scene.nodes.total}` : '0'}
            </span>
          </div>

          <ModelViewer scene={scene} />

          <div className="stack">
            <section>
              <h3>octants</h3>
              <p>{model?.octants.join(', ') || 'none'}</p>
            </section>

            <section>
              <h3>bulk</h3>
              <div className="list small">
                {model?.bulk.slice(0, visiblePackets).map(packet => (
                  <a
                    key={`${packet.id}-${packet.version}`}
                    className="item"
                    href={packet.proxyUrl}
                    target="_blank"
                  >
                    <strong>{packet.id}</strong>
                    <span>v{packet.version}</span>
                  </a>
                ))}
              </div>
            </section>

            <section>
              <h3>nodes</h3>
              <div className="list small">
                {model?.nodes.slice(0, visiblePackets).map(packet => (
                  <a
                    key={`${packet.id}-${packet.version}`}
                    className="item"
                    href={packet.proxyUrl}
                    target="_blank"
                  >
                    <strong>{packet.id}</strong>
                    <span>v{packet.version}</span>
                  </a>
                ))}
              </div>
            </section>
          </div>
        </article>
      </section>
    </main>
  )
}

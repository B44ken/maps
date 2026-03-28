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
  const [model, setModel] = useState<ModelDiscoveryResponse | null>(null)
  const [modelScene, setModelScene] = useState<ModelSceneResponse | null>(null)
  const [modelSceneLoading, setModelSceneLoading] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [selectedPano, setSelectedPano] = useState<PanoDetailResponse | null>(null)

  const loadPano = async (panoId: string) => {
    setSelectedId(panoId)

    const response = await fetch(`/api/panos/${panoId}`, { cache: 'no-store' })

    if (!response.ok)
      throw new Error(`pano request failed: ${response.status}`)

    setSelectedPano(await response.json())
  }

  const loadScene = async (nextLat = lat, nextLng = lng) => {
    setLoading(true)
    setError('')
    setModelScene(null)
    setModelSceneLoading(true)

    const search = new URLSearchParams({ lat: nextLat, lng: nextLng })
    const [panosResponse, modelResponse] = await Promise.all([
      fetch(`/api/panos?${search}`, { cache: 'no-store' }),
      fetch(`/api/model?${search}`, { cache: 'no-store' })
    ])

    if (!panosResponse.ok)
      throw new Error(`panos request failed: ${panosResponse.status}`)

    if (!modelResponse.ok)
      throw new Error(`model request failed: ${modelResponse.status}`)

    const nextPanos = (await panosResponse.json()) as PanoSearchResponse
    const nextModel = (await modelResponse.json()) as ModelDiscoveryResponse

    setPanos(nextPanos)
    setModel(nextModel)

    const firstPano = nextPanos.panos[0]?.id ?? ''

    if (firstPano)
      await loadPano(firstPano)
    else {
      setSelectedId('')
      setSelectedPano(null)
    }

    const url = new URL(window.location.href)
    url.searchParams.set('lat', nextLat)
    url.searchParams.set('lng', nextLng)
    window.history.replaceState(null, '', url)

    setLoading(false)

    fetch(`/api/model/scene?${search}`, { cache: 'no-store' })
      .then(async response => {
        if (!response.ok)
          throw new Error(`model scene request failed: ${response.status}`)

        setModelScene((await response.json()) as ModelSceneResponse)
        setModelSceneLoading(false)
      })
      .catch(error => {
        setError(String(error))
        setModelSceneLoading(false)
      })
  }

  useEffect(() => {
    const initial = readInitial()
    setLat(initial.lat)
    setLng(initial.lng)

    loadScene(initial.lat, initial.lng).catch(error => {
      setError(String(error))
      setLoading(false)
      setModelSceneLoading(false)
    })
  }, [])

  return (
    <main className="shell">
      <section className="hero">
        <p className="kicker">reverse-engineered google maps scene explorer</p>
        <h1>gmapscdx</h1>
        <p className="lede">
          search a point, inspect nearby panos, and walk the local google earth
          octree for matching `kh` model packets.
        </p>
      </section>

      <form
        className="search"
        onSubmit={event => {
          event.preventDefault()
          loadScene().catch(error => {
            setError(String(error))
            setLoading(false)
            setModelSceneLoading(false)
          })
        }}
      >
        <label>
          <span>lat</span>
          <input
            value={lat}
            onChange={event => setLat(event.target.value)}
            inputMode="decimal"
          />
        </label>
        <label>
          <span>lng</span>
          <input
            value={lng}
            onChange={event => setLng(event.target.value)}
            inputMode="decimal"
          />
        </label>
        <button disabled={loading}>{loading ? 'loading…' : 'load scene'}</button>
      </form>

      {error ? <p className="error">{error}</p> : null}

      <section className="grid">
        <article className="panel">
          <div className="panel-head">
            <h2>panos</h2>
            <p>{panos?.panos.length ?? 0} found</p>
          </div>

          <div className="pano-list">
            {panos?.panos.map(pano => (
              <button
                key={pano.id}
                className={pano.id === selectedId ? 'pano-item active' : 'pano-item'}
                onClick={() => {
                  loadPano(pano.id).catch(error => {
                    setError(String(error))
                    setLoading(false)
                  })
                }}
                type="button"
              >
                <strong>{pano.id}</strong>
                <span>
                  {pano.distanceMeters.toFixed(1)}m away · {pano.lat.toFixed(6)},{' '}
                  {pano.lng.toFixed(6)}
                </span>
              </button>
            ))}

            {!panos?.panos.length ? (
              <p className="muted">no nearby panos for this tile window</p>
            ) : null}
          </div>

          {selectedPano ? (
            <div className="detail">
              <div className="detail-head">
                <div>
                  <h3>{selectedPano.pano.title || selectedPano.pano.id}</h3>
                  <p>{selectedPano.pano.subtitle}</p>
                </div>
                <a href={`/api/panos/${selectedPano.pano.id}`} target="_blank">
                  json
                </a>
              </div>

              <img
                alt={selectedPano.pano.title || selectedPano.pano.id}
                className="preview"
                src={selectedPano.pano.previewUrl}
              />

              <dl className="meta">
                <div>
                  <dt>coords</dt>
                  <dd>
                    {selectedPano.pano.lat.toFixed(6)}, {selectedPano.pano.lng.toFixed(6)}
                  </dd>
                </div>
                <div>
                  <dt>pose</dt>
                  <dd>
                    {selectedPano.pano.heading.toFixed(2)} /{' '}
                    {selectedPano.pano.pitch.toFixed(2)} /{' '}
                    {selectedPano.pano.roll.toFixed(2)}
                  </dd>
                </div>
                <div>
                  <dt>size</dt>
                  <dd>
                    {selectedPano.pano.dimensions.width}×
                    {selectedPano.pano.dimensions.height}
                  </dd>
                </div>
                <div>
                  <dt>tile template</dt>
                  <dd>{selectedPano.tiles.template}</dd>
                </div>
              </dl>

              <div className="links">
                <div className="panel-head small">
                  <h3>linked panos</h3>
                  <p>{selectedPano.links.length}</p>
                </div>

                {selectedPano.links.slice(0, 16).map(link => (
                  <button
                    key={link.id}
                    className="link-item"
                    onClick={() => {
                      loadPano(link.id).catch(error => {
                        setError(String(error))
                        setLoading(false)
                      })
                    }}
                    type="button"
                  >
                    <strong>{link.label || link.id}</strong>
                    <span>
                      {link.lat.toFixed(6)}, {link.lng.toFixed(6)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </article>

        <article className="panel">
          <div className="panel-head">
            <h2>model packets</h2>
            <p>
              {model?.bulk.length ?? 0} bulk · {model?.nodes.length ?? 0} nodes
            </p>
          </div>

          <div className="stack">
            <div className="subpanel viewer-panel">
              <div className="panel-head small">
                <h3>render</h3>
                <p>
                  {modelScene
                    ? `${modelScene.nodes.rendered}/${modelScene.nodes.total} nodes`
                    : modelSceneLoading
                      ? 'decoding…'
                      : 'idle'}
                </p>
              </div>

              {modelScene ? (
                <ModelViewer scene={modelScene} />
              ) : (
                <div className="viewer-placeholder">
                  {modelSceneLoading ? 'decoding textured meshes…' : 'no mesh loaded'}
                </div>
              )}
            </div>

            <div className="subpanel">
              <h3>scene url</h3>
              <p className="muted">{model?.sceneUrl}</p>
            </div>

            <div className="subpanel">
              <h3>focus octants</h3>
              <p className="muted">
                {model?.octants.length ? model.octants.join(', ') : 'none found'}
              </p>
            </div>

            <div className="subpanel">
              <h3>imagery attribution</h3>
              <p className="muted">
                {model?.attribution.length ? model.attribution.join(', ') : 'not resolved'}
              </p>
            </div>

            <div className="subpanel">
              <h3>bulk metadata</h3>
              <div className="packet-list">
                {model?.bulk.map(packet => (
                  <a
                    key={`${packet.id}-${packet.version}`}
                    className="packet"
                    href={packet.proxyUrl}
                    target="_blank"
                  >
                    <strong>{packet.id}</strong>
                    <span>v{packet.version}</span>
                  </a>
                ))}
              </div>
            </div>

            <div className="subpanel">
              <h3>node data</h3>
              <div className="packet-list tall">
                {model?.nodes.map(packet => (
                  <a
                    key={`${packet.id}-${packet.version}`}
                    className="packet"
                    href={packet.proxyUrl}
                    target="_blank"
                  >
                    <strong>{packet.id}</strong>
                    <span>v{packet.version}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </article>
      </section>
    </main>
  )
}

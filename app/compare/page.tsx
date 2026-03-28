'use client'

import { useEffect, useState } from 'react'

import { ModelViewer } from '@/components/model-viewer'
import type { ModelSceneResponse } from '@/lib/types'

const readNumber = (value: string | null, fallback?: number) => {
  if (value === null)
    return fallback

  const number = Number(value)

  if (!Number.isFinite(number))
    throw new Error(`invalid number: ${value}`)

  return number
}

export default function ComparePage() {
  const [scene, setScene] = useState<ModelSceneResponse | null>(null)
  const [bounds, setBounds] = useState<{
    north: number
    south: number
    east: number
    west: number
  } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const north = readNumber(params.get('north'))
    const south = readNumber(params.get('south'))
    const east = readNumber(params.get('east'))
    const west = readNumber(params.get('west'))

    if ([north, south, east, west].some(value => value === undefined)) {
      setError('missing north/south/east/west')
      return
    }

    const nextBounds = { north: north!, south: south!, east: east!, west: west! }
    const lat = readNumber(params.get('lat'), (nextBounds.north + nextBounds.south) / 2)!
    const lng = readNumber(params.get('lng'), (nextBounds.east + nextBounds.west) / 2)!

    setBounds(nextBounds)

    fetch(`/api/model/scene?lat=${lat}&lng=${lng}&includeAncestors=1`, {
      cache: 'no-store'
    })
      .then(async response => {
        if (!response.ok)
          throw new Error(`model scene request failed: ${response.status}`)

        setScene((await response.json()) as ModelSceneResponse)
      })
      .catch(error => setError(String(error)))
  }, [])

  return (
    <main className="compare-shell">
      {scene && bounds ? (
        <ModelViewer scene={scene} bounds={bounds} />
      ) : (
        <div className="compare-status">{error || 'loading…'}</div>
      )}
    </main>
  )
}

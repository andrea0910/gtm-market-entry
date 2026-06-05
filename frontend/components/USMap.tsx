'use client'

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'

const STATES_URL =
  'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json'

interface Props {
  selectedRegion: string | null
  onRegionSelect: (region: string) => void
}

export default function USMap({ selectedRegion, onRegionSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const geoLayerRef = useRef<any>(null)
  const [geoJson, setGeoJson] = useState<any>(null)
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    fetch(STATES_URL)
      .then(r => r.json())
      .then(setGeoJson)
      .catch(err => console.error('[USMap] GeoJSON load failed:', err))
  }, [])

  // Initialize map once on mount, clean up on unmount
  useEffect(() => {
    if (!containerRef.current) return

    const el = containerRef.current as any
    if (el._leaflet_id) {
      el._leaflet_id = undefined
    }

    const map = L.map(containerRef.current, {
      center: [39.5, -98.35],
      zoom: 4,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    mapRef.current = map
    setMapReady(true) // signal that the map instance is ready for layers

    return () => {
      map.remove()
      mapRef.current = null
      geoLayerRef.current = null
      setMapReady(false)
    }
  }, [])

  // Re-draw GeoJSON layer whenever data, selection, or map readiness changes.
  // mapReady in deps fixes a race where the GeoJSON fetch resolves before
  // Leaflet finishes initializing, causing the polygon layer to be silently skipped.
  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map || !geoJson) return

    if (geoLayerRef.current) {
      geoLayerRef.current.remove()
    }

    const layer = L.geoJSON(geoJson, {
      style: (feature: any) => {
        const selected = feature?.properties?.name === selectedRegion
        return {
          color: '#d1d5db',
          weight: 1,
          fillColor: selected ? '#4f46e5' : '#e5e7eb',
          fillOpacity: selected ? 0.45 : 0.25,
        }
      },
      onEachFeature: (feature: any, l: any) => {
        const name: string = feature?.properties?.name
        l.on({
          click: () => name && onRegionSelect(name),
          mouseover: (e: any) => {
            if (name !== selectedRegion) {
              e.target.setStyle({ fillColor: '#c7d2fe', fillOpacity: 0.5 })
            }
          },
          mouseout: (e: any) => {
            layer.resetStyle(e.target)
            if (name === selectedRegion) {
              e.target.setStyle({ fillColor: '#4f46e5', fillOpacity: 0.45 })
            }
          },
        })
      },
    }).addTo(map)

    geoLayerRef.current = layer
  }, [geoJson, selectedRegion, onRegionSelect, mapReady])

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
}

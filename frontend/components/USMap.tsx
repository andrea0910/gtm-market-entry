'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet'
import type { PathOptions, Layer } from 'leaflet'

// Public domain US states GeoJSON — state name is in feature.properties.name
const STATES_URL =
  'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json'

interface Props {
  selectedRegion: string | null
  onRegionSelect: (region: string) => void
}

export default function USMap({ selectedRegion, onRegionSelect }: Props) {
  const [geoJson, setGeoJson] = useState<any>(null)

  useEffect(() => {
    fetch(STATES_URL)
      .then(r => r.json())
      .then(setGeoJson)
  }, [])

  function styleFeature(feature?: any): PathOptions {
    const selected = feature?.properties?.name === selectedRegion
    return {
      color: '#d1d5db',
      weight: 1,
      fillColor: selected ? '#4f46e5' : '#e5e7eb',
      fillOpacity: selected ? 0.45 : 0.25,
    }
  }

  function onEachFeature(feature: any, layer: Layer) {
    const name: string = feature?.properties?.name
    ;(layer as any).on({
      click: () => name && onRegionSelect(name),
      mouseover: (e: any) => {
        if (name !== selectedRegion) {
          e.target.setStyle({ fillColor: '#c7d2fe', fillOpacity: 0.5 })
        }
      },
      mouseout: (e: any) => e.target.setStyle(styleFeature(feature)),
    })
  }

  return (
    <MapContainer
      center={[39.5, -98.35]}
      zoom={4}
      // Inline style required — Leaflet calculates tile layout from explicit pixel dimensions
      style={{ height: '100%', width: '100%' }}
      zoomControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {geoJson && (
        // key forces GeoJSON layer remount when selection changes, re-applying styleFeature
        <GeoJSON
          key={selectedRegion ?? '__none__'}
          data={geoJson}
          style={styleFeature}
          onEachFeature={onEachFeature}
        />
      )}
    </MapContainer>
  )
}

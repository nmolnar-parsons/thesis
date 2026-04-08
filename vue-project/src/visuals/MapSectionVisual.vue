<script setup>
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
  activeStep: { type: Number, default: 0 },
})

const mapRef = ref(null)
let map

const polygonData = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'North Pacific' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[-165, 16], [-110, 16], [-110, 48], [-165, 48], [-165, 16]]],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Mediterranean' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[0, 30], [36, 30], [36, 44], [0, 44], [0, 30]]],
      },
    },
  ],
}

const pointData = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { value: 28 }, geometry: { type: 'Point', coordinates: [-122.4, 37.8] } },
    { type: 'Feature', properties: { value: 31 }, geometry: { type: 'Point', coordinates: [139.7, 35.6] } },
    { type: 'Feature', properties: { value: 24 }, geometry: { type: 'Point', coordinates: [2.35, 48.86] } },
    { type: 'Feature', properties: { value: 19 }, geometry: { type: 'Point', coordinates: [121.5, 25.03] } },
  ],
}

function updateMapState(step) {
  if (!map) return
  const opacity = step > 1 ? 0.6 : 0.35
  if (map.getLayer('zones-fill')) {
    map.setPaintProperty('zones-fill', 'fill-opacity', opacity)
  }

  const centerByStep = [
    [-145, 32],
    [18, 39],
    [130, 32],
  ]
  const zoomByStep = [2.1, 3.2, 3.4]
  const safeIndex = Math.min(step, 2)
  map.flyTo({ center: centerByStep[safeIndex], zoom: zoomByStep[safeIndex], speed: 0.5, essential: true })
}

onMounted(() => {
  if (!mapRef.value) return

  mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || ''
  map = new mapboxgl.Map({
    container: mapRef.value,
    style: 'mapbox://styles/mapbox/light-v11',
    center: [-130, 33],
    zoom: 2.1,
  })

  map.on('load', () => {
    map.addSource('zones', { type: 'geojson', data: polygonData })
    map.addSource('markets', { type: 'geojson', data: pointData })

    map.addLayer({
      id: 'zones-fill',
      type: 'fill',
      source: 'zones',
      paint: {
        'fill-color': '#2563eb',
        'fill-opacity': 0.35,
      },
    })

    map.addLayer({
      id: 'market-points',
      type: 'circle',
      source: 'markets',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['get', 'value'], 10, 6, 35, 14],
        'circle-color': '#f97316',
        'circle-opacity': 0.9,
      },
    })

    updateMapState(props.activeStep)
  })
})

watch(
  () => props.activeStep,
  (step) => updateMapState(step),
)

onUnmounted(() => {
  if (map) map.remove()
})
</script>

<template>
  <div ref="mapRef" class="map-host" />
</template>

<style scoped>
.map-host {
  width: 100%;
  height: min(76vh, 620px);
  border-radius: 0.85rem;
  overflow: hidden;
  border: 1px solid #94a3b8;
}
</style>

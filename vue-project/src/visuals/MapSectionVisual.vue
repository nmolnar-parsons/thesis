<script setup>
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { schemePuBu } from 'd3-scale-chromatic'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
// import tunaCatchDataUrl from '../data/tuna_data/cwp-grid-5deg-catch.geojson?url'
import tunaCatchDataUrl from '../data/tuna_data/cwp-grid-5deg-catch-bluefin.geojson?url'


const YEAR_START = 1965
const YEAR_END = 2023
const DEFAULT_PROJECTION = 'naturalEarth'
/** 250 kg per bluefin on average; convert head-count to metric tonnes. */
const COUNT_TO_TONNE = 250 / 1000
const PUBU_COLORS = schemePuBu[9]

const props = defineProps({
  activeStep: { type: Number, default: 0 },
  /** Scrollama progress through the current step, roughly 0–1. */
  stepProgress: { type: Number, default: 0 },
  stepCount: { type: Number, default: 4 },
})

const mapRef = ref(null)
const mapReady = ref(false)
const tokenMissing = ref(false)
let map = null
let resizeObserver = null

/** Years animate across all scroll steps except the last (e.g. North Atlantic). */
const yearTimelineT = computed(() => {
  const spanSteps = Math.max(1, props.stepCount - 1)
  const lastTimedIndex = props.stepCount - 2
  if (lastTimedIndex < 0) return 1
  if (props.activeStep > lastTimedIndex) return 1
  const pos = Math.min(props.activeStep + props.stepProgress, spanSteps)
  return pos / spanSteps
})

const currentYear = computed(() => {
  const span = YEAR_END - YEAR_START
  const y = YEAR_START + yearTimelineT.value * span
  return Math.min(YEAR_END, Math.max(YEAR_START, Math.round(y)))
})

const tunaColorExpression = computed(() => {
  const y = currentYear.value
  const combinedTonnes = [
    '+',
    ['coalesce', ['get', `tonne_${y}`], 0],
    ['*', COUNT_TO_TONNE, ['coalesce', ['get', `count_${y}`], 0]],
  ]
  return [
    'step',
    combinedTonnes,
    PUBU_COLORS[0],
    10, PUBU_COLORS[1],
    50, PUBU_COLORS[2],
    100, PUBU_COLORS[3],
    250, PUBU_COLORS[4],
    500, PUBU_COLORS[5],
    1000, PUBU_COLORS[6],
    5000, PUBU_COLORS[7],
    10000, PUBU_COLORS[8],
  ]
})

function hideMapLabels() {
  if (!map || !mapReady.value) return
  const layers = map.getStyle()?.layers || []
  for (const layer of layers) {
    if (layer.type === 'symbol') {
      map.setLayoutProperty(layer.id, 'visibility', 'none')
    }
  }
}

function setProjection() {
  if (!map || !mapReady.value) return
  map.setProjection(DEFAULT_PROJECTION)
  map.setFog({
    'range': [1, 10],
    'color': 'rgba(186, 186, 163, 0)',      // Fully transparent lower atmosphere
    'high-color': 'rgba(0, 0, 0, 0)', // Fully transparent upper atmosphere
    'space-color': 'rgb(0, 0, 0)', // Make space background transparent
    'star-intensity': 0               // Remove stars
  });
}

function neutralizeWaterColor() {
  if (!map || !mapReady.value) return
  if (!map.getLayer('water')) return
  map.setPaintProperty('water', 'fill-color', '#e5e7eb')
  map.setPaintProperty('water', 'fill-opacity', 0.9)
}

function updateCatchLayer() {
  if (!map || !mapReady.value || !map.getLayer('tuna-catch-fill')) return
  map.setPaintProperty('tuna-catch-fill', 'fill-color', tunaColorExpression.value)
}

function updateCameraForStep(stepIndex) {
  if (!map) return
  const lastIndex = props.stepCount - 1
  if (lastIndex < 0) return
  if (stepIndex === lastIndex) {
    map.flyTo({ center: [-20, 45], zoom: 3, speed: 0.75, essential: true })
  } else {
    map.jumpTo({ center: [0, 0], zoom: 1.25, essential: true })
  }
}

onMounted(() => {
  if (!mapRef.value) return

  const mapboxToken = (
    import.meta.env.VITE_MAPBOX_TOKEN ||
    import.meta.env.MAPBOX_TOKEN ||
    ''
  ).trim()
  if (!mapboxToken) {
    tokenMissing.value = true
    console.warn('MapSectionVisual: missing VITE_MAPBOX_TOKEN or MAPBOX_TOKEN; map initialization skipped.')
    return
  }

  mapboxgl.accessToken = mapboxToken
  map = new mapboxgl.Map({
    container: mapRef.value,
    style: 'mapbox://styles/mapbox/light-v11',
    center: [0, 0],
    zoom: 1.5,
    projection: DEFAULT_PROJECTION,
    renderWorldCopies: true,
  })

  map.on('load', () => {
    map.addSource('tuna-catch', {
      type: 'geojson',
      data: tunaCatchDataUrl,
    })

    map.addLayer({
      id: 'tuna-catch-fill',
      type: 'fill',
      source: 'tuna-catch',
      paint: {
        'fill-color': tunaColorExpression.value,
        'fill-opacity': 0.7,
      },
    })

    // White continents overlay layer above tuna data.
    map.addLayer({
      'id': 'continent-fill',
      'type': 'fill',
      'source': {
          'type': 'vector',
          'url': 'mapbox://mapbox.country-boundaries-v1'
      },
      'source-layer': 'country_boundaries',
      'paint': {
          'fill-color': '#d1d5db',
          'fill-opacity': 1
      }
    })

    mapReady.value = true
    hideMapLabels()
    setProjection()
    neutralizeWaterColor()
    updateCatchLayer()
    updateCameraForStep(props.activeStep)
  })

  resizeObserver = new ResizeObserver(() => {
    if (!map || !mapReady.value) return
    map.resize()
  })
  resizeObserver.observe(mapRef.value)
})

watch(
  () => props.activeStep,
  (step) => {
    updateCameraForStep(step)
  },
)

watch(currentYear, () => {
  updateCatchLayer()
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  if (map) map.remove()
  map = null
})
</script>

<template>
  <div class="map-frame">
    <div ref="mapRef" class="map-host" />
    <p class="year-label">{{ currentYear }}</p>

    <p v-if="tokenMissing" class="token-warning">
      Add `VITE_MAPBOX_TOKEN` in your local `.env` to render the map.
    </p>
  </div>
</template>

<style scoped>
.map-frame {
  position: relative;
  width: 100%;
  height: 100%;
}

.map-host {
  width: 100%;
  height: 100%;
  overflow: hidden;
  /* border: 1px solid rgba(148, 163, 184, 0.6); */
}

.year-label {
  position: absolute;
  top: .25rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 6;
  margin: 0;
  padding: 0.35rem 0.7rem;
  border-radius: 0.4rem;
  /* background: rgba(255, 255, 255, 0.88); */
  color: #ffffff;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.token-warning {
  position: absolute;
  left: 1rem;
  top: 1rem;
  z-index: 6;
  max-width: min(420px, calc(100% - 2rem));
  margin: 0;
  padding: 0.6rem 0.8rem;
  border-radius: 0.45rem;
  border: 1px solid rgba(239, 68, 68, 0.45);
  background: rgba(254, 242, 242, 0.92);
  color: #991b1b;
  font-size: 0.8rem;
}
</style>

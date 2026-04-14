<script setup>
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import tunaCatchDataUrl from '../data/cwp-grid-5deg-catch.geojson?url'

const YEAR_START = 1965
const YEAR_END = 2023
const DEFAULT_PROJECTION = 'winkelTripel'

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

const propertyName = computed(() => `tonne_${currentYear.value}`)
const tunaColorExpression = computed(() => [
  'interpolate',
  ['linear'],
  ['coalesce', ['get', propertyName.value], 0],
  0, '#fff5f0',
  100, '#fee0d2',
  500, '#fcbba1',
  1000, '#fc9272',
  5000, '#fb6a4a',
  10000, '#de2d26',
  50000, '#a50f15',
  100000, '#67000d',
])

function setProjection() {
  if (!map || !mapReady.value) return
  map.setProjection(DEFAULT_PROJECTION)
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
    map.flyTo({ center: [-35, 48], zoom: 3, speed: 0.75, essential: true })
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

    mapReady.value = true
    setProjection()
    updateCatchLayer()
    updateCameraForStep(props.activeStep)
  })
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
  if (map) map.remove()
  map = null
})
</script>

<template>
  <div class="map-frame">
    <div ref="mapRef" class="map-host" />

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
  border: 1px solid rgba(148, 163, 184, 0.6);
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

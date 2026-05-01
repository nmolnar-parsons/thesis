<script setup>
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { schemePuBu } from 'd3-scale-chromatic'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
// import tunaCatchDataUrl from '../data/tuna_data/cwp-grid-5deg-catch.geojson?url'
import tunaCatchDataUrl from '../data/tuna_data/cwp-grid-5deg-catch-bluefin.geojson?url'
import tunaCatchDataRaw from '../data/tuna_data/cwp-grid-5deg-catch-bluefin.geojson?raw'


const YEAR_START = 1965
const YEAR_END = 2023
const DEFAULT_PROJECTION = 'naturalEarth'
/** 250 kg per bluefin on average; convert head-count to metric tonnes. */
const COUNT_TO_TONNE = 250 / 1000
const PUBU_COLORS = schemePuBu[9]
const STEP_YEAR_FULLVIEW_END = 4
const STEP_NORTH_ATLANTIC = 5
const STEP_NORTH_ATLANTIC_LINGER = 6
const STEP_BAJA = 7
const STEP_BAJA_LINGER = 8
const STEP_RETURN_FULL = 9

const props = defineProps({
  activeStep: { type: Number, default: 0 },
  /** Scrollama progress through the current step, roughly 0–1. */
  stepProgress: { type: Number, default: 0 },
  stepCount: { type: Number, default: 10 },
})

const mapRef = ref(null)
const mapReady = ref(false)
const tokenMissing = ref(false)
let map = null
let resizeObserver = null
let activeCameraKey = ''

/** Years animate to 2023 before any regional zoom begins. */
const yearTimelineT = computed(() => {
  const spanSteps = Math.max(1, STEP_YEAR_FULLVIEW_END + 1)
  const timelinePos = props.activeStep + props.stepProgress
  if (timelinePos >= spanSteps) return 1
  return timelinePos / spanSteps
})

const currentYear = computed(() => {
  const span = YEAR_END - YEAR_START
  const y = YEAR_START + yearTimelineT.value * span
  return Math.min(YEAR_END, Math.max(YEAR_START, Math.round(y)))
})

function parseYearlyTotals() {
  const empty = new Map()
  try {
    const parsed = JSON.parse(tunaCatchDataRaw)
    const features = Array.isArray(parsed?.features) ? parsed.features : []
    const yearly = new Map()
    for (let y = YEAR_START; y <= YEAR_END; y += 1) {
      yearly.set(y, { count: 0, tonnes: 0 })
    }
    for (const feature of features) {
      const props = feature?.properties || {}
      for (let y = YEAR_START; y <= YEAR_END; y += 1) {
        const count = Number(props[`count_${y}`]) || 0
        const tonnes = Number(props[`tonne_${y}`]) || 0
        const entry = yearly.get(y)
        entry.count += count
        entry.tonnes += tonnes
      }
    }
    return yearly
  } catch (error) {
    console.warn('MapSectionVisual: failed to parse yearly tuna totals.', error)
    return empty
  }
}

const yearlyTotals = parseYearlyTotals()

const countRange = computed(() => {
  const values = Array.from(yearlyTotals.values(), (d) => d.count)
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 1)
  return { min, max }
})

const tonnesRange = computed(() => {
  const values = Array.from(yearlyTotals.values(), (d) => d.tonnes + d.count * COUNT_TO_TONNE)
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 1)
  return { min, max }
})

const currentYearTotals = computed(() => {
  const entry = yearlyTotals.get(currentYear.value) || { count: 0, tonnes: 0 }
  const totalCount = entry.count
  const totalTonnes = entry.tonnes + totalCount * COUNT_TO_TONNE
  return { totalCount, totalTonnes }
})

function clamp01(v) {
  return Math.min(1, Math.max(0, v))
}

function normalize(value, min, max) {
  if (max <= min) return 0
  return clamp01((value - min) / (max - min))
}

function colorByIntensity(intensity) {
  const t = clamp01(intensity)
  const channel = Math.round(122 - 100 * t)
  return `rgb(${channel}, ${channel}, ${channel})`
}

const countNumberColor = computed(() => {
  const t = normalize(currentYearTotals.value.totalCount, countRange.value.min, countRange.value.max)
  return colorByIntensity(t)
})

const tonnesNumberColor = computed(() => {
  const t = normalize(currentYearTotals.value.totalTonnes, tonnesRange.value.min, tonnesRange.value.max)
  return colorByIntensity(t)
})

const narrativeCopy = computed(() => {
  if (props.activeStep >= STEP_BAJA && props.activeStep <= STEP_BAJA_LINGER) {
    return 'Baja California is another rapidly shifting zone, with catches clustering farther north than in previous decades.'
  }
  if (props.activeStep >= STEP_NORTH_ATLANTIC && props.activeStep <= STEP_NORTH_ATLANTIC_LINGER) {
    return 'In the North Atlantic, tuna fishing has moved away from tropical and temperate waters toward the pole.'
  }
  if (props.activeStep >= STEP_RETURN_FULL) {
    return 'Regional hotspots are intensifying while the full ocean picture continues to change.'
  }
  return 'By 2023, global bluefin catches show clear large-scale redistribution before regional hotspots come into focus.'
})

function overlayOpacity(region) {
  if (region === 'north') {
    return props.activeStep >= STEP_NORTH_ATLANTIC && props.activeStep <= STEP_NORTH_ATLANTIC_LINGER ? 1 : 0
  }
  if (region === 'baja') {
    return props.activeStep >= STEP_BAJA && props.activeStep <= STEP_BAJA_LINGER ? 1 : 0
  }
  return 0
}

function formatCount(v) {
  return Math.round(v).toLocaleString()
}

function formatTonnes(v) {
  return v.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

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

function cameraForStep(stepIndex) {
  const cameraPadding = window.innerWidth < 900
    ? { top: 24, right: 24, bottom: 24, left: 64 }
    : { top: 24, right: 40, bottom: 24, left: 220 }
  if (stepIndex >= STEP_BAJA && stepIndex <= STEP_BAJA_LINGER) {
    return { key: 'baja', center: [-114.5, 27.6], zoom: 3.5, duration: 2600, padding: cameraPadding }
  }
  if (stepIndex >= STEP_NORTH_ATLANTIC && stepIndex <= STEP_NORTH_ATLANTIC_LINGER) {
    return { key: 'northAtlantic', center: [-20, 45], zoom: 3.35, duration: 2600, padding: cameraPadding }
  }
  return { key: 'global', center: [0, 0], zoom: 1.25, duration: 2600, padding: cameraPadding }
}

function updateCameraForStep(stepIndex, force = false) {
  if (!map || !mapReady.value) return
  const nextCamera = cameraForStep(stepIndex)
  if (!force && activeCameraKey === nextCamera.key) return
  activeCameraKey = nextCamera.key
  map.stop()
  map.easeTo({
    center: nextCamera.center,
    zoom: nextCamera.zoom,
    padding: nextCamera.padding,
    duration: nextCamera.duration,
    essential: true,
  })
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
    updateCameraForStep(props.activeStep, true)
  })

  resizeObserver = new ResizeObserver(() => {
    if (!map || !mapReady.value) return
    map.resize()
    updateCameraForStep(props.activeStep, true)
  })
  if (mapRef.value) resizeObserver.observe(mapRef.value)
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

    <div class="hud-row">
      <div class="metrics-card">
        <p class="year-text">{{ currentYear }}</p>
        <p class="metric-line">
          <span class="metric-caption">Total fish caught:</span>
          <span class="metric-value" :style="{ color: countNumberColor }">{{ formatCount(currentYearTotals.totalCount) }}</span>
        </p>
        <p class="metric-line">
          <span class="metric-caption">Total catch:</span>
          <span class="metric-value" :style="{ color: tonnesNumberColor }">{{ formatTonnes(currentYearTotals.totalTonnes) }} tonnes</span>
        </p>
        <p class="metric-line metric-line-temp">
          <span class="metric-caption">Global ocean temperature:</span>
          <span>—</span>
        </p>
      </div>
      <div class="copy-card">
        <p>{{ narrativeCopy }}</p>
      </div>
    </div>

    <div class="callout-layer">
      <div class="region-callout north-callout" :style="{ opacity: overlayOpacity('north') }">
        <div class="callout-circle"></div>
        <p class="callout-label">warming quickly!</p>
      </div>
      <div class="region-callout baja-callout" :style="{ opacity: overlayOpacity('baja') }">
        <div class="callout-circle"></div>
        <p class="callout-label">warming quickly!</p>
      </div>
    </div>

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
}

.hud-row {
  position: absolute;
  left: 0.85rem;
  top: 0.85rem;
  z-index: 7;
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
}

.metrics-card {
  margin: 0;
  padding: 0.7rem 0.8rem;
  border-radius: 0.55rem;
  border: 1px solid rgba(15, 23, 42, 0.2);
  background: rgba(255, 255, 255, 0.92);
  color: #000000;
  min-width: min(280px, calc(100% - 2rem));
  max-width: min(320px, calc(100% - 2rem));
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.18);
}

.copy-card {
  margin: 0;
  padding: 0.7rem 0.8rem;
  border-radius: 0.55rem;
  border: 1px solid rgba(15, 23, 42, 0.2);
  background: rgba(255, 255, 255, 0.92);
  color: #000000;
  min-width: min(360px, calc(100vw - 2rem));
  max-width: min(440px, calc(100vw - 2rem));
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.18);
}

.copy-card p {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.35;
}

.year-text {
  margin: 0 0 0.35rem;
  color: #000000;
  font-size: clamp(1.6rem, 2.9vw, 2.4rem);
  line-height: 1;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.metric-line {
  margin: 0.2rem 0;
  color: #000000;
  font-size: 0.85rem;
  line-height: 1.35;
}

.metric-caption {
  font-weight: 700;
  margin-right: 0.35rem;
}

.metric-value {
  font-weight: 600;
}

.metric-line-temp {
  margin-top: 0.4rem;
}

.callout-layer {
  position: absolute;
  inset: 0;
  z-index: 6;
  pointer-events: none;
}

.region-callout {
  position: absolute;
  width: 16vmin;
  min-width: 120px;
  max-width: 210px;
  aspect-ratio: 1 / 1;
  transform: translate(-50%, -50%);
  transition: opacity 520ms ease;
}

.north-callout {
  left: 47%;
  top: 29%;
}

.baja-callout {
  left: 26%;
  top: 44%;
}

.callout-circle {
  width: 100%;
  height: 100%;
  border: 4px solid rgba(220, 38, 38, 0.88);
  border-radius: 999px;
}

.callout-label {
  position: absolute;
  right: -12%;
  top: -10%;
  margin: 0;
  color: rgba(185, 28, 28, 0.96);
  font-size: clamp(0.8rem, 1.1vw, 1.05rem);
  font-weight: 700;
  transform: rotate(20deg);
  text-transform: lowercase;
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

@media (max-width: 1100px) {
  .hud-row {
    max-width: calc(100% - 1.7rem);
    flex-direction: column;
    gap: 0.45rem;
  }

  .copy-card {
    min-width: min(300px, calc(100vw - 2rem));
    max-width: min(420px, calc(100vw - 2rem));
  }
}
</style>

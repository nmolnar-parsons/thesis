<script setup>
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import tunaCatchData5degUrl from '../data/tuna_data/cwp-grid-5deg-catch-bluefin.geojson?url'
import tunaCatchData5degRaw from '../data/tuna_data/cwp-grid-5deg-catch-bluefin.geojson?raw'
/** 1° grid (~28 MB): Mediterranean/Baja zoom only; URL for Mapbox + async HUD totals. */
import tunaCatchData1degUrl from '../data/tuna_data/bluefin-cwp-grid-1deg-catch.geojson?url'

const YEAR_START = 1965
const YEAR_END = 2023
/** Mediterranean/Baja: replay years on the fine grid before advancing the story. */
const REGION_YEAR_START = 2007
const REGION_YEAR_END = 2023
const DEFAULT_PROJECTION = 'winkelTripel'
/** 250 kg per bluefin on average; convert head-count to metric tonnes. */
const COUNT_TO_TONNE = 250 / 1000
/** Lowest tier on catch scale (tonnes = 0): base “ocean” fill. */
const CATCH_SCALE_ZERO_COLOR = '#13265f'
/** Upper bounds for each ramp step (Mapbox `step`: default color applies below first stop). */
const CATCH_TONNE_STEP_STOPS = [25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000]
/** Must align with stops: index 0 = below 25 t, then one color per interval. */
const CATCH_COLOR_RAMP = [
  CATCH_SCALE_ZERO_COLOR,
  '#0b3c78',
  '#0f558f',
  '#1270a5',
  '#1f88bb',
  '#3ea2cf',
  '#67b9de',
  '#8dcdea',
  '#b7def4',
  '#deeffa',
  '#ffffff',
]

function buildCatchTonnesStepExpression(valueExpr) {
  const expr = ['step', valueExpr, CATCH_COLOR_RAMP[0]]
  for (let i = 0; i < CATCH_TONNE_STEP_STOPS.length; i += 1) {
    expr.push(CATCH_TONNE_STEP_STOPS[i], CATCH_COLOR_RAMP[i + 1])
  }
  return expr
}
const STEP_YEAR_FULLVIEW_END = 4
/** Full global view, year already at 2023; extra scroll beats before regional zoom. */
const STEP_FULLVIEW_LINGER_START = 5
const STEP_FULLVIEW_LINGER_END = 8
const STEP_MEDITERRANEAN = 9
const STEP_MEDITERRANEAN_LINGER = 10
/** Mediterranean camera + circle callout (two scroll beats before annotation). */
const STEP_MEDITERRANEAN_ANNOTATION = 11
const STEP_BAJA = 12
/** Baja narrative 2 + circle callout (mirrors Mediterranean annotation step). */
const STEP_BAJA_ANNOTATION = 13
/** Global return + trailing scroll padding (indices 14–16 → m15–m17). */
const STEP_RETURN_FULL = 14

const props = defineProps({
  activeStep: { type: Number, default: 0 },
  /** Scrollama progress through the current step, roughly 0–1. */
  stepProgress: { type: Number, default: 0 },
  stepCount: { type: Number, default: 17 },
})

const MEDITERRANEAN_NARRATIVE_BEFORE_ANNOTATION =
  'Med Filler'
const MEDITERRANEAN_NARRATIVE_WITH_ANNOTATION =
  'Med Filler Anno'
const BAJA_NARRATIVE_BEFORE_ANNOTATION =
  'Baja Filler'
const BAJA_NARRATIVE_WITH_ANNOTATION =
  'Baja Filler Anno'
const LINGER_2023_FILLER = 'filler for 2023 linger'
const DEFAULT_FILLER = 'default filler'

const mapRef = ref(null)
const mapReady = ref(false)
const tokenMissing = ref(false)
let map = null
let resizeObserver = null
let activeCameraKey = ''
/** Avoid redundant GeoJSON `setData` when resolution matches. */
let lastLoadedTunaDataUrl = ''

function clamp01(v) {
  return Math.min(1, Math.max(0, v))
}

const usingHighResData = computed(
  () =>
    (props.activeStep >= STEP_MEDITERRANEAN && props.activeStep <= STEP_MEDITERRANEAN_ANNOTATION)
    || (props.activeStep >= STEP_BAJA && props.activeStep <= STEP_BAJA_ANNOTATION),
)

const currentYear = computed(() => {
  const step = props.activeStep
  const prog = props.stepProgress
  if (step >= STEP_MEDITERRANEAN && step <= STEP_MEDITERRANEAN_ANNOTATION) {
    const nSteps = STEP_MEDITERRANEAN_ANNOTATION - STEP_MEDITERRANEAN + 1
    const t = clamp01((step - STEP_MEDITERRANEAN + prog) / nSteps)
    const spanY = REGION_YEAR_END - REGION_YEAR_START
    return Math.min(REGION_YEAR_END, Math.max(REGION_YEAR_START, Math.round(REGION_YEAR_START + t * spanY)))
  }
  if (step >= STEP_BAJA && step <= STEP_BAJA_ANNOTATION) {
    const nSteps = STEP_BAJA_ANNOTATION - STEP_BAJA + 1
    const t = clamp01((step - STEP_BAJA + prog) / nSteps)
    const spanY = REGION_YEAR_END - REGION_YEAR_START
    return Math.min(REGION_YEAR_END, Math.max(REGION_YEAR_START, Math.round(REGION_YEAR_START + t * spanY)))
  }
  if (step >= STEP_RETURN_FULL || step > STEP_YEAR_FULLVIEW_END) {
    return YEAR_END
  }
  const spanSteps = Math.max(1, STEP_YEAR_FULLVIEW_END + 1)
  const timelinePos = step + prog
  if (timelinePos >= spanSteps) return YEAR_END
  const yearT = timelinePos / spanSteps
  const span = YEAR_END - YEAR_START
  return Math.min(YEAR_END, Math.max(YEAR_START, Math.round(YEAR_START + yearT * span)))
})

function buildEmptyYearlyTonnesOnly() {
  const yearly = new Map()
  for (let y = YEAR_START; y <= YEAR_END; y += 1) {
    yearly.set(y, { tonnes: 0 })
  }
  return yearly
}

function parseYearlyTotals5deg() {
  const empty = new Map()
  try {
    const parsed = JSON.parse(tunaCatchData5degRaw)
    const features = Array.isArray(parsed?.features) ? parsed.features : []
    const yearly = new Map()
    for (let y = YEAR_START; y <= YEAR_END; y += 1) {
      yearly.set(y, { count: 0, tonnes: 0 })
    }
    for (const feature of features) {
      const fp = feature?.properties || {}
      for (let y = YEAR_START; y <= YEAR_END; y += 1) {
        const count = Number(fp[`count_${y}`]) || 0
        const tonnes = Number(fp[`tonne_${y}`]) || 0
        const entry = yearly.get(y)
        entry.count += count
        entry.tonnes += tonnes
      }
    }
    return yearly
  } catch (error) {
    console.warn('MapSectionVisual: failed to parse 5deg yearly totals.', error)
    return empty
  }
}

const yearlyTotals5deg = parseYearlyTotals5deg()

/** 1° GeoJSON has `tonne_*` only; fish count for HUD is derived from tonnes. */
function aggregateYearlyTonnesFromFeatures(features) {
  const yearly = buildEmptyYearlyTonnesOnly()
  if (!Array.isArray(features)) return yearly
  for (const feature of features) {
    const fp = feature?.properties || {}
    for (let y = YEAR_START; y <= YEAR_END; y += 1) {
      const raw = fp[`tonne_${y}`]
      const tonnes = raw == null || raw === '' ? 0 : Number(raw) || 0
      yearly.get(y).tonnes += tonnes
    }
  }
  return yearly
}

const yearlyTotals1deg = ref(buildEmptyYearlyTonnesOnly())

async function loadYearlyTotals1degFromUrl() {
  try {
    const res = await fetch(tunaCatchData1degUrl)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const parsed = await res.json()
    yearlyTotals1deg.value = aggregateYearlyTonnesFromFeatures(parsed?.features)
  } catch (error) {
    console.warn('MapSectionVisual: failed to load 1deg yearly totals.', error)
  }
}

const countRange = computed(() => {
  if (usingHighResData.value) {
    const values = Array.from(yearlyTotals1deg.value.values(), (d) => Math.round(d.tonnes / COUNT_TO_TONNE))
    const min = Math.min(...values, 0)
    const max = Math.max(...values, 1)
    return { min, max }
  }
  const values = Array.from(yearlyTotals5deg.values(), (d) => d.count)
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 1)
  return { min, max }
})

const tonnesRange = computed(() => {
  if (usingHighResData.value) {
    const values = Array.from(yearlyTotals1deg.value.values(), (d) => d.tonnes)
    const min = Math.min(...values, 0)
    const max = Math.max(...values, 1)
    return { min, max }
  }
  const values = Array.from(yearlyTotals5deg.values(), (d) => d.tonnes + d.count * COUNT_TO_TONNE)
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 1)
  return { min, max }
})

const currentYearTotals = computed(() => {
  const cy = currentYear.value
  if (usingHighResData.value) {
    const tonnes = yearlyTotals1deg.value.get(cy)?.tonnes ?? 0
    return { totalCount: Math.round(tonnes / COUNT_TO_TONNE), totalTonnes: tonnes }
  }
  const entry = yearlyTotals5deg.get(cy) || { count: 0, tonnes: 0 }
  const totalCount = entry.count
  const totalTonnes = entry.tonnes + totalCount * COUNT_TO_TONNE
  return { totalCount, totalTonnes }
})

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
  if (props.activeStep >= STEP_FULLVIEW_LINGER_START && props.activeStep <= STEP_FULLVIEW_LINGER_END) {
    return LINGER_2023_FILLER
  }
  if (props.activeStep >= STEP_MEDITERRANEAN && props.activeStep < STEP_MEDITERRANEAN_ANNOTATION) {
    return MEDITERRANEAN_NARRATIVE_BEFORE_ANNOTATION
  }
  if (props.activeStep === STEP_MEDITERRANEAN_ANNOTATION) {
    return MEDITERRANEAN_NARRATIVE_WITH_ANNOTATION
  }
  if (props.activeStep === STEP_BAJA) {
    return BAJA_NARRATIVE_BEFORE_ANNOTATION
  }
  if (props.activeStep === STEP_BAJA_ANNOTATION) {
    return BAJA_NARRATIVE_WITH_ANNOTATION
  }
  if (props.activeStep >= STEP_RETURN_FULL) {
    return 'Regional hotspots are intensifying while the full ocean picture continues to change.'
  }
  return DEFAULT_FILLER
})

function overlayOpacity(region) {
  if (region === 'mediterranean') {
    return props.activeStep === STEP_MEDITERRANEAN_ANNOTATION ? 1 : 0
  }
  if (region === 'baja') {
    return props.activeStep === STEP_BAJA_ANNOTATION ? 1 : 0
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
  const combinedTonnes = usingHighResData.value
    ? ['coalesce', ['get', `tonne_${y}`], 0]
    : [
        '+',
        ['coalesce', ['get', `tonne_${y}`], 0],
        ['*', COUNT_TO_TONNE, ['coalesce', ['get', `count_${y}`], 0]],
      ]
  return buildCatchTonnesStepExpression(combinedTonnes)
})

function syncTunaCatchSourceToResolution() {
  if (!map || !mapReady.value) return
  const src = map.getSource('tuna-catch')
  if (!src || typeof src.setData !== 'function') return
  const nextUrl = usingHighResData.value ? tunaCatchData1degUrl : tunaCatchData5degUrl
  if (nextUrl === lastLoadedTunaDataUrl) {
    updateCatchLayer()
    return
  }
  lastLoadedTunaDataUrl = nextUrl
  src.setData(nextUrl)
  map.once('idle', () => {
    applyTunaCatchFillSeamMitigation()
    updateCatchLayer()
  })
}

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

function applyTunaCatchFillSeamMitigation() {
  if (!map || !mapReady.value || !map.getLayer('tuna-catch-fill')) return
  // Reduces light “grid lines” between cells (anti-alias fringe over map water).
  map.setPaintProperty('tuna-catch-fill', 'fill-antialias', false)
}

function cameraForStep(stepIndex) {
  const cameraPadding = window.innerWidth < 900
    ? { top: 24, right: 24, bottom: 24, left: 64 }
    : { top: 24, right: 40, bottom: 24, left: 220 }
  if (stepIndex >= STEP_BAJA && stepIndex <= STEP_BAJA_ANNOTATION) {
    return { key: 'baja', center: [-114.5, 27.6], zoom: 3.5, duration: 2600, padding: cameraPadding }
  }
  if (stepIndex >= STEP_MEDITERRANEAN && stepIndex <= STEP_MEDITERRANEAN_ANNOTATION) {
    return { key: 'mediterranean', center: [14, 38], zoom: 4.35, duration: 2600, padding: cameraPadding }
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
  loadYearlyTotals1degFromUrl()

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
    lastLoadedTunaDataUrl = tunaCatchData5degUrl
    map.addSource('tuna-catch', {
      type: 'geojson',
      data: tunaCatchData5degUrl,
    })

    map.addLayer({
      id: 'tuna-catch-fill',
      type: 'fill',
      source: 'tuna-catch',
      paint: {
        'fill-color': tunaColorExpression.value,
        'fill-opacity': 0.95,
        'fill-antialias': false,
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
          'fill-color': '#13265f',
          'fill-opacity': 1
      }
    })

    mapReady.value = true
    hideMapLabels()
    setProjection()
    neutralizeWaterColor()
    applyTunaCatchFillSeamMitigation()
    syncTunaCatchSourceToResolution()
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

watch(usingHighResData, () => {
  syncTunaCatchSourceToResolution()
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  if (map) map.remove()
  map = null
  lastLoadedTunaDataUrl = ''
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
        <p v-if="narrativeCopy" class="narrative-copy">{{ narrativeCopy }}</p>
      </div>
    </div>

    <div class="callout-layer">
      <div class="region-callout mediterranean-callout" :style="{ opacity: overlayOpacity('mediterranean') }">
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
  max-width: calc(100% - 1.7rem);
}

.metrics-card {
  margin: 0;
  padding: 0.7rem 0.8rem;
  border-radius: 0.55rem;
  border: 1px solid rgba(15, 23, 42, 0.2);
  background: rgba(255, 255, 255, 0.92);
  color: #000000;
  min-width: min(280px, calc(100% - 2rem));
  max-width: min(440px, calc(100vw - 2rem));
}

.narrative-copy {
  margin: 0.55rem 0 0;
  padding-top: 0.55rem;
  border-top: 1px solid rgba(15, 23, 42, 0.12);
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

.mediterranean-callout {
  left: 46%;
  top: 44%;
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

</style>

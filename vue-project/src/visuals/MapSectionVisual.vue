<script setup>
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import tunaCatchData5degUrl from '../data/tuna_data/cwp-grid-5deg-catch-bluefin.geojson?url'
import tunaCatchData5degRaw from '../data/tuna_data/cwp-grid-5deg-catch-bluefin.geojson?raw'

const YEAR_START = 1965
const YEAR_END = 2023
/** Mediterranean zoom: replay years before advancing the story. */
const REGION_YEAR_START = 2007
const REGION_YEAR_END = 2023
const DEFAULT_PROJECTION = 'naturalEarth'
/** 250 kg per bluefin on average; convert head-count to metric tonnes. */
const COUNT_TO_TONNE = 250 / 1000
/** Lowest tier on catch scale (tonnes = 0): base “ocean” fill. */
const CATCH_SCALE_ZERO_COLOR = '#13265f'
/** Upper bounds for each ramp step (Mapbox `step`: default color applies below first stop). */
const CATCH_TONNE_STEP_STOPS = [100, 250, 500, 1000, 2000, 4000, 7000, 12000, 18000, 28000]
/** Must align with stops: index 0 = below 100 t, then one color per interval. */
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
/** Mediterranean zoom: year scrub, then basin annotation + linger at 2023. */
const STEP_MEDITERRANEAN = 9
/** Last step where the regional year advances (then 2023 through callout + linger). */
const STEP_MEDITERRANEAN_YEAR_END = 11
/** First Mediterranean beat after year scrub, fixed at 2023. */
const STEP_MEDITERRANEAN_2023_CALLOUT = STEP_MEDITERRANEAN_YEAR_END + 1
/** Extra pacing on Med at 2023 while the ellipse remains (mirrors global linger). */
const STEP_MEDITERRANEAN_LINGER_START = 13
const STEP_MEDITERRANEAN_LINGER_END = 16
/** Last Med-framed scroll step before easing back to global. */
const STEP_MEDITERRANEAN_END = STEP_MEDITERRANEAN_LINGER_END
/** Global return + trailing scroll padding (indices 17–19 → m18–m20). */
const STEP_RETURN_FULL = 17
const STEP_ANIMATION_DURATION_MS = 2600

function stepAnimationEasing(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - ((-2 * t + 2) ** 3) / 2
}

const props = defineProps({
  activeStep: { type: Number, default: 0 },
  /** Scrollama progress through the current step, roughly 0–1. */
  stepProgress: { type: Number, default: 0 },
  stepCount: { type: Number, default: 20 },
  minimalMode: { type: Boolean, default: false },
})

const MEDITERRANEAN_NARRATIVE_BEFORE_ANNOTATION =
  'Med Filler'
const MEDITERRANEAN_NARRATIVE_WITH_ANNOTATION =
  'Med Filler Anno'
const LINGER_2023_FILLER = 'filler for 2023 linger'
const DEFAULT_FILLER = 'default filler'

const mapRef = ref(null)
const mapReady = ref(false)
const tokenMissing = ref(false)
let map = null
let resizeObserver = null
let activeCameraKey = ''

function clamp01(v) {
  return Math.min(1, Math.max(0, v))
}

const currentYear = computed(() => {
  const step = props.activeStep
  const prog = props.stepProgress
  if (step >= STEP_MEDITERRANEAN && step <= STEP_MEDITERRANEAN_YEAR_END) {
    const nSteps = STEP_MEDITERRANEAN_YEAR_END - STEP_MEDITERRANEAN + 1
    const t = clamp01((step - STEP_MEDITERRANEAN + prog) / nSteps)
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

const countRange = computed(() => {
  const values = Array.from(yearlyTotals5deg.values(), (d) => d.count)
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 1)
  return { min, max }
})

const currentYearTotals = computed(() => {
  const cy = currentYear.value
  const entry = yearlyTotals5deg.get(cy) || { count: 0, tonnes: 0 }
  const totalCount = entry.count
  return { totalCount }
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

const mapLegendGradient = `linear-gradient(to right, ${CATCH_COLOR_RAMP.join(', ')})`

const narrativeCopy = computed(() => {
  if (props.activeStep >= STEP_FULLVIEW_LINGER_START && props.activeStep <= STEP_FULLVIEW_LINGER_END) {
    return LINGER_2023_FILLER
  }
  if (props.activeStep >= STEP_MEDITERRANEAN && props.activeStep <= STEP_MEDITERRANEAN_YEAR_END) {
    return MEDITERRANEAN_NARRATIVE_BEFORE_ANNOTATION
  }
  if (props.activeStep === STEP_MEDITERRANEAN_2023_CALLOUT) {
    return MEDITERRANEAN_NARRATIVE_WITH_ANNOTATION
  }
  if (
    props.activeStep >= STEP_MEDITERRANEAN_LINGER_START
    && props.activeStep <= STEP_MEDITERRANEAN_LINGER_END
  ) {
    return LINGER_2023_FILLER
  }
  if (props.activeStep >= STEP_RETURN_FULL) {
    return 'Regional hotspots are intensifying while the full ocean picture continues to change.'
  }
  return DEFAULT_FILLER
})

function overlayOpacity() {
  const step = props.activeStep
  // Only show the basin annotation during the pre-zoom global 2023 linger;
  // once the camera has eased into the Med, the zoom itself replaces the cue.
  const isGlobalFrozen2023 = step >= STEP_FULLVIEW_LINGER_START && step <= STEP_FULLVIEW_LINGER_END
  return isGlobalFrozen2023 ? 1 : 0
}

function formatCount(v) {
  return Math.round(v).toLocaleString()
}

const tunaColorExpression = computed(() => {
  const y = currentYear.value
  const combinedTonnes = [
    '+',
    ['coalesce', ['get', `tonne_${y}`], 0],
    ['*', COUNT_TO_TONNE, ['coalesce', ['get', `count_${y}`], 0]],
  ]
  return buildCatchTonnesStepExpression(combinedTonnes)
})

/** Mapbox Streets v8 `class` values to keep on `water-point-label`. */
const OCEAN_LABEL_CLASSES = ['ocean']
const OCEAN_LABEL_LAYER_ID = 'water-point-label'
/** Names matched against `name_en`/`name` to suppress (case-insensitive substring). */
const OCEAN_LABEL_SUPPRESS_NAMES = ['Arctic Ocean']
/** Named non-ocean features that join the layer once zoomed past the threshold. */
const OCEAN_LABEL_ZOOM_REVEAL_NAMES = ['Mediterranean Sea']
const OCEAN_LABEL_ZOOM_REVEAL_MIN_ZOOM = 3

function hideMapLabels() {
  if (!map || !mapReady.value) return
  const layers = map.getStyle()?.layers || []
  for (const layer of layers) {
    if (layer.type !== 'symbol') continue
    if (layer.id === OCEAN_LABEL_LAYER_ID) continue
    map.setLayoutProperty(layer.id, 'visibility', 'none')
  }
}

function buildOceanLabelFilter(zoom) {
  const nameExpr = ['coalesce', ['get', 'name_en'], ['get', 'name'], '']
  // Always require: not in suppress list. Then OR together the per-zoom allowlists.
  const allowed = ['any', ['match', ['get', 'class'], OCEAN_LABEL_CLASSES, true, false]]
  if (zoom >= OCEAN_LABEL_ZOOM_REVEAL_MIN_ZOOM) {
    allowed.push(['match', nameExpr, OCEAN_LABEL_ZOOM_REVEAL_NAMES, true, false])
  }
  return [
    'all',
    ['!', ['match', nameExpr, OCEAN_LABEL_SUPPRESS_NAMES, true, false]],
    allowed,
  ]
}

function refreshOceanLabelFilter() {
  if (!map || !mapReady.value) return
  if (!map.getLayer(OCEAN_LABEL_LAYER_ID)) return
  map.setFilter(OCEAN_LABEL_LAYER_ID, buildOceanLabelFilter(map.getZoom()))
}

function showOceanLabelsOnly() {
  if (!map || !mapReady.value) return
  if (!map.getLayer(OCEAN_LABEL_LAYER_ID)) return
  refreshOceanLabelFilter()
  map.on('zoom', refreshOceanLabelFilter)
  map.setLayoutProperty(OCEAN_LABEL_LAYER_ID, 'visibility', 'visible')
  map.setPaintProperty(OCEAN_LABEL_LAYER_ID, 'text-color', '#ffffff')
  map.setPaintProperty(OCEAN_LABEL_LAYER_ID, 'text-opacity', 0.6)
  map.setPaintProperty(OCEAN_LABEL_LAYER_ID, 'text-halo-color', 'rgba(0, 0, 0, 0.55)')
  map.setPaintProperty(OCEAN_LABEL_LAYER_ID, 'text-halo-width', 1.2)
  // Lift labels above the tuna fill and continent overlay we added on top.
  map.moveLayer(OCEAN_LABEL_LAYER_ID)
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
  const cameraPadding = { top: 24, right: 24, bottom: 24, left: 24 }
  if (stepIndex >= STEP_MEDITERRANEAN && stepIndex <= STEP_MEDITERRANEAN_END) {
    return {
      key: 'mediterranean',
      center: [14, 38],
      zoom: 4.35,
      duration: STEP_ANIMATION_DURATION_MS,
      padding: cameraPadding,
    }
  }
  return {
    key: 'global',
    center: [0, 0],
    zoom: 1.25,
    duration: STEP_ANIMATION_DURATION_MS,
    padding: cameraPadding,
  }
}

function updateCameraForStep(stepIndex, force = false) {
  if (!map || !mapReady.value) return
  const nextCamera = cameraForStep(stepIndex)
  if (!force && activeCameraKey === nextCamera.key && props.activeStep !== stepIndex) return
  activeCameraKey = nextCamera.key
  map.stop()
  map.easeTo({
    center: nextCamera.center,
    zoom: nextCamera.zoom,
    padding: nextCamera.padding,
    duration: nextCamera.duration,
    easing: stepAnimationEasing,
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
    /** No default AttributionControl (avoids the compact “i” UI); text links are in the template. */
    attributionControl: false,
    logoPosition: 'bottom-left',
  })

  map.on('load', () => {
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
    showOceanLabelsOnly()
    setProjection()
    neutralizeWaterColor()
    applyTunaCatchFillSeamMitigation()
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
    <h1 class="visual-title visual-title--on-dark map-title">Where Has All the Tuna Gone?</h1>
    <div ref="mapRef" class="map-host" />

    <div class="hud-row">
      <div class="metrics-card">
        <p class="year-text">{{ currentYear }}</p>
        <div v-if="!minimalMode" class="metrics-card-details">
          <p class="metric-line">
            <span class="metric-caption">Total fish caught:</span>
            <span class="metric-value" :style="{ color: countNumberColor }">{{ formatCount(currentYearTotals.totalCount) }}</span>
          </p>
          <p class="metric-line metric-line-temp">
            <span class="metric-caption">Global ocean temperature:</span>
            <span>—</span>
          </p>
          <p v-if="narrativeCopy" class="narrative-copy">{{ narrativeCopy }}</p>
        </div>
      </div>
    </div>

    <div class="callout-layer">
      <div
        class="region-callout mediterranean-callout"
        aria-hidden="true"
        :style="{ opacity: overlayOpacity() }"
      >
        <svg
          class="callout-shape mediterranean-basin-shape"
          viewBox="0 0 400 145"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <path
            d="M179.03,170.1c-40.81,0-74.13-3.38-104.86-10.64-16.8-3.97-31.03-9.48-43.49-16.86-10.19-6.03-17.38-12.15-22.64-19.26-9.44-12.76-10.55-26-3.4-40.47,3.54-7.15,8.88-13.85,16.81-21.07,16.03-14.6,35.85-26.2,62.38-36.52,26.76-10.41,57.07-17.55,92.64-21.85,18.92-2.28,38.6-3.44,58.5-3.44s41.82,1.22,63.59,3.63c40.85,4.52,73.51,11.77,102.78,22.81,3.46,1.3,6.92,2.93,10.28,4.5l2.07.97c2.67,1.24,2.32,2.22,1.98,3.15-.1.28-.2.56-1.01.56-.46,0-1.24-.11-2.39-.63-21.74-9.85-45.5-14.84-66.46-19.25-23.8-5-49.22-8.23-80-10.16-10.48-.66-21.04-.99-31.39-.99-37.42,0-74.51,4.37-110.26,12.98-27.22,6.56-50.79,15.66-72.06,27.82-13.7,7.84-23.96,15.64-32.28,24.56-4,4.29-7.15,8.38-9.62,12.5-8.83,14.73-7.26,29.43,4.43,41.38,5.29,5.41,11.77,10.49,19.26,15.1,16.66,10.24,35.33,14.95,49.73,17.9,29.56,6.07,61.49,8.77,103.54,8.77h2.09c57.96-1.32,107.47-7.04,151.43-17.5,14.46-3.44,31.36-8.03,47.12-16,7.58-3.83,13.93-7.82,19.43-12.2,4.29-3.41,8.32-8.19,11.34-13.45,7.27-12.66,5.07-25.78-5.89-35.11-5.61-4.78-12.33-9.11-19.97-12.88-18.08-8.92-38.19-15.93-63.31-22.05-18.76-4.57-37.49-6.22-54.94-7.32-.49-.03-.99-.05-1.49-.07-1.5-.05-2.91-.11-3.85-.53-.44-.2-1.1-.81-1.45-1.26.32-.62,1.09-1.54,1.92-1.99.1-.05.43-.18,1.44-.18.41,0,.82.02,1.23.03.48.02.96.04,1.43.04h.17c.69,0,1.38-.01,2.06-.01,26.57,0,53.86,4.94,83.42,15.11,12.78,4.4,25.78,9.76,39.74,16.39,6.07,2.88,12.33,7.26,18.11,12.65,10.55,9.85,13.03,23.34,6.79,37.01-3.07,6.75-7.78,12.61-14.4,17.94-12.19,9.81-26.41,15.55-37.43,19.45-22.84,8.09-47.84,13.8-81.05,18.51-32.71,4.64-66.05,7.26-99.1,7.79-4.43.07-8.8.11-12.99.11Z"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
            vector-effect="non-scaling-stroke"
          />
        </svg>
      </div>
    </div>

    <p v-if="tokenMissing" class="token-warning">
      Add `VITE_MAPBOX_TOKEN` in your local `.env` to render the map.
    </p>

    <aside class="map-legend" aria-label="Catch intensity legend">
      <div class="map-legend-bar" :style="{ background: mapLegendGradient }" />
      <div class="map-legend-labels">
        <span>low catch</span>
        <span>high catch</span>
      </div>
    </aside>

    <div v-if="!tokenMissing" class="map-attrib-bar">
      <span class="map-attrib-bar__logo-gap" aria-hidden="true" />
      <span class="map-attrib-sep" aria-hidden="true">·</span>
      <p class="map-attribution-text">
        <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener noreferrer">© Mapbox</a>
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a>
        <a href="https://apps.mapbox.com/feedback/" target="_blank" rel="noopener noreferrer">Improve this map</a>
      </p>
    </div>
  </div>
</template>

<style scoped>
.map-frame {
  --map-attrib-chrome-font-size: 0.75rem;
  /* Align bottom chrome with year card left edge (.hud-row); bottom with legend */
  --map-hud-inset-left: 0.85rem;
  --map-bottom-chrome: 0.45rem;
  position: relative;
  width: 100%;
  height: 100%;
  font-family: var(--font-ui);
  font-weight: var(--font-weight-ui);
}

.map-title {
  position: absolute;
  top: 0.6rem;
  left: 50%;
  z-index: 9;
  margin: 0;
  padding: 0;
  transform: translateX(-50%);
  width: calc(100% - 2rem);
  pointer-events: none;
}

.map-host {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* Inset only — do not override logo dimensions (Mapbox default wordmark size) */
.map-host :deep(.mapboxgl-ctrl-bottom-left) {
  left: var(--map-hud-inset-left);
  bottom: var(--map-bottom-chrome);
}

/* Optical alignment with attribution row; does not move legend or .map-attrib-bar */
.map-host :deep(.mapboxgl-ctrl-logo) {
  /* Was 50% down; nudge up by 1/4 logo height → net 25% down from default */
  transform: translateY(40%);
}

.map-attrib-bar {
  position: absolute;
  left: var(--map-hud-inset-left);
  bottom: var(--map-bottom-chrome);
  z-index: 6;
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0.3rem;
  max-width: min(calc(100% - 10rem), 520px);
  font-size: var(--map-attrib-chrome-font-size);
  line-height: 1.2;
  pointer-events: none;
}

/* ~default wordmark width so dot + attribution clear the logo */
.map-attrib-bar__logo-gap {
  flex: 0 0 5.5rem;
  width: 5.5rem;
  pointer-events: none;
}

.map-attrib-sep {
  flex-shrink: 0;
  color: rgba(15, 23, 42, 0.4);
  font-weight: 600;
  pointer-events: none;
}

.map-attribution-text {
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  box-shadow: none;
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
  font: inherit;
  font-size: 1em;
  color: rgba(15, 23, 42, 0.75);
  pointer-events: auto;
}

.map-attribution-text a {
  flex-shrink: 0;
  color: rgba(15, 23, 42, 0.55);
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* Nudge up by 1px so year cap-height lines up with .map-title (card top border) */
.hud-row {
  position: absolute;
  left: var(--map-hud-inset-left);
  top: calc(0.6rem - 1px);
  z-index: 7;
  max-width: calc(100% - 1.7rem);
}

.metrics-card {
  box-sizing: border-box;
  margin: 0;
  padding: 0 0.8rem 0.7rem 0.8rem;
  border-radius: 0;
  border: 1px solid rgba(15, 23, 42, 0.2);
  background: rgba(255, 255, 255, 0.92);
  color: #000000;
  width: fit-content;
  max-width: min(440px, 100%);
}

.metrics-card-details {
  margin-top: var(--space-visual-title-gap);
  padding-top: var(--space-visual-title-gap);
  border-top: 1px solid rgba(15, 23, 42, 0.14);
}

.narrative-copy {
  margin: 0.55rem 0 0;
  padding-top: 0.55rem;
  border-top: 1px solid rgba(15, 23, 42, 0.12);
  font-size: 0.92rem;
  line-height: 1.35;
}

.map-hud-title {
  margin: 0 0 0.55rem;
  padding: 0;
  color: #0f172a;
  font-size: clamp(1.25rem, 2.6vw, 1.7rem);
  line-height: 1.2;
  font-weight: 800;
  letter-spacing: 0.01em;
}

.map-legend {
  position: absolute;
  right: var(--map-hud-inset-left);
  bottom: var(--map-bottom-chrome);
  z-index: 7;
  width: min(300px, 72vw);
  padding: var(--viz-legend-padding);
  border: var(--viz-legend-border);
  border-radius: 0;
  background: var(--viz-legend-bg);
  box-shadow: none;
}

.map-legend-bar {
  width: 100%;
  height: 12px;
  border-radius: 0;
  border: 1px solid rgba(15, 23, 42, 0.18);
}

.map-legend-labels {
  margin-top: 0.28rem;
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-ui);
  line-height: var(--viz-legend-line-height);
  color: #0f172a;
}

.year-text {
  margin: 0;
  padding: 0;
  color: #000000;
  font-family: var(--font-visual-title);
  font-size: var(--font-size-visual-title);
  font-weight: var(--font-weight-visual-title);
  line-height: var(--line-height-visual-title);
}

.metric-line {
  margin: 0.2rem 0;
  color: #000000;
  font-size: var(--font-size-ui);
  line-height: 1.35;
}

.metric-caption {
  font-weight: var(--font-weight-ui);
  margin-right: 0.35rem;
}

.metric-value {
  font-weight: var(--font-weight-ui);
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
  pointer-events: none;
  transition: opacity 520ms ease;
}

.mediterranean-callout {
  left: 52%;
  top: 30%;
  width: min(27.2vmin, 344px);
  aspect-ratio: 427.36 / 170.1;
  transform: translate(-50%, -50%);
}

.callout-shape {
  width: 100%;
  height: 100%;
  display: block;
  overflow: visible;
}

.mediterranean-basin-shape path {
  fill: none;
  stroke: rgb(255, 255, 255);
  stroke-width: 3.5;
}

@media (max-width: 520px) {
  .map-frame {
    --map-attrib-chrome-font-size: 0.65rem;
  }

  .map-attrib-bar__logo-gap {
    flex: 0 0 5rem;
    width: 5rem;
  }

  .map-attrib-bar {
    flex-wrap: wrap;
    max-width: calc(100% - 1rem);
  }

  .map-attribution-text {
    flex-wrap: wrap;
  }
}

@media (max-width: 900px) {
  .mediterranean-callout {
    left: 50%;
    top: 30%;
    width: min(41.6vmin, 272px);
  }

  .map-title {
    top: 0.4rem;
    width: calc(100% - 1rem);
  }

  .hud-row {
    top: calc(0.4rem - 1px);
  }

  .map-legend {
    width: min(240px, 76vw);
  }
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
  font-family: var(--font-ui);
  font-weight: var(--font-weight-copy);
}

</style>

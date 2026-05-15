<script setup>
import { scaleBand, scaleLinear } from 'd3-scale'
import { select } from 'd3-selection'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import gtaFirmsTunaCsvRaw from '../data/GTA_FIRMs_tuna_cleaned_grouped.csv?raw'
import tunaCatchData5degUrl from '../data/tuna_data/cwp-grid-5deg-catch-bluefin.geojson?url'
import iccatFishFarmsCentroidsUrl from '../data/iccat_fish_farms_centroids.geojson?url'
import { readColorDefaultBlue, readColorTunaFarmed } from '../utils/readStoryColors.js'
import { readStoryScale } from '../utils/readStoryScale.js'

const YEAR_START = 1965
const YEAR_END = 2023
/** FAO bluefin stock codes; summed for HUD totals (matches TunaStackedBarsVisual). */
const BLUEFIN_STACK_SPECIES = ['BFT', 'PBF', 'SBF']
/** Fixed y-scale (tonnes), matched with TunaStackedBarsVisual. */
const HUD_CHART_Y_MAX = 120_000
const DEFAULT_PROJECTION = 'naturalEarth'
/** 1 bluefin ≈ 250 kg = 1/4 tonne. Converts head-count (`count_${y}`) to metric tonnes. */
const COUNT_TO_TONNE = 1 / 4
/** Inverse: 1 tonne ≈ 4 bluefin. Converts weight (`tonne_${y}`) to head-count. */
const TONNE_TO_COUNT = 1 / COUNT_TO_TONNE
/** Upper bounds for each ramp step (Mapbox `step`: default color applies below first stop). */
const CATCH_TONNE_STEP_STOPS = [25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000]
const CATCH_TONNE_LEGEND_TICKS = ['0', '100', '1000', '10000']
const CATCH_TONNE_LEGEND_TITLE = 'Bluefin Tuna Catch (tonnes)'

/**
 * Colors above `--color-default-blue` tier. Must align in length with CATCH_TONNE_STEP_STOPS.
 */
const CATCH_COLOR_RAMP_ABOVE_ZERO = [
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

/** `lowestTierHex` defaults from `--color-default-blue` (`readColorDefaultBlue`). */
function buildCatchTonnesStepExpression(valueExpr, lowestTierHex = readColorDefaultBlue()) {
  const expr = ['step', valueExpr, lowestTierHex]
  for (let i = 0; i < CATCH_TONNE_STEP_STOPS.length; i += 1) {
    expr.push(CATCH_TONNE_STEP_STOPS[i], CATCH_COLOR_RAMP_ABOVE_ZERO[i])
  }
  return expr
}
const STEP_YEAR_FULLVIEW_END = 4
/** Full global view, year already at 2023; extra scroll beats before regional zoom. */
const STEP_FULLVIEW_LINGER_START = 5
const STEP_FULLVIEW_LINGER_END = 8
/** Mediterranean basin SVG callout: first shown at Map.vue `m8` (step index 7), not m6–m7. */
const STEP_BASIN_ANNOTATION_START = 7
/** Mediterranean camera: zoom from global with year frozen at 2023 (see Map.vue). */
const STEP_MEDITERRANEAN_START = 9
/** First step ICCAT farms may fade in (after med zoom settles). */
const STEP_MEDITERRANEAN_FARMS_START = 10
/** Single linger beat after farms appear while still zoomed into the Med. */
const STEP_MEDITERRANEAN_FARM_LINGER_END = 11
const STEP_ANIMATION_DURATION_MS = 2600
/** ICCAT farm points: STEP_MEDITERRANEAN_FARMS_START .. FARM_LINGER_END (Map.vue); zoom-gated. */
const ICCAT_FARMS_SOURCE_ID = 'iccat-fish-farms'
const ICCAT_FARMS_LAYER_ID = 'iccat-fish-farms-circles'
const FARM_CIRCLES_MIN_ZOOM = 4.0
const FARM_CIRCLES_FILL_OPACITY_VISIBLE = 0.95
const FARM_CIRCLES_STROKE_OPACITY_VISIBLE = 1
const FARM_CIRCLE_RADIUS = 14
const FARM_CIRCLE_STROKE_WIDTH = 0.5
const MAP_REFERENCE_WIDTH = 1920
const MAP_REFERENCE_HEIGHT = 1080
const MAP_GLOBAL_REFERENCE_ZOOM = 1.6
const MAP_MEDITERRANEAN_REFERENCE_ZOOM = 4.8
/** Opacity tween when ICCAT farms should show or hide */
const FARM_CIRCLES_FADE_MS = 520

let farmCirclesFadeRaf = null
/** Last `show` target from sync; avoids restarting fade while unchanged */
let farmCirclesFadeTargetShow = null

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3
}

function cancelFarmCirclesFade() {
  if (farmCirclesFadeRaf != null) {
    cancelAnimationFrame(farmCirclesFadeRaf)
    farmCirclesFadeRaf = null
  }
}

function applyFarmCirclesOpacity(fillOpacity, strokeOpacity) {
  if (!map || !mapReady.value || !map.getLayer(ICCAT_FARMS_LAYER_ID)) return
  map.setPaintProperty(ICCAT_FARMS_LAYER_ID, 'circle-opacity', fillOpacity)
  map.setPaintProperty(ICCAT_FARMS_LAYER_ID, 'circle-stroke-opacity', strokeOpacity)
}

function fadeFarmCirclesTo(show) {
  if (!map || !mapReady.value || !map.getLayer(ICCAT_FARMS_LAYER_ID)) return
  cancelFarmCirclesFade()
  const lid = ICCAT_FARMS_LAYER_ID
  const endFill = show ? FARM_CIRCLES_FILL_OPACITY_VISIBLE : 0
  const endStroke = show ? FARM_CIRCLES_STROKE_OPACITY_VISIBLE : 0
  let startFill = map.getPaintProperty(lid, 'circle-opacity')
  if (typeof startFill !== 'number' || Number.isNaN(startFill)) startFill = 0
  let startStroke = map.getPaintProperty(lid, 'circle-stroke-opacity')
  if (typeof startStroke !== 'number' || Number.isNaN(startStroke)) startStroke = 0

  const t0 = performance.now()
  function frame(now) {
    if (!map || !mapReady.value || !map.getLayer(lid)) {
      farmCirclesFadeRaf = null
      return
    }
    const t = Math.min(1, (now - t0) / FARM_CIRCLES_FADE_MS)
    const u = easeOutCubic(t)
    applyFarmCirclesOpacity(
      startFill + (endFill - startFill) * u,
      startStroke + (endStroke - startStroke) * u,
    )
    if (t < 1) {
      farmCirclesFadeRaf = requestAnimationFrame(frame)
    } else {
      farmCirclesFadeRaf = null
      applyFarmCirclesOpacity(endFill, endStroke)
    }
  }
  farmCirclesFadeRaf = requestAnimationFrame(frame)
}

function stepAnimationEasing(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - ((-2 * t + 2) ** 3) / 2
}

const props = defineProps({
  activeStep: { type: Number, default: 0 },
  /** Scrollama progress through the current step, roughly 0–1. */
  stepProgress: { type: Number, default: 0 },
  stepCount: { type: Number, default: 15 },
  minimalMode: { type: Boolean, default: false },
})

const MEDITERRANEAN_ZOOM_FILLER =
  'Med Filler'
const MEDITERRANEAN_FARMS_FILLER =
  'The Mediterranean and the countries around it are leading the way in Bluefin farming. Each dot is a registered bluefin farm: together, they have the capacity to produce 80,000 tonnes of Bluefin in a year.'
const LINGER_2023_FILLER = 'filler for 2023 linger'
const DEFAULT_FILLER = 'default filler'

const mapRef = ref(null)
const miniChartRef = ref(null)
const mapReady = ref(false)
const tokenMissing = ref(false)
const farmLegendVisible = ref(false)
let map = null
let resizeObserver = null
let miniChartResizeObserver = null
let activeCameraKey = ''
let hudChartLayoutRaf = null

/**
 * Scrollama fires onStepEnter before onStepProgress matches the new step.
 * Forward: stale progress ≈ 1 → timeline jumps ahead; gate to 0 until progress resets low.
 * Backward: stale progress ≈ 0 → timeline jumps behind; gate to 1 until progress resets high.
 */
const scrollStepGate = ref(null) // null | 'forward' | 'backward'
const pendingStep = ref(-1)

const hudChartYears = []
for (let y = YEAR_START; y <= YEAR_END; y += 1) {
  hudChartYears.push(y)
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v))
}

watch(
  () => props.activeStep,
  (nextStep, prevStep) => {
    if (nextStep === prevStep) return
    pendingStep.value = nextStep
    scrollStepGate.value = nextStep > prevStep ? 'forward' : 'backward'
  },
)

watch(
  () => props.stepProgress,
  (nextProgress) => {
    const p = clamp01(nextProgress)
    if (scrollStepGate.value === 'forward' && p <= 0.05) {
      scrollStepGate.value = null
    } else if (scrollStepGate.value === 'backward' && p >= 0.95) {
      scrollStepGate.value = null
    }
  },
)

const gatedStepProgress = computed(() => {
  if (props.activeStep !== pendingStep.value || scrollStepGate.value == null) {
    return clamp01(props.stepProgress)
  }
  if (scrollStepGate.value === 'forward') return 0
  return 1
})

function timelineYearFloat(step, prog) {
  if (step > STEP_YEAR_FULLVIEW_END) return YEAR_END
  const spanSteps = Math.max(1, STEP_YEAR_FULLVIEW_END + 1)
  const timelinePos = step + prog
  if (timelinePos >= spanSteps) return YEAR_END
  const yearT = timelinePos / spanSteps
  const span = YEAR_END - YEAR_START
  return Math.min(YEAR_END, Math.max(YEAR_START, YEAR_START + yearT * span))
}

const timelineYear = computed(() => timelineYearFloat(props.activeStep, gatedStepProgress.value))

const currentYear = computed(() => Math.round(timelineYear.value))

const mapTitle = computed(() => `Where Bluefin Was Caught in ${currentYear.value}`)

function parseGtaFirmsCsv(text) {
  const lines = text.trim().split(/\r?\n/)
  const rows = []
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i]
    if (!line) continue
    const parts = line.split(',')
    if (parts.length < 3) continue
    const species = parts[0]
    const year = Number(parts[1])
    const value = Number.parseFloat(parts[2])
    if (!Number.isFinite(year) || !Number.isFinite(value)) continue
    rows.push({ species, year, value })
  }
  return rows
}

function buildGtaFirmsYearlyTonnes(rows) {
  const yearly = new Map()
  for (let y = YEAR_START; y <= YEAR_END; y += 1) {
    yearly.set(y, 0)
  }
  for (const row of rows) {
    if (row.year < YEAR_START || row.year > YEAR_END) continue
    if (!BLUEFIN_STACK_SPECIES.includes(row.species)) continue
    yearly.set(row.year, (yearly.get(row.year) || 0) + row.value)
  }
  return yearly
}

const gtaFirmsYearlyTonnes = buildGtaFirmsYearlyTonnes(parseGtaFirmsCsv(gtaFirmsTunaCsvRaw))

const currentYearTonnes = computed(() => gtaFirmsYearlyTonnes.get(currentYear.value) || 0)

const tonnesRange = computed(() => {
  const values = Array.from(gtaFirmsYearlyTonnes.values())
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 1)
  return { min, max }
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

const tonnesNumberColor = computed(() => {
  const t = normalize(currentYearTonnes.value, tonnesRange.value.min, tonnesRange.value.max)
  return colorByIntensity(t)
})

const mapLegendGradient = computed(() => {
  const low = readColorDefaultBlue()
  const stops = [low, ...CATCH_COLOR_RAMP_ABOVE_ZERO].join(', ')
  return `linear-gradient(to right, ${stops})`
})

const farmLegendDotColor = computed(() => readColorTunaFarmed())

const narrativeCopy = computed(() => {
  if (props.activeStep >= STEP_FULLVIEW_LINGER_START && props.activeStep <= STEP_FULLVIEW_LINGER_END) {
    return LINGER_2023_FILLER
  }
  if (props.activeStep === STEP_MEDITERRANEAN_START) {
    return MEDITERRANEAN_ZOOM_FILLER
  }
  if (props.activeStep >= STEP_MEDITERRANEAN_FARMS_START) {
    return props.activeStep === STEP_MEDITERRANEAN_FARM_LINGER_END
      ? LINGER_2023_FILLER
      : MEDITERRANEAN_FARMS_FILLER
  }
  return DEFAULT_FILLER
})

function overlayOpacity() {
  const step = props.activeStep
  // Basin annotation only in the tail of the global 2023 linger (from m8), not the first beats.
  const showBasinCallout =
    step >= STEP_BASIN_ANNOTATION_START && step <= STEP_FULLVIEW_LINGER_END
  return showBasinCallout ? 1 : 0
}

function formatTonnes(v) {
  return Math.round(v).toLocaleString(undefined, { maximumFractionDigits: 0 })
}

function yearCenterX(xScale, year) {
  const x = xScale(String(year))
  if (x == null) return null
  return x + xScale.bandwidth() / 2
}

function buildHudMarkerXScale(xScale) {
  const xStart = yearCenterX(xScale, YEAR_START)
  const xEnd = yearCenterX(xScale, YEAR_END)
  if (xStart == null || xEnd == null) return null
  return scaleLinear().domain([YEAR_START, YEAR_END]).range([xStart, xEnd]).clamp(true)
}

function hudMiniChartLayout(el) {
  const width = el.clientWidth
  const height = el.clientHeight
  if (width < 24 || height < 16) return null

  const margin = { top: 2, right: 2, bottom: 2, left: 2 }
  const innerW = width - margin.left - margin.right
  const innerH = height - margin.top - margin.bottom
  if (innerW < 16 || innerH < 8) return null

  const yScale = scaleLinear().domain([0, HUD_CHART_Y_MAX]).range([innerH, 0])
  const xScale = scaleBand().domain(hudChartYears.map(String)).range([0, innerW]).padding(0.12)
  const markerXScale = buildHudMarkerXScale(xScale)
  if (!markerXScale) return null

  return {
    width,
    height,
    margin,
    innerH,
    innerW,
    xScale,
    yScale,
    markerXScale,
    baselineY: yScale(0),
    barWidth: xScale.bandwidth(),
  }
}

function hudMiniChartBars() {
  return hudChartYears.map((year) => ({
    year,
    tonnes: gtaFirmsYearlyTonnes.get(year) || 0,
  }))
}

function cancelHudChartLayoutRaf() {
  if (hudChartLayoutRaf != null) {
    cancelAnimationFrame(hudChartLayoutRaf)
    hudChartLayoutRaf = null
  }
}

function scheduleHudMiniChartLayout() {
  cancelHudChartLayoutRaf()
  hudChartLayoutRaf = requestAnimationFrame(() => {
    hudChartLayoutRaf = null
    layoutHudMiniChart()
  })
}

function initHudMiniChart() {
  const el = miniChartRef.value
  if (!el || props.minimalMode) return
  if (!select(el).select('svg.hud-mini-chart-svg').empty()) return

  const svg = select(el)
    .append('svg')
    .attr('class', 'hud-mini-chart-svg')
    .attr('role', 'presentation')
    .attr('focusable', 'false')

  const g = svg.append('g').attr('class', 'hud-mini-chart-inner')
  g.append('g')
    .attr('class', 'hud-mini-bars')
    .selectAll('rect')
    .data(hudMiniChartBars(), (d) => d.year)
    .join('rect')
    .attr('class', 'hud-bar')
  g.append('line').attr('class', 'hud-year-marker')
}

function layoutHudMiniChart() {
  const el = miniChartRef.value
  if (!el || props.minimalMode) return

  initHudMiniChart()

  const layout = hudMiniChartLayout(el)
  if (!layout) return

  const { width, height, margin, xScale, yScale, baselineY, barWidth } = layout

  const svg = select(el).select('svg.hud-mini-chart-svg')
  svg.attr('width', width).attr('height', height)

  const gInner = svg.select('g.hud-mini-chart-inner').attr('transform', `translate(${margin.left},${margin.top})`)

  gInner.select('g.hud-mini-bars').selectAll('rect.hud-bar').each(function (d) {
    const bar = select(this)
    const x = xScale(String(d.year))
    const y = yScale(d.tonnes)
    bar
      .attr('x', x)
      .attr('width', barWidth)
      .attr('y', y)
      .attr('height', Math.max(0, baselineY - y))
  })

  updateHudYearMarker()
}

function updateHudYearMarker() {
  const el = miniChartRef.value
  if (!el || props.minimalMode) return

  const layout = hudMiniChartLayout(el)
  if (!layout) return

  const marker = select(el).select('line.hud-year-marker')
  if (marker.empty()) return

  const x = layout.markerXScale(timelineYear.value)
  if (!Number.isFinite(x)) return

  marker.attr('y1', 0).attr('y2', layout.innerH).attr('x1', x).attr('x2', x)
}

function setupHudMiniChart() {
  if (props.minimalMode) return
  nextTick(() => {
    layoutHudMiniChart()
    const el = miniChartRef.value
    if (!el || miniChartResizeObserver) return
    miniChartResizeObserver = new ResizeObserver(() => {
      scheduleHudMiniChartLayout()
    })
    miniChartResizeObserver.observe(el)
  })
}

function teardownHudMiniChart() {
  cancelHudChartLayoutRaf()
  miniChartResizeObserver?.disconnect()
  miniChartResizeObserver = null
  if (miniChartRef.value) {
    select(miniChartRef.value).selectAll('*').remove()
  }
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

function updateFarmCirclesPaint() {
  if (!map || !mapReady.value || !map.getLayer(ICCAT_FARMS_LAYER_ID)) return
  const storyScale = readStoryScale(mapRef.value)
  map.setPaintProperty(ICCAT_FARMS_LAYER_ID, 'circle-radius', FARM_CIRCLE_RADIUS * storyScale)
  map.setPaintProperty(ICCAT_FARMS_LAYER_ID, 'circle-color', readColorTunaFarmed())
  map.setPaintProperty(ICCAT_FARMS_LAYER_ID, 'circle-stroke-width', FARM_CIRCLE_STROKE_WIDTH * storyScale)
  map.setPaintProperty(ICCAT_FARMS_LAYER_ID, 'circle-stroke-color', 'rgba(255, 255, 255, 0.92)')
}

function syncFarmCirclesVisibility() {
  if (!map || !mapReady.value || !map.getLayer(ICCAT_FARMS_LAYER_ID)) {
    farmLegendVisible.value = false
    return
  }
  updateFarmCirclesPaint()
  const step = props.activeStep
  const inMedFarmBeat =
    step >= STEP_MEDITERRANEAN_FARMS_START
    && currentYear.value === YEAR_END
  const farmMinZoom = zoomForReferenceFrame(FARM_CIRCLES_MIN_ZOOM)
  const show = inMedFarmBeat && map.getZoom() >= farmMinZoom
  farmLegendVisible.value = show
  if (show === farmCirclesFadeTargetShow) return
  farmCirclesFadeTargetShow = show
  fadeFarmCirclesTo(show)
}

function attachFarmCirclesViewportListeners() {
  if (!map) return
  map.on('zoom', syncFarmCirclesVisibility)
  map.on('moveend', syncFarmCirclesVisibility)
}

function mapReferenceFrameScale() {
  const el = mapRef.value
  const width = el?.clientWidth || MAP_REFERENCE_WIDTH
  const height = el?.clientHeight || MAP_REFERENCE_HEIGHT
  const scale = Math.min(width / MAP_REFERENCE_WIDTH, height / MAP_REFERENCE_HEIGHT)

  if (!Number.isFinite(scale) || scale <= 0) return 1
  return Math.min(1, Math.max(0.45, scale))
}

function zoomForReferenceFrame(referenceZoom) {
  return referenceZoom + Math.log2(mapReferenceFrameScale())
}

function cameraForStep(stepIndex) {
  const cameraPadding = { top: 24, right: 24, bottom: 24, left: 24 }
  if (stepIndex >= STEP_MEDITERRANEAN_START) {
    return {
      key: 'mediterranean',
      center: [14, 38],
      zoom: zoomForReferenceFrame(MAP_MEDITERRANEAN_REFERENCE_ZOOM),
      duration: STEP_ANIMATION_DURATION_MS,
      padding: cameraPadding,
    }
  }
  return {
    key: 'global',
    center: [0, 0],
    zoom: zoomForReferenceFrame(MAP_GLOBAL_REFERENCE_ZOOM),
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
    /* Match the global cameraForStep zoom so the first frame doesn't snap when updateCameraForStep eases. */
    zoom: zoomForReferenceFrame(MAP_GLOBAL_REFERENCE_ZOOM),
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
          'fill-color': readColorDefaultBlue(),
          'fill-opacity': 1
      }
    })

    map.addSource(ICCAT_FARMS_SOURCE_ID, {
      type: 'geojson',
      data: iccatFishFarmsCentroidsUrl,
    })
    map.addLayer({
      id: ICCAT_FARMS_LAYER_ID,
      type: 'circle',
      source: ICCAT_FARMS_SOURCE_ID,
      layout: {
        visibility: 'visible',
      },
      paint: {
        'circle-radius': FARM_CIRCLE_RADIUS * readStoryScale(mapRef.value),
        'circle-color': readColorTunaFarmed(),
        'circle-opacity': 0,
        'circle-stroke-width': FARM_CIRCLE_STROKE_WIDTH * readStoryScale(mapRef.value),
        'circle-stroke-color': 'rgba(255, 255, 255, 0.92)',
        'circle-stroke-opacity': 0,
      },
    })

    mapReady.value = true
    hideMapLabels()
    showOceanLabelsOnly()
    setProjection()
    neutralizeWaterColor()
    applyTunaCatchFillSeamMitigation()
    updateCatchLayer()
    attachFarmCirclesViewportListeners()
    updateCameraForStep(props.activeStep, true)
    syncFarmCirclesVisibility()
  })

  resizeObserver = new ResizeObserver(() => {
    if (!map || !mapReady.value) return
    map.resize()
    updateFarmCirclesPaint()
    updateCameraForStep(props.activeStep, true)
    syncFarmCirclesVisibility()
  })
  if (mapRef.value) resizeObserver.observe(mapRef.value)
  setupHudMiniChart()
})

watch(
  () => props.activeStep,
  (step) => {
    updateCameraForStep(step)
    syncFarmCirclesVisibility()
  },
)

watch(currentYear, () => {
  updateCatchLayer()
  syncFarmCirclesVisibility()
})

watch(
  () => [timelineYear.value, props.activeStep, gatedStepProgress.value],
  () => {
    updateHudYearMarker()
  },
)

watch(
  () => props.minimalMode,
  (minimal) => {
    if (minimal) teardownHudMiniChart()
    else setupHudMiniChart()
  },
)

onUnmounted(() => {
  cancelFarmCirclesFade()
  farmCirclesFadeTargetShow = null
  teardownHudMiniChart()
  resizeObserver?.disconnect()
  resizeObserver = null
  if (map) map.remove()
  map = null
})
</script>

<template>
  <div class="map-frame">
    <h1 class="visual-title visual-title--on-dark map-title">{{ mapTitle }}</h1>
    <div ref="mapRef" class="map-host" />

    <div v-if="!minimalMode" class="hud-row">
      <div class="metrics-card">
        <p class="metric-line">
          <span class="metric-caption">Global bluefin catch (tonnes):</span>
          <span class="metric-value" :style="{ color: tonnesNumberColor }">{{ formatTonnes(currentYearTonnes) }}</span>
        </p>
        <div ref="miniChartRef" class="hud-mini-chart" aria-hidden="true" />
        <p v-if="narrativeCopy" class="narrative-copy">{{ narrativeCopy }}</p>
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

    <aside class="map-legend" aria-label="Catch intensity and farm locations legend">
      <div v-if="farmLegendVisible" class="map-legend-farms">
        <span
          class="map-legend-farm-dot"
          :style="{ backgroundColor: farmLegendDotColor }"
          aria-hidden="true"
        />
        <span>ICCAT Registered Bluefin Tuna Farms</span>
      </div>
      <div class="map-legend-scale-title">{{ CATCH_TONNE_LEGEND_TITLE }}</div>
      <div class="map-legend-bar" :style="{ background: mapLegendGradient }" />
      <div class="map-legend-labels">
        <span v-for="tick in CATCH_TONNE_LEGEND_TICKS" :key="tick">{{ tick }}</span>
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
  /** Catch-intensity legend (bottom-right) + full metrics card — same width (~⅔ of former 440px) */
  --map-hud-panel-width: min(calc(300px * var(--story-scale)), 72vw);
  /** Same horizontal inset as `--map-hud-inset-left`; keeps `.hud-row` stretched between edges */
  --map-hud-inset-right: 0.85rem;
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
  text-align: center;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
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

/* Without left+right (or explicit width), absolute positioning shrink-wraps to content and
   `width: %` on `.metrics-card` never establishes a fixed column — text drives the box width. */
.hud-row {
  position: absolute;
  left: var(--map-hud-inset-left);
  right: var(--map-hud-inset-right);
  top: calc(0.6rem - 1px);
  z-index: 7;
  box-sizing: border-box;
}

.metrics-card {
  box-sizing: border-box;
  margin: 0;
  padding: 0.7rem 0.8rem;
  border-radius: 0;
  border: 1px solid rgba(15, 23, 42, 0.2);
  background: rgba(255, 255, 255, 0.92);
  color: #000000;
  display: block;
  overflow-wrap: break-word;
  width: var(--map-hud-panel-width);
  max-width: 100%;
}

.narrative-copy {
  margin: 0.55rem 0 0;
  padding-top: 0.55rem;
  border-top: 1px solid rgba(15, 23, 42, 0.12);
  font-size: 0.92rem;
  line-height: 1.35;
  overflow-wrap: anywhere;
  word-break: break-word;
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
  width: var(--map-hud-panel-width);
  box-sizing: border-box;
  padding: var(--viz-legend-padding);
  border: var(--viz-legend-border);
  border-radius: 0;
  background: var(--viz-legend-bg);
  box-shadow: none;
}

.map-legend-bar {
  width: 100%;
  height: calc(18px * var(--story-scale));
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

.map-legend-scale-title {
  margin-top: 0.35rem;
  color: #0f172a;
  font-size: var(--font-size-ui);
  line-height: var(--viz-legend-line-height);
}

.map-legend-farms {
  margin-bottom: 0.55rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid rgba(15, 23, 42, 0.14);
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: #0f172a;
  font-size: var(--font-size-ui);
  line-height: var(--viz-legend-line-height);
}

.map-legend-farm-dot {
  width: calc(28px * var(--story-scale));
  height: calc(28px * var(--story-scale));
  flex: 0 0 calc(28px * var(--story-scale));
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.92);
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

.hud-mini-chart {
  margin-top: 0.45rem;
  width: 100%;
  height: calc(52px * var(--story-scale));
  min-height: 40px;
}

.hud-mini-chart :deep(.hud-mini-chart-svg) {
  display: block;
  width: 100%;
  height: 100%;
}

.hud-mini-chart :deep(.hud-bar) {
  fill: var(--color-default-blue);
  opacity: 0.92;
}

.hud-mini-chart :deep(.hud-year-marker) {
  stroke: var(--story-annotation-stacked-bars-stroke);
  stroke-width: calc(3.5px * var(--story-scale));
  stroke-dasharray: 6 4;
  pointer-events: none;
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
  /* Tuned visually against the 1920x1080 reference camera. */
  top: 30%;
  width: min(34vmin, 460px);
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
  fill: var(--story-annotation-map-stroke);
  stroke: var(--story-annotation-map-stroke);
  stroke-width: 2;
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
  .map-frame {
    --map-hud-panel-width: min(240px, 76vw);
  }

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

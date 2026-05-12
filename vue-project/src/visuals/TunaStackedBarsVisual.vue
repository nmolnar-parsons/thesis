<script setup>
import { axisBottom, axisLeft } from 'd3-axis'
import { format as d3Format } from 'd3-format'
import { scaleBand, scaleLinear } from 'd3-scale'
import { select } from 'd3-selection'
import { transition } from 'd3-transition'
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import csvRaw from '../data/GTA_FIRMs_tuna_cleaned_grouped.csv?raw'
import { readColorDefaultBlue } from '../utils/readStoryColors.js'
import { readStoryScale } from '../utils/readStoryScale.js'
import { BLUEFIN_YEAR_AXIS_TICKS, formatYearTick } from './chartAxisConfig.js'

const compactNumber = d3Format('~s')
function formatTickShort(d) {
  const n = Number(d)
  if (!Number.isFinite(n)) return ''
  if (Math.abs(n) < 1000) return compactNumber(n)
  return compactNumber(n).replace('G', 'B')
}

const props = defineProps({
  activeStep: { type: Number, default: 0 },
})

const hostRef = ref(null)
const wrapRef = ref(null)
const YEAR_START = 1965
/** CSV codes combined into one chart series (Atlantic bluefin color). */
const BLUEFIN_SOURCE_SPECIES = ['BFT', 'PBF', 'SBF']
const BLUEFIN_CODE = 'BLUEFIN'
const BLUEFIN_SPECIES = [BLUEFIN_CODE]
const STAGGER_MS = 52
/** Fixed y-scale (tonnes), matched with TunaProductionStreamgraphVisual. */
const Y_AXIS_MAX = 120_000
const Y_AXIS_LABEL = 'Global Bluefin Catch (tonnes)'
const Y_AXIS_TICK_PADDING = 10
const Y_AXIS_TICK_SIZE = 6

/** Toggle single-line authoring inputs merged into SVG annotation labels while tuning copy. */
const SHOW_ANNOTATION_TEXT_INPUT = false

const DEFAULT_STACKED_BARS_ANNO_STROKE = '#7f1d1d'
const DEFAULT_STACKED_BARS_ANNO_STROKE_WIDTH = 6

function annotationCssScope(rootEl) {
  if (!rootEl) return typeof document !== 'undefined' ? document.documentElement : null
  return rootEl.closest('.stacked-wrap') ?? rootEl ?? (typeof document !== 'undefined' ? document.documentElement : null)
}

/**
 * Resolved paint from story.css vars. Prefer reading from `.stacked-wrap` so tokens match what the SVG
 * subtree inherits (rather than `:root`-only quirks with var() chaining in JS).
 */
function readStackedBarsAnnotationPaint(rootEl) {
  if (typeof document === 'undefined') {
    return { stroke: DEFAULT_STACKED_BARS_ANNO_STROKE, strokeWidth: DEFAULT_STACKED_BARS_ANNO_STROKE_WIDTH }
  }
  const scope = annotationCssScope(rootEl)
  if (!scope)
    return { stroke: DEFAULT_STACKED_BARS_ANNO_STROKE, strokeWidth: DEFAULT_STACKED_BARS_ANNO_STROKE_WIDTH }
  const cs = getComputedStyle(scope)
  const stroke =
    cs.getPropertyValue('--story-annotation-stacked-bars-stroke').trim() || DEFAULT_STACKED_BARS_ANNO_STROKE
  const wRaw = cs.getPropertyValue('--story-annotation-stacked-bars-stroke-width').trim() || ''
  let strokeWidth = parseFloat(wRaw)
  if (!Number.isFinite(strokeWidth)) {
    strokeWidth = DEFAULT_STACKED_BARS_ANNO_STROKE_WIDTH * readStoryScale(scope)
  }
  return { stroke, strokeWidth }
}

/** Same token chain as SVG fill `: var(--color-annotation-white-background)` — used for a 0-width stroke so edges match legacy rasterization. */
function readAnnotationPillBackdropChromeStroke(rootEl) {
  if (typeof document === 'undefined') return DEFAULT_STACKED_BARS_ANNO_STROKE
  const scope = annotationCssScope(rootEl)
  if (!scope) return DEFAULT_STACKED_BARS_ANNO_STROKE
  const cs = getComputedStyle(scope)
  return (
    cs.getPropertyValue('--color-annotation-white-background').trim() ||
    cs.getPropertyValue('--story-annotation-stacked-bars-stroke').trim() ||
    DEFAULT_STACKED_BARS_ANNO_STROKE
  )
}
/** Horizontal gap (px) between annotation line and label block (local x=0 is bar/line edge). */
const ANNO_LABEL_LINE_GAP_PX = 6

function annotationLabelKey(stageIndex, annoIndex) {
  return `${stageIndex}-${annoIndex}`
}

/** Reactive copy per STAGES annotation slot; seeded from optional `label` on each annotation. */
const annotationLabelOverrides = reactive({})

const SPECIES_META = [{ code: BLUEFIN_CODE, label: 'Bluefin Tuna' }]

function speciesBarFill(speciesCode) {
  if (speciesCode === BLUEFIN_CODE) return readColorDefaultBlue()
  return '#94a3b8'
}

const STAGES = [
  {
    species: [BLUEFIN_CODE],
    yearRange: [1965, 1980],
    annotations: [
      {
        year: 1980,
        y1: 0,
        y2: 120000,
        label: 'Bluefin Tuna is the King of Sushi',
      },
    ],
    
  },
  {
    species: [BLUEFIN_CODE],
    yearRange: [1965, 1990],
    annotations: [
      {
        year: 1990,
        y1: 0,
        y2: 120000,
        label: 'Japanese Economic Bubble Bursts',
      },
    ],
  },
  {
    species: [BLUEFIN_CODE],
    yearRange: [1965, 2007],
    annotations: [
      {
        year: 2007,
        y1: 0,
        y2: 120000,
        label: 'Conveyer Belt Sushi',
      },
    ],
  },
  {
    species: [BLUEFIN_CODE],
    yearRange: [1965, 2012],
    annotations: [
      {
        year: 2012,
        y1: 0,
        y2: 120000,
        label: 'Highly Overfished',
      },
    ],
  },
  {
    species: [BLUEFIN_CODE],
    annotations: [
      {
        year: 2023,
        y1: 0,
        y2: 120000,
        label: 'No Longer Overfished',
      },
    ],
  },
]

const LAST_STAGE_INDEX = STAGES.length - 1

const FIRST_ANNOTATION_STAGE_IDX = STAGES.findIndex((s) => (s.annotations?.length ?? 0) > 0)

for (let si = 0; si < STAGES.length; si += 1) {
  const anns = STAGES[si].annotations || []
  for (let ai = 0; ai < anns.length; ai += 1) {
    annotationLabelOverrides[annotationLabelKey(si, ai)] = anns[ai].label ?? ''
  }
}

const annotationEditorRows = computed(() => {
  const rows = []
  STAGES.forEach((stage, si) => {
    ;(stage.annotations || []).forEach((ann, ai) => {
      rows.push({
        key: annotationLabelKey(si, ai),
        year: ann.year,
      })
    })
  })
  return rows
})

/** Scroll step 0 = intro copy only (empty chart). Step 1+ maps to STAGES[step - 1], clamped. */
function scrollStepToChartStage(scrollStep) {
  if (scrollStep <= 0) return -1
  return Math.min(scrollStep - 1, LAST_STAGE_INDEX)
}

const stageConfig = computed(() => {
  const idx = scrollStepToChartStage(props.activeStep)
  if (idx < 0) return { species: [], yearRange: undefined, annotations: undefined }
  return STAGES[idx]
})
const stageSpecies = computed(() => stageConfig.value.species)

const legendSpecies = computed(() =>
  SPECIES_META.filter((s) => stageSpecies.value.includes(s.code)),
)

function easeCubicInOut(t) {
  return t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

/** Latest year present in the dataset (shown in the chart title). */
const chartEndYear = ref(YEAR_START)

const prevActiveStep = ref(null)
const introPrimed = ref(false)
const pendingIntroStagger = ref(false)
const prevRevealedYears = ref([])
const lastDrawDims = ref({ w: 0, h: 0 })

let io

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/)
  const rows = []
  for (let i = 1; i < lines.length; i++) {
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

function buildYearMatrix(rows) {
  const bySy = new Map()
  let maxY = YEAR_START
  for (const r of rows) {
    if (r.year < YEAR_START) continue
    maxY = Math.max(maxY, r.year)
    const k = `${r.species}\0${r.year}`
    bySy.set(k, (bySy.get(k) || 0) + r.value)
  }
  for (let y = YEAR_START; y <= maxY; y += 1) {
    let sum = 0
    for (const sp of BLUEFIN_SOURCE_SPECIES) {
      sum += bySy.get(`${sp}\0${y}`) || 0
    }
    bySy.set(`${BLUEFIN_CODE}\0${y}`, sum)
    for (const sp of BLUEFIN_SOURCE_SPECIES) {
      bySy.delete(`${sp}\0${y}`)
    }
  }
  const years = []
  for (let y = YEAR_START; y <= maxY; y++) years.push(y)
  return { bySy, years, maxYear: maxY }
}

function segmentGeometry(years, speciesOrder, bySy) {
  const segs = []
  for (const yr of years) {
    const vals = {}
    for (const sp of speciesOrder) {
      vals[sp] = bySy.get(`${sp}\0${yr}`) || 0
    }
    let cum = 0
    for (const sp of speciesOrder) {
      const v = vals[sp]
      const y0 = cum
      const y1 = cum + v
      segs.push({ year: yr, species: sp, y0, y1 })
      cum = y1
    }
  }
  return segs
}

function maxStackForOrder(years, speciesOrder, bySy) {
  let m = 0
  for (const yr of years) {
    let total = 0
    for (const sp of speciesOrder) {
      total += bySy.get(`${sp}\0${yr}`) || 0
    }
    m = Math.max(m, total)
  }
  return m
}

function totalForYear(year, speciesOrder, bySy) {
  let total = 0
  for (const sp of speciesOrder) {
    total += bySy.get(`${sp}\0${year}`) || 0
  }
  return total
}

function yearsWithinRange(years, yearRange) {
  if (!yearRange || yearRange.length !== 2) return years
  const [start, end] = yearRange
  return years.filter((y) => y >= start && y <= end)
}

function yearCenterX(xScale, year) {
  const x = xScale(String(year))
  if (x == null) return null
  return x + xScale.bandwidth() / 2
}

function yearLeftX(xScale, year) {
  const x = xScale(String(year))
  if (x == null) return null
  return x
}

/** Right edge (trailing edge) of the year's band — annotation column sits here. */
function yearRightX(xScale, year) {
  const x = yearLeftX(xScale, year)
  if (x == null) return null
  return x + xScale.bandwidth()
}

function annotationLabelTopPx(annotation, yScale) {
  const ya = Number(annotation?.y1)
  const yb = Number(annotation?.y2)
  if (!Number.isFinite(ya) || !Number.isFinite(yb)) return null
  const p1 = yScale(ya)
  const p2 = yScale(yb)
  return Math.min(p1, p2)
}

/** Pivot for label wrap: anchored at trailing edge of year's bar × top of vertical flag (pill rect y=0). */
function annotationLabelGroupTranslate(d, xScale, yScale) {
  const rx = yearRightX(xScale, d.year)
  const topPx = annotationLabelTopPx(d, yScale)
  if (rx == null || topPx == null) return [0, 0]
  return [rx + (d.labelDx ?? 0), topPx + (d.labelDy ?? 0)]
}

function parseSvgTranslate(transform) {
  if (!transform || typeof transform !== 'string' || transform.trim() === 'none') return null
  const m = /^translate\s*\(\s*([-\d.eE]+)[ ,]+([-\d.eE]+)\s*\)/.exec(transform.trim())
  if (!m) return null
  return [Number(m[1]), Number(m[2])]
}

/**
 * Pill in group coords with origin at trailing bar edge × line top (`rect.top = 0` matches flag stem).
 * Text sits `padY` below pill top (`text-before-edge` baseline at that y).
 */
function layoutAnnotationBgRect(labelSelection, padX, padY, bgRightEdgeLocal, pillChromeStroke) {
  labelSelection.each(function () {
    const gSel = select(this)
    const textNode = gSel.select('text.annotation-flag-label').node()
    const rectSel = gSel.select('rect.annotation-flag-label-bg')
    if (!textNode) return
    try {
      const bbox = textNode.getBBox()
      const inkBottom = bbox.y + bbox.height
      const rectLeft = bbox.x - padX
      rectSel
        .attr('stroke', pillChromeStroke)
        .attr('stroke-width', 0)
        .attr('rx', 0)
        .attr('ry', 0)
        .attr('x', rectLeft)
        .attr('y', 0)
        .attr('width', Math.max(0, bgRightEdgeLocal - rectLeft))
        .attr('height', Math.max(0, inkBottom + padY))
    } catch {
      rectSel.attr('width', 0).attr('height', 0)
    }
  })
}

let svg
let matrixRef = { bySy: new Map(), years: [], maxYear: YEAR_START }

function drawChart() {
  const el = hostRef.value
  if (!el || !svg) return

  const width = el.clientWidth || 800
  const height = el.clientHeight || 480
  if (width < 20 || height < 20) return
  const storyScale = readStoryScale(wrapRef.value ?? el)
  const scalePx = (value) => value * storyScale
  const baseMargin = {
    top: scalePx(48),
    right: scalePx(34),
    bottom: scalePx(48),
    left: scalePx(84),
  }
  const innerH = height - baseMargin.top - baseMargin.bottom
  if (innerH < 20) return

  svg.attr('width', width).attr('height', height)

  const { years, bySy } = matrixRef
  const stageIdx = scrollStepToChartStage(props.activeStep)
  const stage =
    stageIdx >= 0 ? STAGES[stageIdx] : { species: [], yearRange: undefined, annotations: undefined }
  const order = stage.species
  const stageYears = stageIdx >= 0 ? yearsWithinRange(years, stage.yearRange) : []
  const isFinal = stageIdx === LAST_STAGE_INDEX

  const yScale = scaleLinear().domain([0, Y_AXIS_MAX]).range([innerH, 0])
  const yAxisFn = axisLeft(yScale)
    .ticks(6)
    .tickSizeInner(scalePx(Y_AXIS_TICK_SIZE))
    .tickPadding(scalePx(Y_AXIS_TICK_PADDING))
    .tickFormat(formatTickShort)
    .tickSizeOuter(0)

  const measureLayer = svg
    .append('g')
    .attr('class', 'axis-measure')
    .attr('visibility', 'hidden')
    .attr('aria-hidden', 'true')
  const measureYAxis = measureLayer
    .append('g')
    .attr('class', 'story-chart-axis y-axis axis')
    .call(yAxisFn)
  const maxTickLabelWidth = Math.max(
    0,
    ...measureYAxis
      .selectAll('.tick text')
      .nodes()
      .map((node) => node.getBBox().width),
  )
  const axisLabelThickness =
    measureLayer
      .append('text')
      .attr('class', 'story-chart-axis-label y-axis-label')
      .text(Y_AXIS_LABEL)
      .node()
      ?.getBBox().height || 16
  measureLayer.remove()

  const axisGapTarget = baseMargin.right
  const tickTextOffset = scalePx(Y_AXIS_TICK_SIZE + Y_AXIS_TICK_PADDING)
  const labelToTickGap = axisGapTarget / 2
  const labelCenterFromLeftEdge = axisGapTarget + axisLabelThickness / 2
  const tickLabelsLeftEdge = axisGapTarget + axisLabelThickness + labelToTickGap
  const margin = {
    ...baseMargin,
    left: Math.ceil(tickLabelsLeftEdge + tickTextOffset + maxTickLabelWidth),
  }
  const innerW = width - margin.left - margin.right
  if (innerW < 20) return

  const xScale = scaleBand().domain(years.map(String)).range([0, innerW]).padding(0.15)

  const segs = stageIdx >= 0 ? segmentGeometry(stageYears, order, bySy) : []

  const priorStep = prevActiveStep.value
  const priorStageIdx = priorStep !== null ? scrollStepToChartStage(priorStep) : -1
  const priorIsFinal = priorStageIdx === LAST_STAGE_INDEX
  const stepChanged = priorStep !== null && priorStep !== props.activeStep
  const stepForward = stepChanged && props.activeStep > priorStep
  const stepBackward = stepChanged && props.activeStep < priorStep

  const resizeOnly =
    introPrimed.value &&
    !stepChanged &&
    lastDrawDims.value.w === width &&
    lastDrawDims.value.h === height

  const shouldUseIntroPending = pendingIntroStagger.value
  const useStagger =
    introPrimed.value &&
    stageIdx >= 0 &&
    !isFinal &&
    !resizeOnly &&
    (stepForward || shouldUseIntroPending)
  if (pendingIntroStagger.value && stageIdx >= 0) pendingIntroStagger.value = false

  const useReverseStagger =
    introPrimed.value &&
    !resizeOnly &&
    stepBackward &&
    priorStageIdx >= 0 &&
    !priorIsFinal &&
    (stageIdx < 0 || stageIdx < LAST_STAGE_INDEX)

  const priorStageConfig = priorStageIdx >= 0 ? STAGES[priorStageIdx] : null
  const priorStageYears =
    priorStageIdx >= 0 ? yearsWithinRange(years, priorStageConfig.yearRange) : []
  const removedYearsSortedDesc = useReverseStagger
    ? priorStageYears.filter((y) => !stageYears.includes(y)).sort((a, b) => b - a)
    : []
  const exitStaggerIdx = new Map(removedYearsSortedDesc.map((y, i) => [y, i]))

  const revealed = new Set(prevRevealedYears.value)
  const newYearsSorted = stageYears.filter((y) => !revealed.has(y)).sort((a, b) => a - b)
  const staggerIdx = new Map(newYearsSorted.map((y, i) => [y, i]))

  const useFinalForwardStagger =
    introPrimed.value &&
    isFinal &&
    stageIdx >= 0 &&
    !resizeOnly &&
    stepForward &&
    newYearsSorted.length > 0

  const barDuration = stepChanged ? 1200 : 320
  const t = transition().duration(barDuration).ease(easeCubicInOut)
  /** Dedicated handle so annotation line + label share timing (bar-chart-race-style tweens). */
  const tAnnot = transition().duration(barDuration).ease(easeCubicInOut)

  const baselineY = yScale(0)

  function barDelay(d) {
    const i = staggerIdx.get(d.year)
    if (i === undefined) return 0
    if (useStagger || useFinalForwardStagger) return i * STAGGER_MS
    return 0
  }

  function exitDelay(d) {
    if (!useReverseStagger) return 0
    const i = exitStaggerIdx.get(d.year)
    return i === undefined ? 0 : i * STAGGER_MS
  }

  let gMain = svg.select('g.main')
  if (gMain.empty()) {
    gMain = svg.append('g').attr('class', 'main')
    gMain.append('g').attr('class', 'story-chart-axis x-axis axis')
    gMain.append('g').attr('class', 'story-chart-axis y-axis axis')
    gMain.append('text').attr('class', 'story-chart-axis-label y-axis-label')
    gMain.append('g').attr('class', 'hover-guides')
    gMain.append('g').attr('class', 'bars')
    gMain.append('g').attr('class', 'hover-targets')
    gMain.append('g').attr('class', 'annotations')
  }
  gMain.attr('transform', `translate(${margin.left},${margin.top})`)

  const gx = gMain.select('g.x-axis')
  const yearTicks = BLUEFIN_YEAR_AXIS_TICKS.map(String).filter((year) => years.includes(Number(year)))
  gx.attr('transform', `translate(0,${innerH})`).call(
    axisBottom(xScale).tickValues(yearTicks).tickFormat(formatYearTick),
  )
  gx.selectAll('text').attr('transform', null).style('text-anchor', 'middle')

  const gy = gMain.select('g.y-axis')
  if (introPrimed.value && stepChanged) {
    gy.transition(t).call(yAxisFn)
  } else {
    gy.call(yAxisFn)
  }

  const yAxisLabel = gMain
    .select('text.y-axis-label')
    .attr('text-anchor', 'middle')
    .attr('transform', `translate(${labelCenterFromLeftEdge - margin.left}, ${innerH / 2}) rotate(-90)`)
    .attr('dominant-baseline', 'middle')
    .attr('fill', '#334155')
    .text(Y_AXIS_LABEL)

  const gHoverGuides = gMain.select('g.hover-guides')
  const gBars = gMain.select('g.bars')
  const gHoverTargets = gMain.select('g.hover-targets')
  const gAnnotations = gMain.select('g.annotations')

  if (!introPrimed.value) {
    gBars.selectAll('rect').interrupt().remove()
    gHoverTargets.selectAll('rect').interrupt().remove()
    gAnnotations.selectAll('*').interrupt().remove()
    gHoverGuides.selectAll('line.hover-line').style('opacity', 0)
    gHoverGuides.selectAll('text.hover-line-label').style('opacity', 0)
    return
  }

  gBars.selectAll('rect').interrupt()

  const segKey = (d) => `${d.year}-${d.species}`

  const hoverLine = gHoverGuides
    .selectAll('line.hover-line')
    .data([null])
    .join('line')
    .attr('class', 'hover-line')
    .attr('x1', 0)
    .attr('x2', 0)
    .attr('y1', 0)
    .attr('y2', innerH)
    .style('opacity', 0)

  const hoverLabel = gHoverGuides
    .selectAll('text.hover-line-label')
    .data([null])
    .join('text')
    .attr('class', 'hover-line-label')
    .attr('text-anchor', 'middle')
    .attr('x', 0)
    .attr('y', scalePx(-5))
    .style('opacity', 0)

  function hideHoverState() {
    gBars.selectAll('rect').classed('is-hovered', false)
    hoverLine.style('opacity', 0)
    hoverLabel.style('opacity', 0)
  }

  function updateHoverState(year) {
    if (!order.length) return
    const x = yearCenterX(xScale, year)
    if (x == null) return
    const total = totalForYear(year, order, bySy)
    gBars.selectAll('rect').classed('is-hovered', (d) => d.year === year)
    hoverLine.attr('x1', x).attr('x2', x).attr('y2', innerH).style('opacity', 1)
    hoverLabel
      .attr('x', x)
      .text(`${year}: ${total.toLocaleString(undefined, { maximumFractionDigits: 0 })} tonnes`)
      .style('opacity', 1)
  }

  gBars
    .selectAll('rect')
    .data(segs, segKey)
    .join(
      (enter) =>
        enter
          .append('rect')
          .attr('class', 'bar-segment')
          .attr('x', (d) => xScale(String(d.year)))
          .attr('width', xScale.bandwidth())
          .attr('y', baselineY)
          .attr('height', 0)
          .attr('fill', (d) => speciesBarFill(d.species))
          .attr('opacity', 0),
      (update) => update.attr('class', 'bar-segment'),
      (exit) =>
        exit.each(function (d) {
          select(this)
            .transition(t)
            .delay(exitDelay(d))
            .attr('y', baselineY)
            .attr('height', 0)
            .attr('opacity', 0)
            .remove()
        }),
    )
    .transition(t)
    .delay((d) => barDelay(d))
    .attr('x', (d) => xScale(String(d.year)))
    .attr('width', xScale.bandwidth())
    .attr('y', (d) => yScale(d.y1))
    .attr('height', (d) => Math.max(0, yScale(d.y0) - yScale(d.y1)))
    .attr('fill', (d) => speciesBarFill(d.species))
    .attr('opacity', 0.92)

  gHoverTargets
    .selectAll('rect.year-hitbox')
    .data(stageYears, (d) => d)
    .join(
      (enter) =>
        enter
          .append('rect')
          .attr('class', 'year-hitbox')
          .attr('x', (d) => xScale(String(d)))
          .attr('width', xScale.bandwidth())
          .attr('y', 0)
          .attr('height', innerH),
      (update) => update,
      (exit) => exit.remove(),
    )
    .attr('x', (d) => xScale(String(d)))
    .attr('width', xScale.bandwidth())
    .attr('y', 0)
    .attr('height', innerH)
    .on('mouseenter', function (_event, year) {
      updateHoverState(year)
    })
    .on('mousemove', function (_event, year) {
      updateHoverState(year)
    })
    .on('mouseleave', () => {
      hideHoverState()
    })

  const annotations = (stage.annotations || []).map((ann, ai) => ({
    ...ann,
    label:
      annotationLabelOverrides[annotationLabelKey(stageIdx, ai)] ?? ann.label ?? '',
  }))
  const annotationsWithText = annotations
    .map((ann, annoIndex) => ({ ...ann, _annoIndex: annoIndex }))
    .filter((a) => String(a.label ?? '').trim().length > 0)

  const isAnnotationFlyIntro =
    FIRST_ANNOTATION_STAGE_IDX >= 0 &&
    introPrimed.value &&
    !resizeOnly &&
    annotations.length > 0 &&
    annotationsWithText.length > 0 &&
    stageIdx === FIRST_ANNOTATION_STAGE_IDX &&
    priorStageIdx < FIRST_ANNOTATION_STAGE_IDX

  /** Slide annotation line + label in from chart-left on first annotated stage only. */
  const annoFlyDx = innerW + scalePx(160)

  // Remove legacy annotation classes so old mark types do not persist.
  gAnnotations
    .selectAll(
      'line.annotation-line, path.annotation-bracket, text.annotation-label, line.annotation-flag-arm',
    )
    .remove()

  const labelPadX = scalePx(6)
  const labelPadY = scalePx(5)
  const stackedAnnoPaint = readStackedBarsAnnotationPaint(el)
  const annoPillChromeStroke = readAnnotationPillBackdropChromeStroke(el)

  gAnnotations
    .selectAll('text.annotation-flag-label')
    .filter(function () {
      return this.parentNode?.classList?.contains('annotations')
    })
    .remove()

  function annotationWrapStableKey(d) {
    return `ann-slot-${d._annoIndex}`
  }

  const labelGs = gAnnotations
    .selectAll('g.annotation-flag-label-wrap')
    .data(annotationsWithText, annotationWrapStableKey)
    .join((enter) => {
      const g = enter.append('g').attr('class', 'annotation-flag-label-wrap')
      g.append('rect')
        .attr('class', 'annotation-flag-label-bg')
        .attr('width', 0)
        .attr('height', 0)
      g.append('text').attr('class', 'annotation-flag-label')
      return g
    })

  labelGs.interrupt()

  labelGs.select('text.annotation-flag-label')
    .attr('text-anchor', 'end')
    .attr('dominant-baseline', 'text-before-edge')
    .attr('x', -scalePx(ANNO_LABEL_LINE_GAP_PX))
    .attr('y', labelPadY)
    .text((d) => String(d.label ?? '').trim())

  layoutAnnotationBgRect(labelGs, labelPadX, labelPadY, 0, annoPillChromeStroke)

  const lineSel = gAnnotations
    .selectAll('line.annotation-flag-line')
    .data(annotations, (_, i) => `flag-line-${i}`)
    .join('line')
    .attr('class', 'annotation-flag-line')

  lineSel.interrupt()

  if (isAnnotationFlyIntro) {
    lineSel.each(function (d) {
      const xe = yearRightX(xScale, d.year)
      if (xe == null) return
      select(this)
        .attr('x1', xe - annoFlyDx)
        .attr('x2', xe - annoFlyDx)
        .attr('y1', yScale(d.y1))
        .attr('y2', yScale(d.y2))
    })
    labelGs.each(function (d) {
      const [x1, y1] = annotationLabelGroupTranslate(d, xScale, yScale)
      select(this).attr('transform', `translate(${x1 - annoFlyDx},${y1})`)
    })
  }

  /** Label follows annotated bar × line in lockstep via shared transition (same eased duration). */
  labelGs.attr('opacity', 1).transition(tAnnot).attrTween('transform', function (d) {
    const node = select(this)
    const [x1, y1] = annotationLabelGroupTranslate(d, xScale, yScale)
    const prev = parseSvgTranslate(node.attr('transform'))
    const x0 = prev?.[0] ?? x1
    const y0 = prev?.[1] ?? y1
    return (u) =>
      `translate(${x0 + (x1 - x0) * u},${y0 + (y1 - y0) * u})`
  })

  lineSel
    .transition(tAnnot)
    .attr('x1', (d) => yearRightX(xScale, d.year))
    .attr('x2', (d) => yearRightX(xScale, d.year))
    .attr('y1', (d) => yScale(d.y1))
    .attr('y2', (d) => yScale(d.y2))
    .attr('stroke', stackedAnnoPaint.stroke)
    .attr('stroke-width', stackedAnnoPaint.strokeWidth)

  prevRevealedYears.value = stageIdx >= 0 ? [...stageYears] : []
  prevActiveStep.value = props.activeStep
  lastDrawDims.value = { w: width, h: height }
}

let ro
onMounted(() => {
  const rows = parseCsv(csvRaw)
  matrixRef = buildYearMatrix(rows)
  chartEndYear.value = matrixRef.maxYear

  const el = hostRef.value
  if (!el) return

  svg = select(el).append('svg').attr('class', 'stacked-svg')
  drawChart()

  ro = new ResizeObserver(() => drawChart())
  ro.observe(el)

  nextTick(() => {
    const wrap = wrapRef.value
    if (!wrap || typeof IntersectionObserver === 'undefined') {
      introPrimed.value = true
      pendingIntroStagger.value = true
      drawChart()
      return
    }
    io = new IntersectionObserver(
      (entries) => {
        const e = entries[0]
        if (!e?.isIntersecting || e.intersectionRatio < 1) return
        if (introPrimed.value) return
        introPrimed.value = true
        pendingIntroStagger.value = true
        drawChart()
      },
      { threshold: 1 },
    )
    io.observe(wrap)
  })
})

watch(
  () => props.activeStep,
  () => drawChart(),
)

watch(
  annotationLabelOverrides,
  () => drawChart(),
  { deep: true },
)

onUnmounted(() => {
  ro?.disconnect()
  io?.disconnect()
  io = undefined
  svg?.remove()
  svg = null
})
</script>

<template>
  <div ref="wrapRef" class="stacked-wrap">
    <h1 class="visual-title chart-main-title">
      58 Years of Bluefin Catch Data
    </h1>
    <div class="stacked-chart-body">
      <div v-if="SHOW_ANNOTATION_TEXT_INPUT" class="annotation-text-inputs" aria-label="Annotation labels">
        <label v-for="row in annotationEditorRows" :key="row.key" class="annotation-input-row">
          <span class="annotation-input-meta">Year {{ row.year }}</span>
          <input
            v-model="annotationLabelOverrides[row.key]"
            type="text"
            class="annotation-text-input"
            maxlength="240"
          />
        </label>
      </div>
      <div class="chart-plot-layer">
        <div ref="hostRef" class="d3-host" />
        <aside class="legend" aria-label="Species in chart">
          <TransitionGroup name="legend" tag="ul" class="legend-list">
            <li v-for="s in legendSpecies" :key="s.code" class="legend-item">
              <span class="swatch" :style="{ '--swatch-color': speciesBarFill(s.code) }" />
              <span class="legend-label">{{ s.label }}</span>
            </li>
          </TransitionGroup>
        </aside>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stacked-wrap {
  height: var(--viz-chart-wrap-height);
  display: flex;
  flex-direction: column;
  position: relative;
  width: 100%;
  max-height: var(--viz-chart-wrap-max-height);
  overflow: hidden;
  font-family: var(--font-ui);
  font-weight: var(--font-weight-ui);
}

.chart-main-title {
  flex-shrink: 0;
  margin-bottom: var(--space-visual-title-gap);
}

.stacked-chart-body {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.annotation-text-inputs {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  align-items: center;
  padding: 0.35rem 0 0.5rem;
  margin-bottom: 0.25rem;
}

.annotation-input-row {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: var(--font-size-axis-tick);
  font-family: var(--font-family-axis-tick);
  font-weight: var(--font-weight-axis-tick);
  color: #475569;
}

.annotation-input-meta {
  white-space: nowrap;
}

.annotation-text-input {
  min-width: 10rem;
  max-width: min(36rem, 100%);
  padding: 0.2rem 0.45rem;
  border: 1px solid #cbd5e1;
  border-radius: 2px;
  font-size: var(--font-size-axis-tick);
  font-family: var(--font-family-axis-tick);
  font-weight: var(--font-weight-axis-tick);
  color: #0f172a;
  background: #fff;
}

.chart-plot-layer {
  position: relative;
  width: 100%;
  height: 100%;
}

.d3-host {
  width: 100%;
  height: 100%;
}

.stacked-wrap :deep(.stacked-svg) {
  display: block;
}

.stacked-wrap :deep(.bar-segment) {
  transition: opacity 0.2s ease;
}

.stacked-wrap :deep(.bar-segment.is-hovered) {
  opacity: 1 !important;
  stroke: rgba(15, 23, 42, 0.35);
  stroke-width: calc(0.8px * var(--story-scale));
}

.stacked-wrap :deep(.hover-line) {
  stroke: #334155;
  stroke-width: calc(2px * var(--story-scale));
  stroke-dasharray: 6 4;
  pointer-events: none;
}

.stacked-wrap :deep(.hover-line-label) {
  fill: #0f172a;
  font-size: var(--font-size-ui);
  font-family: var(--font-ui);
  font-weight: var(--font-weight-ui);
  pointer-events: none;
}

.stacked-wrap :deep(.year-hitbox) {
  fill: transparent;
}

.legend {
  position: absolute;
  right: var(--viz-chart-margin-right);
  bottom: calc(var(--viz-chart-margin-bottom) + var(--viz-legend-above-axis-gap));
  z-index: 6;
  width: auto;
  max-width: min(calc(280px * var(--story-scale)), 46vw);
  overflow: auto;
  padding: var(--viz-legend-padding);
  border: var(--viz-legend-border);
  border-radius: 0;
  background: var(--viz-legend-bg);
  box-shadow: none;
}

.legend-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--viz-legend-list-gap);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.04rem 0.05rem;
  font-size: var(--font-size-axis-title);
  font-family: inherit;
  color: #0f172a;
  line-height: var(--viz-legend-line-height);
}

.stacked-wrap :deep(.annotation-flag-label-wrap) {
  pointer-events: none;
}

.stacked-wrap :deep(.annotation-flag-label-bg) {
  fill: var(--color-annotation-white-background);
}

.stacked-wrap :deep(.annotation-flag-line) {
  opacity: var(--story-annotation-stacked-bars-flag-line-opacity);
  stroke-linecap: butt;
  stroke-linejoin: miter;
}

.stacked-wrap :deep(.annotation-flag-label) {
  font-size: var(--font-size-axis-title);
  font-family: var(--font-family-axis-tick);
  font-weight: var(--font-weight-axis-tick);
  fill: var(--story-annotation-stacked-bars-label-fill);
}

.swatch {
  width: 1rem;
  height: 0;
  border-top: calc(3px * var(--story-scale)) solid var(--swatch-color);
  border-top-style: solid;
  border-radius: 2px;
  background: transparent;
  border-image: none;
  flex-shrink: 0;
}

.legend-enter-active,
.legend-leave-active {
  transition: opacity 0.35s ease, transform 0.35s ease;
}

.legend-enter-from {
  opacity: 0;
  transform: translateX(6px);
}

.legend-leave-to {
  opacity: 0;
  transform: translateX(6px);
}

@media (max-width: 900px) {
  .legend {
    max-width: min(220px, 56vw);
  }
}

@media (max-width: 640px) {
  .legend {
    position: static;
    margin-top: 0.55rem;
    margin-left: auto;
    max-width: 100%;
  }
}
</style>

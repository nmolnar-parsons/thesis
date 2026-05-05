<script setup>
import { axisBottom, axisLeft } from 'd3-axis'
import { format as d3Format } from 'd3-format'
import { scaleBand, scaleLinear } from 'd3-scale'
import { select } from 'd3-selection'
import { transition } from 'd3-transition'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import csvRaw from '../data/GTA_FIRMs_tuna_cleaned_grouped.csv?raw'

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
const BLUEFIN_SPECIES = ['BFT', 'PBF', 'SBF']
const STAGGER_MS = 52

const SPECIES_META = [
  { code: 'PBF', label: 'Pacific bluefin' },
  { code: 'BFT', label: 'Atlantic bluefin' },
  { code: 'SBF', label: 'Southern bluefin' },
  { code: 'YFT', label: 'Yellowfin' },
  { code: 'BET', label: 'Bigeye' },
]

const SPECIES_COLORS = {
  PBF: '#5A7390',
  BFT: '#17203D',
  SBF: '#B3BFD1',
  YFT: '#E5D76A',
  BET: '#C2BD88',
}

const STAGES = [
  {
    species: ['BFT', 'PBF', 'SBF'],
    yearRange: [1965, 1990],
  },
  {
    species: ['BFT', 'PBF', 'SBF'],
    yearRange: [1965, 2007],
  },
  {
    species: ['BFT', 'PBF', 'SBF'],
    yearRange: [1965, 2012],
  },
  {
    species: ['BFT', 'PBF', 'SBF'],
  },
  {
    species: ['PBF', 'BFT', 'SBF', 'YFT', 'BET'],
    annotations: [
      {
        type: 'bracket',
        orientation: 'vertical',
        year: 2023,
        y1: 0,
        y2: 70000,
        label: 'the entire bluefin catch!',
      },
    ],
  },
]

const LAST_STAGE_INDEX = STAGES.length - 1

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

function yDomainMax(rawMax) {
  if (rawMax <= 0) return 1
  return rawMax * 1.5
}

function xTickYearsDecadal(years) {
  return years.filter((y) => (y - YEAR_START) % 10 === 0)
}

function yearCenterX(xScale, year) {
  const x = xScale(String(year))
  if (x == null) return null
  return x + xScale.bandwidth() / 2
}

function drawBracketPath(annotation, xScale, yScale) {
  const cap = 8
  if (annotation.orientation === 'vertical') {
    const x = yearCenterX(xScale, annotation.year)
    if (x == null) return null
    const y1 = yScale(annotation.y1)
    const y2 = yScale(annotation.y2)
    return `M ${x} ${y1} H ${x - cap} M ${x} ${y1} V ${y2} M ${x} ${y2} H ${x - cap}`
  }

  const y = yScale(annotation.y)
  const x1 = yearCenterX(xScale, annotation.x1Year)
  const x2 = yearCenterX(xScale, annotation.x2Year)
  if (x1 == null || x2 == null) return null
  return `M ${x1} ${y} V ${y - cap} M ${x1} ${y} H ${x2} M ${x2} ${y} V ${y - cap}`
}

function annotationLabelPosition(annotation, xScale, yScale) {
  if (annotation.type === 'line') {
    const x2 = yearCenterX(xScale, annotation.x2Year)
    if (x2 == null) return null
    return {
      x: x2 + 6 + (annotation.labelDx || 0),
      y: yScale(annotation.y2) - 4 + (annotation.labelDy || 0),
    }
  }
  if (annotation.orientation === 'vertical') {
    const x = yearCenterX(xScale, annotation.year)
    if (x == null) return null
    return {
      x: x + 10 + (annotation.labelDx || 0),
      y: (yScale(annotation.y1) + yScale(annotation.y2)) / 2 + (annotation.labelDy || 0),
    }
  }
  const x2 = yearCenterX(xScale, annotation.x2Year)
  if (x2 == null) return null
  return {
    x: x2 - 4 + (annotation.labelDx || 0),
    y: yScale(annotation.y) - 12 + (annotation.labelDy || 0),
  }
}

let svg
let matrixRef = { bySy: new Map(), years: [], maxYear: YEAR_START }

function drawChart() {
  const el = hostRef.value
  if (!el || !svg) return

  const width = el.clientWidth || 800
  const height = el.clientHeight || 480
  if (width < 20 || height < 20) return
  const margin = { top: 48, right: 34, bottom: 48, left: 84 }
  const innerW = width - margin.left - margin.right
  const innerH = height - margin.top - margin.bottom
  if (innerW < 20 || innerH < 20) return

  svg.attr('width', width).attr('height', height)

  const { years, bySy } = matrixRef
  const stageIdx = scrollStepToChartStage(props.activeStep)
  const stage =
    stageIdx >= 0 ? STAGES[stageIdx] : { species: [], yearRange: undefined, annotations: undefined }
  const order = stage.species
  const stageYears = stageIdx >= 0 ? yearsWithinRange(years, stage.yearRange) : []
  const isFinal = stageIdx === LAST_STAGE_INDEX

  const bluefinMaxRaw = maxStackForOrder(years, BLUEFIN_SPECIES, bySy)
  const fullMaxRaw = maxStackForOrder(years, STAGES[LAST_STAGE_INDEX].species, bySy)
  const yMax = yDomainMax(isFinal ? fullMaxRaw : bluefinMaxRaw)

  const xScale = scaleBand().domain(years.map(String)).range([0, innerW]).padding(0.15)
  const yScale = scaleLinear().domain([0, yMax]).range([innerH, 0])

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

  const barDuration = stepChanged ? 1200 : 320
  const t = transition().duration(barDuration).ease(easeCubicInOut)

  const baselineY = yScale(0)

  function barDelay(d) {
    if (!useStagger || isFinal) return 0
    const i = staggerIdx.get(d.year)
    return i === undefined ? 0 : i * STAGGER_MS
  }

  function exitDelay(d) {
    if (!useReverseStagger) return 0
    const i = exitStaggerIdx.get(d.year)
    return i === undefined ? 0 : i * STAGGER_MS
  }

  let gMain = svg.select('g.main')
  if (gMain.empty()) {
    gMain = svg.append('g').attr('class', 'main')
    gMain.append('g').attr('class', 'x-axis axis')
    gMain.append('g').attr('class', 'y-axis axis')
    gMain.append('text').attr('class', 'y-axis-label')
    gMain.append('g').attr('class', 'hover-guides')
    gMain.append('g').attr('class', 'bars')
    gMain.append('g').attr('class', 'hover-targets')
    gMain.append('g').attr('class', 'annotations')
  }
  gMain.attr('transform', `translate(${margin.left},${margin.top})`)

  const gx = gMain.select('g.x-axis')
  const decadeTicks = xTickYearsDecadal(years).map(String)
  gx.attr('transform', `translate(0,${innerH})`).call(
    axisBottom(xScale).tickValues(decadeTicks).tickSizeOuter(0),
  )
  gx.selectAll('text').attr('font-size', 11).attr('transform', null).style('text-anchor', 'middle')

  const gy = gMain.select('g.y-axis')
  const yAxisFn = axisLeft(yScale)
    .ticks(6)
    .tickPadding(10)
    .tickFormat(formatTickShort)
    .tickSizeOuter(0)
  if (introPrimed.value && stepChanged) {
    gy.transition(t).call(yAxisFn)
  } else {
    gy.call(yAxisFn)
  }

  gMain
    .select('text.y-axis-label')
    .attr('text-anchor', 'middle')
    .attr('transform', `translate(${-54}, ${innerH / 2}) rotate(-90)`)
    .attr('fill', '#334155')
    .attr('font-size', 13)
    .attr('font-family', 'inherit')
    .text('global tuna catch (tonnes)')

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
    .attr('y', -5)
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
          .attr('y', (d) =>
            !isFinal && useStagger && staggerIdx.has(d.year) ? baselineY : 0,
          )
          .attr('height', 0)
          .attr('fill', (d) => SPECIES_COLORS[d.species] || '#94a3b8')
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
    .attr('fill', (d) => SPECIES_COLORS[d.species] || '#94a3b8')
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

  const annotations = stage.annotations || []
  const lineAnn = annotations.filter((a) => a.type === 'line')
  const bracketAnn = annotations.filter((a) => a.type === 'bracket')

  gAnnotations
    .selectAll('line.annotation-line')
    .data(lineAnn, (_, i) => `line-${i}`)
    .join('line')
    .attr('class', 'annotation-line')
    .transition(t)
    .attr('x1', (d) => yearCenterX(xScale, d.x1Year))
    .attr('x2', (d) => yearCenterX(xScale, d.x2Year))
    .attr('y1', (d) => yScale(d.y1))
    .attr('y2', (d) => yScale(d.y2))
    .attr('stroke', '#dc2626')
    .attr('stroke-width', 2)
    .attr('stroke-linecap', 'round')
    .attr('opacity', 0.9)

  gAnnotations
    .selectAll('path.annotation-bracket')
    .data(bracketAnn, (_, i) => `bracket-${i}`)
    .join('path')
    .attr('class', 'annotation-bracket')
    .transition(t)
    .attr('d', (d) => drawBracketPath(d, xScale, yScale))
    .attr('fill', 'none')
    .attr('stroke', '#dc2626')
    .attr('stroke-width', 2)
    .attr('stroke-linecap', 'round')
    .attr('opacity', 0.9)

  gAnnotations
    .selectAll('text.annotation-label')
    .data(annotations.filter((a) => a.label), (_, i) => `label-${i}`)
    .join('text')
    .attr('class', 'annotation-label')
    .transition(t)
    .attr('x', (d) => annotationLabelPosition(d, xScale, yScale)?.x)
    .attr('y', (d) => annotationLabelPosition(d, xScale, yScale)?.y)
    .attr('font-size', 10)
    .attr('fill', '#b91c1c')
    .attr('font-weight', 600)
    .attr('opacity', 0.95)
    .text((d) => d.label)

  prevRevealedYears.value = stageIdx >= 0 ? [...stageYears] : []
  prevActiveStep.value = props.activeStep
  lastDrawDims.value = { w: width, h: height }
}

let ro
onMounted(() => {
  const rows = parseCsv(csvRaw)
  matrixRef = buildYearMatrix(rows)

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
    <div ref="hostRef" class="d3-host" />
    <aside class="legend" aria-label="Species in chart">
      <TransitionGroup name="legend" tag="ul" class="legend-list">
        <li v-for="s in legendSpecies" :key="s.code" class="legend-item">
          <span class="swatch" :style="{ '--swatch-color': SPECIES_COLORS[s.code] }" />
          <span class="legend-label">{{ s.label }}</span>
        </li>
      </TransitionGroup>
    </aside>
  </div>
</template>

<style scoped>
.stacked-wrap {
  --viz-height: clamp(420px, 82vh, 700px);
  position: relative;
  width: 100%;
  height: var(--viz-height);
  max-height: 700px;
  /* background: #fff; */
  /* border: 1px solid #cbd5e1; */
  /* border-radius: 0.75rem; */
  overflow: hidden;
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
  stroke-width: 0.8;
}

.stacked-wrap :deep(.hover-line) {
  stroke: #334155;
  stroke-width: 2;
  stroke-dasharray: 6 4;
  pointer-events: none;
}

.stacked-wrap :deep(.hover-line-label) {
  fill: #0f172a;
  font-size: 0.7rem;
  font-weight: 600;
  pointer-events: none;
}

.stacked-wrap :deep(.year-hitbox) {
  fill: transparent;
}

.legend {
  position: absolute;
  top: 0.25rem;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 1rem);
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0;
  border-radius: 0;
  background: transparent;
  border: none;
  box-shadow: none;
}

.legend-list {
  list-style: none;
  margin: 0;
  padding: 0.1rem 0.15rem;
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  justify-content: center;
  align-items: center;
  gap: 0.2rem 0.75rem;
  width: max-content;
  min-width: 100%;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.12rem 0.05rem;
  font-size: 0.74rem;
  font-family: inherit;
  color: #0f172a;
  line-height: 1.25;
}

.stacked-wrap :deep(.axis text) {
  fill: #475569;
  font-size: 0.78rem;
  font-family: inherit;
}

.stacked-wrap :deep(.axis path),
.stacked-wrap :deep(.axis line) {
  stroke: #94a3b8;
}

.swatch {
  width: 1rem;
  height: 0;
  border-top: 3px solid var(--swatch-color);
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
  .stacked-wrap {
    --viz-height: clamp(320px, 68vh, 560px);
    max-height: 560px;
  }

  .legend {
    top: 0.2rem;
  }
}
</style>

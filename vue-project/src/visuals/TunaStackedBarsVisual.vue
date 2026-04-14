<script setup>
import { axisBottom, axisLeft } from 'd3-axis'
import { scaleBand, scaleLinear } from 'd3-scale'
import { select } from 'd3-selection'
import { transition } from 'd3-transition'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import csvRaw from '../data/GTA_FIRMs_tuna_cleaned_grouped.csv?raw'

const props = defineProps({
  activeStep: { type: Number, default: 0 },
})

const hostRef = ref(null)
const YEAR_START = 1965

const SPECIES_META = [
  { code: 'PBF', label: 'Pacific bluefin' },
  { code: 'BFT', label: 'Atlantic bluefin' },
  { code: 'SBF', label: 'Southern bluefin' },
  { code: 'YFT', label: 'Yellowfin' },
  { code: 'BET', label: 'Bigeye' },
]

const SPECIES_COLORS = {
  PBF: '#0ea5e9',
  BFT: '#6366f1',
  SBF: '#14b8a6',
  YFT: '#f59e0b',
  BET: '#db2777',
}

const STAGES = [['PBF'], ['PBF', 'BFT', 'SBF'], ['PBF', 'BFT', 'SBF', 'YFT', 'BET']]

const stageSpecies = computed(() => STAGES[Math.min(Math.max(props.activeStep, 0), STAGES.length - 1)])

const legendSpecies = computed(() =>
  SPECIES_META.filter((s) => stageSpecies.value.includes(s.code)),
)

function easeCubicInOut(t) {
  return t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

const prevActiveStep = ref(null)

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

function yDomainMax(rawMax) {
  if (rawMax <= 0) return 1
  return rawMax * 1.08
}

function xTickYearsDecadal(years) {
  return years.filter((y) => (y - YEAR_START) % 10 === 0)
}

let svg
let matrixRef = { bySy: new Map(), years: [], maxYear: YEAR_START }

function drawChart() {
  const el = hostRef.value
  if (!el || !svg) return

  const width = el.clientWidth || 800
  const height = el.clientHeight || 480
  const margin = { top: 28, right: 160, bottom: 48, left: 62 }
  const innerW = width - margin.left - margin.right
  const innerH = height - margin.top - margin.bottom

  svg.attr('width', width).attr('height', height)

  const { years, bySy } = matrixRef
  const order = stageSpecies.value

  const stackMax = maxStackForOrder(years, order, bySy)
  const yMax = yDomainMax(stackMax)

  const xScale = scaleBand().domain(years.map(String)).range([0, innerW]).padding(0.15)
  const yScale = scaleLinear().domain([0, yMax]).range([innerH, 0])

  const segs = segmentGeometry(years, order, bySy)

  const stepChanged = prevActiveStep.value !== null && prevActiveStep.value !== props.activeStep
  prevActiveStep.value = props.activeStep
  const barDuration = stepChanged ? 1200 : 320
  const t = transition().duration(barDuration).ease(easeCubicInOut)

  let gMain = svg.select('g.main')
  if (gMain.empty()) {
    gMain = svg.append('g').attr('class', 'main')
    gMain.append('g').attr('class', 'x-axis')
    gMain.append('g').attr('class', 'y-axis')
    gMain.append('text').attr('class', 'y-axis-label')
    gMain.append('g').attr('class', 'bars')
  }
  gMain.attr('transform', `translate(${margin.left},${margin.top})`)

  const gx = gMain.select('g.x-axis')
  const decadeTicks = xTickYearsDecadal(years).map(String)
  gx.attr('transform', `translate(0,${innerH})`).call(
    axisBottom(xScale).tickValues(decadeTicks).tickSizeOuter(0),
  )
  gx.selectAll('text').attr('font-size', 10).attr('transform', 'rotate(-35)').style('text-anchor', 'end')

  const gy = gMain.select('g.y-axis')
  gy.call(
    axisLeft(yScale)
      .ticks(6)
      .tickFormat((d) => Number(d).toLocaleString(undefined, { maximumFractionDigits: 0 }))
      .tickSizeOuter(0),
  )
  gy.selectAll('.tick text').attr('font-size', 10)

  gMain
    .select('text.y-axis-label')
    .attr('text-anchor', 'middle')
    .attr('transform', `translate(${-46}, ${innerH / 2}) rotate(-90)`)
    .attr('fill', '#334155')
    .attr('font-size', 11)
    .text('global tuna catch (tonnes)')

  const gBars = gMain.select('g.bars')
  gBars.selectAll('rect').interrupt()

  const segKey = (d) => `${d.year}-${d.species}`

  gBars
    .selectAll('rect')
    .data(segs, segKey)
    .join(
      (enter) =>
        enter
          .append('rect')
          .attr('x', (d) => xScale(String(d.year)))
          .attr('width', xScale.bandwidth())
          .attr('y', (d) => yScale(d.y0))
          .attr('height', 0)
          .attr('fill', (d) => SPECIES_COLORS[d.species] || '#94a3b8')
          .attr('opacity', 0),
      (update) => update,
      (exit) =>
        exit.each(function () {
          const elSel = select(this)
          const yTop = Number(elSel.attr('y'))
          const h = Number(elSel.attr('height')) || 0
          elSel
            .transition(t)
            .attr('y', yTop + h)
            .attr('height', 0)
            .attr('opacity', 0)
            .remove()
        }),
    )
    .transition(t)
    .attr('x', (d) => xScale(String(d.year)))
    .attr('width', xScale.bandwidth())
    .attr('y', (d) => yScale(d.y1))
    .attr('height', (d) => Math.max(0, yScale(d.y0) - yScale(d.y1)))
    .attr('fill', (d) => SPECIES_COLORS[d.species] || '#94a3b8')
    .attr('opacity', 0.92)
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
})

watch(
  () => props.activeStep,
  () => drawChart(),
)

onUnmounted(() => {
  ro?.disconnect()
  svg?.remove()
  svg = null
})
</script>

<template>
  <div class="stacked-wrap">
    <div ref="hostRef" class="d3-host" />
    <aside class="legend" aria-label="Species in chart">
      <TransitionGroup name="legend" tag="ul" class="legend-list">
        <li v-for="s in legendSpecies" :key="s.code" class="legend-item">
          <span class="swatch" :style="{ background: SPECIES_COLORS[s.code] }" />
          <span class="legend-label"><strong>{{ s.code }}</strong> · {{ s.label }}</span>
        </li>
      </TransitionGroup>
    </aside>
  </div>
</template>

<style scoped>
.stacked-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: min(70vh, 560px);
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 0.75rem;
  overflow: hidden;
}

.d3-host {
  width: 100%;
  height: 100%;
  min-height: min(70vh, 560px);
}

.stacked-wrap :deep(.stacked-svg) {
  display: block;
}

.legend {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  max-width: 11rem;
  padding: 0.5rem 0.65rem;
  border-radius: 0.5rem;
  background: rgba(248, 250, 252, 0.94);
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
  pointer-events: none;
}

.legend-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.72rem;
  color: #0f172a;
  line-height: 1.25;
  padding: 0.2rem 0;
}

.swatch {
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 2px;
  flex-shrink: 0;
}

.legend-label strong {
  font-weight: 700;
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
</style>

<script setup>
import { max, min } from 'd3-array'
import { axisBottom, axisLeft } from 'd3-axis'
import { csvParse } from 'd3-dsv'
import { line } from 'd3-shape'
import { scaleLinear, scaleOrdinal } from 'd3-scale'
import { schemeCategory10 } from 'd3-scale-chromatic'
import { pointer, select } from 'd3-selection'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import csvRaw from '../data/toyosu_tuna_04-23.csv?raw'

const hostRef = ref(null)
const tooltipRef = ref(null)
const yearsRef = ref([])

let svg
let resizeObserver
let seriesRows = []

const YEAR_START = 2004
const YEAR_END = 2023
const PRICE_CAP_YEN = 16000

const orderedYears = computed(() => yearsRef.value)

function parseData() {
  const rows = csvParse(csvRaw, (d) => ({
    year: Number(d.year),
    month: Number(d.month),
    weekOfMonth: Number(d.week),
    weekNumber: Number(d.week_number),
    priceMid: Number(d.price_mid),
  }))
    .filter(
      (d) =>
        Number.isFinite(d.year) &&
        Number.isFinite(d.month) &&
        Number.isFinite(d.weekOfMonth) &&
        Number.isFinite(d.weekNumber) &&
        Number.isFinite(d.priceMid),
    )
    .filter((d) => d.year >= YEAR_START && d.year <= YEAR_END)
    .filter((d) => d.priceMid <= PRICE_CAP_YEN)

  const grouped = new Map()
  for (const row of rows) {
    const bucket = grouped.get(row.year) || []
    bucket.push(row)
    grouped.set(row.year, bucket)
  }

  const years = Array.from(grouped.keys()).sort((a, b) => a - b)
  seriesRows = years.map((year) => ({
    year,
    values: grouped
      .get(year)
      .sort((a, b) => a.month - b.month || a.weekOfMonth - b.weekOfMonth)
      .slice(0, 52)
      .map((d, i) => ({ ...d, weekInYear: i + 1 })),
  }))
  yearsRef.value = years

  return { years }
}

function drawChart() {
  if (!hostRef.value || !svg) return

  parseData()
  if (!seriesRows.length) return

  const host = hostRef.value
  const width = host.clientWidth || 860
  const height = host.clientHeight || 520
  if (width < 20 || height < 20) return
  const margin = { top: 28, right: 24, bottom: 46, left: 72 }
  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom
  if (innerWidth < 20 || innerHeight < 20) return

  svg.attr('width', width).attr('height', height)
  svg.selectAll('*').remove()

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  const allValues = seriesRows.flatMap((d) => d.values.map((v) => v.priceMid))
  const yMin = min(allValues) ?? 0
  const yMax = max(allValues) ?? 1

  const xScale = scaleLinear().domain([1, 52]).range([0, innerWidth])
  const yScale = scaleLinear().domain([Math.max(0, yMin * 0.92), yMax * 1.06]).range([innerHeight, 0])

  const colorScale = scaleOrdinal().domain(orderedYears.value).range(schemeCategory10)

  const lineGen = line()
    .x((d) => xScale(d.weekInYear))
    .y((d) => yScale(d.priceMid))

  g.append('g')
    .attr('class', 'axis axis-x')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(axisBottom(xScale).tickValues([1, 13, 26, 39, 52]).tickFormat((d) => `W${d}`))

  g.append('g')
    .attr('class', 'axis axis-y')
    .call(axisLeft(yScale).ticks(7).tickFormat((d) => `¥${Number(d).toLocaleString()}`))

  g.append('text')
    .attr('class', 'axis-label')
    .attr('x', innerWidth / 2)
    .attr('y', innerHeight + 38)
    .attr('text-anchor', 'middle')
    .text('Week of Year')

  g.append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerHeight / 2)
    .attr('y', -54)
    .attr('text-anchor', 'middle')
    .text('Toyosu Mid Price (yen)')

  const yearGroups = g
    .selectAll('.year-group')
    .data(seriesRows, (d) => d.year)
    .join('g')
    .attr('class', 'year-group')
    .attr('data-year', (d) => d.year)

  yearGroups
    .append('path')
    .attr('class', 'year-line')
    .attr('data-year', (d) => d.year)
    .attr('d', (d) => lineGen(d.values))
    .attr('stroke', (d) => colorScale(d.year))
    .attr('fill', 'none')
    .attr('stroke-width', 2)

  const tooltipEl = tooltipRef.value
  yearGroups
    .append('path')
    .attr('class', 'year-line-overlay')
    .attr('data-year', (d) => d.year)
    .attr('d', (d) => lineGen(d.values))
    .attr('stroke', 'transparent')
    .attr('stroke-width', 12)
    .attr('fill', 'none')
    .attr('pointer-events', 'stroke')
    .on('mouseenter', function (event, d) {
      setActiveYear(d.year)
      if (!tooltipEl) return
      tooltipEl.style.opacity = '1'
      tooltipEl.textContent = `${d.year}`
      tooltipEl.style.left = `${event.offsetX + 12}px`
      tooltipEl.style.top = `${event.offsetY + 12}px`
    })
    .on('mousemove', function (event, d) {
      setActiveYear(d.year)
      if (!tooltipEl) return
      const [x] = pointer(event, g.node())
      const week = Math.round(xScale.invert(x))
      const point = d.values[Math.max(0, Math.min(51, week - 1))]
      tooltipEl.textContent = `${d.year} · W${week} · ¥${Math.round(point?.priceMid || 0).toLocaleString()}`
      tooltipEl.style.left = `${event.offsetX + 12}px`
      tooltipEl.style.top = `${event.offsetY + 12}px`
    })
    .on('mouseleave', () => {
      clearActiveYear()
      if (!tooltipEl) return
      tooltipEl.style.opacity = '0'
    })
}

function setActiveYear(year) {
  if (!svg) return
  const root = select(svg.node().parentNode)
  root.selectAll('.year-line').classed('is-active', (d) => d.year === year).classed('is-inactive', (d) => d.year !== year)
  root
    .selectAll('.legend-item')
    .classed('is-active', (_d, i, nodes) => Number(nodes[i].getAttribute('data-year')) === year)
    .classed('is-inactive', (_d, i, nodes) => Number(nodes[i].getAttribute('data-year')) !== year)
}

function clearActiveYear() {
  if (!svg) return
  const root = select(svg.node().parentNode)
  root.selectAll('.year-line').classed('is-active', false).classed('is-inactive', false)
  root.selectAll('.legend-item').classed('is-active', false).classed('is-inactive', false)
}

function yearColor(year) {
  if (!orderedYears.value.length) return '#64748b'
  return scaleOrdinal().domain(orderedYears.value).range(schemeCategory10)(year)
}

onMounted(() => {
  const host = hostRef.value
  if (!host) return

  svg = select(host).append('svg').attr('class', 'toyosu-prices-line-svg')
  drawChart()

  resizeObserver = new ResizeObserver(() => drawChart())
  resizeObserver.observe(host)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  svg?.remove()
  svg = null
})
</script>

<template>
  <div class="linechart-wrap">
    <div ref="hostRef" class="d3-host" />
    <div ref="tooltipRef" class="tooltip" />
    <aside class="legend" aria-label="Year lines in chart">
      <ul class="legend-list">
        <li
          v-for="year in orderedYears"
          :key="year"
          class="legend-item"
          :data-year="year"
          @mouseenter="setActiveYear(year)"
          @mouseleave="clearActiveYear()"
        >
          <span class="swatch" :style="{ background: yearColor(year) }" />
          <span class="legend-label">{{ year }}</span>
        </li>
      </ul>
    </aside>
  </div>
</template>

<style scoped>
.linechart-wrap {
  --viz-height: clamp(320px, 70vh, 560px);
  position: relative;
  width: 100%;
  height: var(--viz-height);
  max-height: 560px;
  overflow: hidden;
}

.d3-host {
  width: 100%;
  height: 100%;
}

.d3-host :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}

.linechart-wrap :deep(.axis text) {
  fill: #475569;
  font-size: 0.72rem;
}

.linechart-wrap :deep(.axis path),
.linechart-wrap :deep(.axis line) {
  stroke: #94a3b8;
}

.linechart-wrap :deep(.axis-label) {
  fill: #334155;
  font-size: 0.74rem;
}

.linechart-wrap :deep(.year-line) {
  opacity: 1;
  transition: opacity 0.18s ease, stroke-width 0.18s ease;
}

.linechart-wrap :deep(.year-line.is-active) {
  opacity: 1;
  stroke-width: 3;
}

.linechart-wrap :deep(.year-line.is-inactive) {
  opacity: 0.14;
}

.linechart-wrap :deep(.year-line-overlay) {
  cursor: pointer;
}

.legend {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  max-height: calc(100% - 1.5rem);
  overflow: auto;
  padding: 0.45rem 0.55rem;
  border-radius: 0.5rem;
  background: rgba(248, 250, 252, 0.94);
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
}

.legend-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.12rem 0.05rem;
  font-size: 0.68rem;
  color: #0f172a;
  cursor: pointer;
  transition: opacity 0.18s ease;
}

.legend-item.is-active {
  opacity: 1;
  font-weight: 700;
}

.legend-item.is-inactive {
  opacity: 0.32;
}

.swatch {
  width: 0.62rem;
  height: 0.62rem;
  border-radius: 2px;
  flex-shrink: 0;
}

.tooltip {
  position: absolute;
  opacity: 0;
  pointer-events: none;
  z-index: 10;
  padding: 0.35rem 0.5rem;
  border-radius: 0.4rem;
  background: rgba(15, 23, 42, 0.9);
  color: #f8fafc;
  font-size: 0.7rem;
  line-height: 1.25;
  box-shadow: 0 4px 16px rgba(2, 6, 23, 0.35);
}

@media (max-width: 900px) {
  .linechart-wrap {
    --viz-height: clamp(260px, 58vh, 460px);
    max-height: 460px;
  }

  .legend {
    max-height: 45%;
    max-width: min(9.5rem, calc(100% - 1rem));
    padding: 0.35rem 0.45rem;
  }
}
</style>

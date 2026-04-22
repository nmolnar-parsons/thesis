<script setup>
import { max, rollup, sum } from 'd3-array'
import { axisBottom, axisLeft } from 'd3-axis'
import { csvParse } from 'd3-dsv'
import { scaleLinear, scaleOrdinal } from 'd3-scale'
import { pointer, select } from 'd3-selection'
import { area, stack } from 'd3-shape'
import { onMounted, onUnmounted, ref } from 'vue'
import csvRaw from '../data/noaa_import_tunas_bluefin.csv?raw'

const hostRef = ref(null)
const tooltipRef = ref(null)

let svg
let resizeObserver
let stackRows = []

const JAPAN_RED = '#d32f2f'
const FALLBACK_COLORS = [
  '#2563eb',
  '#06b6d4',
  '#8b5cf6',
  '#14b8a6',
  '#f59e0b',
  '#ef4444',
  '#0ea5e9',
  '#84cc16',
  '#f97316',
  '#6366f1',
  '#22c55e',
  '#e879f9',
]

function parseData() {
  const rows = csvParse(csvRaw, (d) => ({
    year: Number(d.Year),
    country: d['Country Name'],
    volume: Number(d['Volume (kg)']),
  }))
    .filter((d) => Number.isFinite(d.year) && Number.isFinite(d.volume) && d.country)
    .filter((d) => d.year <= 2025)

  const grouped = rollup(
    rows,
    (values) => sum(values, (d) => d.volume),
    (d) => d.year,
    (d) => d.country,
  )

  const years = Array.from(grouped.keys()).sort((a, b) => a - b)
  const countries = Array.from(new Set(rows.map((d) => d.country))).sort()

  stackRows = years.map((year) => {
    const entry = { year }
    for (const country of countries) {
      entry[country] = grouped.get(year)?.get(country) || 0
    }
    return entry
  })

  return { years, countries }
}

function drawChart() {
  if (!hostRef.value || !svg) return

  const { years, countries } = parseData()
  if (!years.length || !countries.length) return

  const host = hostRef.value
  const width = host.clientWidth || 960
  const height = host.clientHeight || 540
  const margin = { top: 28, right: 24, bottom: 44, left: 64 }
  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom

  svg.attr('width', width).attr('height', height)
  svg.selectAll('*').remove()

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  const stackGen = stack().keys(countries)
  const layers = stackGen(stackRows)

  const maxY = max(layers, (series) => max(series, (point) => point[1])) ?? 1
  const xScale = scaleLinear().domain([years[0], years[years.length - 1]]).range([0, innerWidth])
  const yScale = scaleLinear().domain([0, maxY]).range([innerHeight, 0])

  const colorScale = scaleOrdinal().domain(countries).range(FALLBACK_COLORS)
  const getColor = (country) => (country === 'JAPAN' ? JAPAN_RED : colorScale(country))

  const shape = area()
    .x((point) => xScale(point.data.year))
    .y0((point) => yScale(point[0]))
    .y1((point) => yScale(point[1]))

  const tooltipEl = tooltipRef.value

  function hideTooltip() {
    if (!tooltipEl) return
    tooltipEl.style.opacity = '0'
  }

  function updateTooltip(event, series) {
    if (!tooltipEl) return
    const [mouseX] = pointer(event, g.node())
    const domainYear = Math.round(xScale.invert(mouseX))
    const clampedYear = Math.min(Math.max(domainYear, years[0]), years[years.length - 1])
    const selected = stackRows.find((d) => d.year === clampedYear)
    if (!selected) return

    const volume = selected[series.key] || 0
    tooltipEl.innerHTML = `<div class="country">${series.key}</div><div>${clampedYear}: ${volume.toLocaleString()} kg</div>`
    tooltipEl.style.opacity = '1'
    tooltipEl.style.left = `${event.offsetX + 14}px`
    tooltipEl.style.top = `${event.offsetY + 14}px`
  }

  g.selectAll('.stream')
    .data(layers)
    .join('path')
    .attr('class', 'stream')
    .attr('d', shape)
    .attr('fill', (d) => getColor(d.key))
    .on('mouseenter', function (event, series) {
      g.selectAll('.stream').classed('inactive', (d) => d.key !== series.key)
      updateTooltip(event, series)
    })
    .on('mousemove', function (event, series) {
      updateTooltip(event, series)
    })
    .on('mouseleave', () => {
      g.selectAll('.stream').classed('inactive', false)
      hideTooltip()
    })

  g.append('g')
    .attr('class', 'axis axis-x')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(axisBottom(xScale).tickFormat((d) => Number(d).toString()))


  g.append('g')
    .attr('class', 'axis axis-y')
    .call(axisLeft(yScale).tickFormat((d) => `${(Number(d) / 1000000).toFixed(1)}M`))
    // add y-axis label
    g.append('text')
      .attr('class', 'axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('y', -margin.left + 5)
      .attr('x', -height / 2)
      .attr('dy', '.8em')
      .text('Volume (kg)')
}

onMounted(() => {
  const host = hostRef.value
  if (!host) return

  svg = select(host).append('svg').attr('class', 'import-streamgraph-svg')
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
  <div class="streamgraph-wrap chart-frame">
    <div ref="hostRef" class="d3-host chart-frame-host" />
    <div ref="tooltipRef" class="tooltip" />
  </div>
</template>

<style scoped>
.streamgraph-wrap {
  position: relative;
  width: 100%;
  min-height: min(46.67vh, 373px);
  /* border-radius: 0.75rem; */
  /* border: 1px solid #cbd5e1; */
  /* background: #ffffff; */
  /* box-shadow: 0 6px 24px rgba(15, 23, 42, 0.06); */
  overflow: hidden;
}

.d3-host {
  width: 100%;
  height: min(46.67vh, 373px);
}

.d3-host :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}

.streamgraph-wrap :deep(.axis text) {
  fill: #475569;
  font-size: 0.72rem;
}

.streamgraph-wrap :deep(.axis path),
.streamgraph-wrap :deep(.axis line) {
  stroke: #94a3b8;
}

.streamgraph-wrap :deep(.stream) {
  fill-opacity: 0.76;
  transition: fill-opacity 0.2s ease;
  cursor: pointer;
}

.streamgraph-wrap :deep(.stream:hover) {
  fill-opacity: 0.9;
}

.streamgraph-wrap :deep(.stream.inactive) {
  fill-opacity: 0.12;
}

.tooltip {
  position: absolute;
  opacity: 0;
  pointer-events: none;
  z-index: 10;
  padding: 0.5rem 0.65rem;
  border-radius: 0.45rem;
  background: rgba(15, 23, 42, 0.9);
  color: #f8fafc;
  font-size: 0.74rem;
  line-height: 1.35;
  box-shadow: 0 4px 16px rgba(2, 6, 23, 0.35);
}

.tooltip :deep(.country) {
  font-weight: 700;
}
</style>

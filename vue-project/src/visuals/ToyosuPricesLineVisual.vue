<script setup>
import { max, min } from 'd3-array'
import { axisBottom, axisLeft } from 'd3-axis'
import { csvParse } from 'd3-dsv'
import { line } from 'd3-shape'
import { scaleLinear } from 'd3-scale'
import { pointer, select } from 'd3-selection'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import csvRaw from '../data/toyosu_avg_all.csv?raw'

const wrapRef = ref(null)
const hostRef = ref(null)
const tooltipRef = ref(null)
const seriesRef = ref([])
const lockedSeriesId = ref(null)

let svg
let resizeObserver
let chartState = null

const YEAR_START = 2004
const YEAR_END = 2023
const inactiveStrokeOpacity = ref(0.34)
const nonBluefinBaseOpacity = ref(0.34)
const BLUEFIN_ATLANTIC_COLOR = '#17203D'
const NON_BLUEFIN_PALETTE = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#0ea5e9',
  '#3b82f6',
  '#8b5cf6',
  '#d946ef',
  '#ec4899',
  '#14b8a6',
  '#84cc16',
]

const BLUEFIN_SERIES_CONFIG = [
  {
    id: 'bluefin_mid',
    label: 'Bluefin tuna - mid',
    itemName: 'Bluefin tuna',
    metric: 'price_mid',
    color: BLUEFIN_ATLANTIC_COLOR,
    strokeWidth: 4,
  },
  {
    id: 'bluefin_low',
    label: 'Bluefin tuna - low',
    itemName: 'Bluefin tuna',
    metric: 'price_low',
    color: BLUEFIN_ATLANTIC_COLOR,
    strokeWidth: 4,
    dasharray: '5 4',
    defaultOpacity: 0.75,
  },
]

const LEGEND_SERIES_IDS = new Set(['bluefin_mid', 'bigeye_mid'])
const orderedSeries = computed(() => seriesRef.value)
const legendSeries = computed(() => orderedSeries.value.filter((series) => LEGEND_SERIES_IDS.has(series.id)))

function parseData() {
  const rows = csvParse(csvRaw, (d) => ({
    year: Number(d.year),
    itemName: d.item_en?.trim(),
    priceHigh: Number(d.price_high),
    priceMid: Number(d.price_mid),
    priceLow: Number(d.price_low),
  })).filter(
    (d) =>
      Number.isFinite(d.year) &&
      Number.isFinite(d.priceHigh) &&
      Number.isFinite(d.priceMid) &&
      Number.isFinite(d.priceLow) &&
      d.itemName &&
      d.year >= YEAR_START &&
      d.year <= YEAR_END,
  )

  const bluefinSeries = BLUEFIN_SERIES_CONFIG.map((config) => ({
    ...config,
    points: rows
      .filter((row) => row.itemName === config.itemName)
      .sort((a, b) => a.year - b.year)
      .map((row) => ({
        year: row.year,
        value:
          config.metric === 'price_high'
            ? row.priceHigh
            : config.metric === 'price_low'
              ? row.priceLow
              : row.priceMid,
      }))
      .filter((point) => Number.isFinite(point.value) && point.value > 0),
  })).filter((s) => s.points.length > 0)

  const otherItems = Array.from(new Set(rows.map((row) => row.itemName))).sort((a, b) => a.localeCompare(b))
  const otherMidSeries = otherItems
    .filter((itemName) => itemName !== 'Bluefin tuna')
    .map((itemName, index) => {
      const isBigeye = itemName === 'Bigeye'
      return {
        id: isBigeye ? 'bigeye_mid' : `item_${itemName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_mid`,
        label: `${itemName} - mid`,
        itemName,
        metric: 'price_mid',
        color: isBigeye ? '#16a34a' : NON_BLUEFIN_PALETTE[index % NON_BLUEFIN_PALETTE.length],
        strokeWidth: isBigeye ? 2.2 : 1.35,
        defaultOpacity: isBigeye ? 0.52 : nonBluefinBaseOpacity.value,
        points: rows
          .filter((row) => row.itemName === itemName)
          .sort((a, b) => a.year - b.year)
          .map((row) => ({ year: row.year, value: row.priceMid }))
          .filter((point) => Number.isFinite(point.value) && point.value > 0),
      }
    })
    .filter((series) => series.points.length > 0)

  const series = [...bluefinSeries, ...otherMidSeries]

  const bluefinMidByYear = new Map(
    rows
      .filter((row) => row.itemName === 'Bluefin tuna' && row.priceMid > 0)
      .map((row) => [row.year, row.priceMid]),
  )

  const years = Array.from(
    new Set(series.flatMap((s) => s.points.map((p) => p.year))).values(),
  ).sort((a, b) => a - b)

  const allValues = series.flatMap((s) => s.points.map((p) => p.value))
  const yMin = min(allValues) ?? 1
  const yMax = max(allValues) ?? 1

  seriesRef.value = series
  chartState = {
    series,
    years,
    allValues,
    yMin,
    yMax,
    bluefinMidByYear,
  }
}

function drawChart() {
  if (!hostRef.value || !svg) return

  parseData()
  if (!chartState || !chartState.series.length) return

  const host = hostRef.value
  const width = host.clientWidth || 860
  const height = host.clientHeight || 520
  if (width < 20 || height < 20) return
  const margin = { top: 34, right: 24, bottom: 46, left: 72 }
  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom
  if (innerWidth < 20 || innerHeight < 20) return

  svg.attr('width', width).attr('height', height)
  svg.selectAll('*').remove()

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)
  const yearMin = min(chartState.years) ?? YEAR_START
  const yearMax = max(chartState.years) ?? YEAR_END
  const xScale = scaleLinear().domain([yearMin, yearMax]).range([0, innerWidth])
  const yScale = scaleLinear()
    .domain([Math.max(0, chartState.yMin * 0.92), chartState.yMax * 1.08])
    .range([innerHeight, 0])

  const lineGen = line()
    .x((d) => xScale(d.year))
    .y((d) => yScale(d.value))

  const hoverLine = g
    .append('line')
    .attr('class', 'hover-line')
    .attr('x1', 0)
    .attr('x2', 0)
    .attr('y1', 0)
    .attr('y2', innerHeight)
    .style('opacity', 0)

  const hoverLabel = g
    .append('text')
    .attr('class', 'hover-line-label')
    .attr('x', 0)
    .attr('y', -8)
    .attr('text-anchor', 'middle')
    .style('opacity', 0)

  g.append('g')
    .attr('class', 'axis axis-x')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(
      axisBottom(xScale)
        .tickValues(chartState.years)
        .tickFormat((d) => `${Math.round(Number(d))}`),
    )

  g.append('g')
    .attr('class', 'axis axis-y')
    .call(axisLeft(yScale).ticks(7).tickFormat((d) => `¥${Number(d).toLocaleString()}`))

  g.append('text')
    .attr('class', 'axis-label')
    .attr('x', innerWidth / 2)
    .attr('y', innerHeight + 38)
    .attr('text-anchor', 'middle')
    .text('Year')

  g.append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerHeight / 2)
    .attr('y', -54)
    .attr('text-anchor', 'middle')
    .text('Price per kg (JPY)')

  const seriesGroups = g
    .selectAll('.series-group')
    .data(chartState.series, (d) => d.id)
    .join('g')
    .attr('class', 'series-group')
    .attr('data-series-id', (d) => d.id)

  seriesGroups
    .append('path')
    .attr('class', 'series-line')
    .attr('data-series-id', (d) => d.id)
    .attr('d', (d) => lineGen(d.points))
    .attr('stroke', (d) => d.color)
    .attr('stroke-dasharray', (d) => d.dasharray || null)
    .attr('fill', 'none')
    .attr('stroke-width', (d) => d.strokeWidth || 2)
    .attr('stroke-opacity', (d) => d.defaultOpacity ?? 1)

  const tooltipEl = tooltipRef.value
  seriesGroups
    .append('path')
    .attr('class', 'series-line-overlay')
    .attr('data-series-overlay', 'true')
    .attr('data-series-id', (d) => d.id)
    .attr('d', (d) => lineGen(d.points))
    .attr('stroke', 'transparent')
    .attr('stroke-width', 12)
    .attr('fill', 'none')
    .attr('pointer-events', 'stroke')
    .on('mouseenter', function (event, d) {
      if (!lockedSeriesId.value) setActiveSeries(d.id)
      updateHoverLine(event)
      if (!tooltipEl) return
      tooltipEl.style.opacity = '1'
      tooltipEl.textContent = d.label
      tooltipEl.style.left = `${event.offsetX + 12}px`
      tooltipEl.style.top = `${event.offsetY + 12}px`
    })
    .on('mousemove', function (event, d) {
      if (!lockedSeriesId.value) setActiveSeries(d.id)
      updateHoverLine(event)
      if (!tooltipEl) return
      const [x] = pointer(event, g.node())
      const year = Math.round(xScale.invert(x))
      const point = nearestPointByYear(d.points, year)
      tooltipEl.textContent = `${point?.year ?? year} · ${d.label} · ¥${Math.round(
        point?.value || 0,
      ).toLocaleString()}`
      tooltipEl.style.left = `${event.offsetX + 12}px`
      tooltipEl.style.top = `${event.offsetY + 12}px`
    })
    .on('mouseleave', () => {
      if (!lockedSeriesId.value) clearActiveSeries()
      if (!tooltipEl) return
      tooltipEl.style.opacity = '0'
    })
    .on('click', function (event, d) {
      event.stopPropagation()
      lockSeries(d.id)
    })

  const interactionRect = g
    .append('rect')
    .attr('class', 'interaction-overlay')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', innerWidth)
    .attr('height', innerHeight)
    .attr('fill', 'transparent')
    .on('mouseenter', function (event) {
      updateHoverLine(event)
    })
    .on('mousemove', function (event) {
      updateHoverLine(event)
    })
    .on('mouseleave', () => {
      hoverLine.style('opacity', 0)
      hoverLabel.style('opacity', 0)
    })
  interactionRect.lower()

  function updateHoverLine(event) {
    const [mouseX] = pointer(event, g.node())
    const clampedX = Math.max(0, Math.min(innerWidth, mouseX))
    const year = Math.min(yearMax, Math.max(yearMin, Math.round(xScale.invert(clampedX))))
    const xPos = xScale(year)
    hoverLine.attr('x1', xPos).attr('x2', xPos).style('opacity', 1)
    const bluefinMid = chartState.bluefinMidByYear.get(year)
    hoverLabel
      .attr('x', xPos)
      .text(`¥${Math.round(bluefinMid || 0).toLocaleString()}`)
      .style('opacity', Number.isFinite(bluefinMid) ? 1 : 0)
  }

  hoverLine.raise()
  hoverLabel.raise()

  if (lockedSeriesId.value) {
    setActiveSeries(lockedSeriesId.value)
  } else {
    clearActiveSeries()
  }
}

function nearestPointByYear(points, year) {
  if (!points.length) return null
  let nearest = points[0]
  for (const point of points) {
    if (Math.abs(point.year - year) < Math.abs(nearest.year - year)) nearest = point
  }
  return nearest
}

function setActiveSeries(seriesId) {
  if (!svg) return
  const root = select(svg.node().parentNode)
  const targetSeries = chartState?.series?.find((s) => s.id === seriesId)
  const targetItemName = targetSeries?.itemName
  root
    .selectAll('.series-line')
    .classed('is-active', (d) => (seriesId === 'bluefin_mid' ? d.itemName === 'Bluefin tuna' : d.id === seriesId))
    .classed(
      'is-inactive',
      (d) => (seriesId === 'bluefin_mid' ? d.itemName !== 'Bluefin tuna' : d.id !== seriesId),
    )
    .attr('stroke-opacity', (d) => {
      if (seriesId === 'bluefin_mid')
        return d.itemName === 'Bluefin tuna' ? 1 : inactiveStrokeOpacity.value
      return d.id === seriesId || d.itemName === targetItemName ? 1 : inactiveStrokeOpacity.value
    })
  root
    .selectAll('.legend-item')
    .classed('is-active', (_d, i, nodes) => nodes[i].getAttribute('data-series-id') === seriesId)
    .classed('is-inactive', (_d, i, nodes) => nodes[i].getAttribute('data-series-id') !== seriesId)
}

function clearActiveSeries() {
  if (!svg) return
  const root = select(svg.node().parentNode)
  root
    .selectAll('.series-line')
    .classed('is-active', false)
    .classed('is-inactive', false)
    .attr('stroke-opacity', (d) => d.defaultOpacity ?? 1)
  root.selectAll('.legend-item').classed('is-active', false).classed('is-inactive', false)
}

function lockSeries(seriesId) {
  lockedSeriesId.value = seriesId
  setActiveSeries(seriesId)
}

function onLegendClick(seriesId, event) {
  event.stopPropagation()
  lockSeries(seriesId)
}

function clearLockedSeries() {
  if (!lockedSeriesId.value) return
  lockedSeriesId.value = null
  clearActiveSeries()
}

function onDocumentPointerDown(event) {
  const wrap = wrapRef.value
  if (!wrap || !lockedSeriesId.value) return
  if (wrap.contains(event.target) && event.target.closest('.legend-item, [data-series-overlay="true"]')) {
    return
  }
  clearLockedSeries()
}

onMounted(() => {
  const host = hostRef.value
  if (!host) return

  svg = select(host).append('svg').attr('class', 'toyosu-prices-line-svg')
  drawChart()

  resizeObserver = new ResizeObserver(() => drawChart())
  resizeObserver.observe(host)
  document.addEventListener('pointerdown', onDocumentPointerDown)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  svg?.remove()
  svg = null
})
</script>

<template>
  <div ref="wrapRef" class="linechart-wrap">
    <aside class="legend" aria-label="Price series in chart">
      <ul class="legend-list">
        <li
          v-for="series in legendSeries"
          :key="series.id"
          class="legend-item"
          :data-series-id="series.id"
          @mouseenter="!lockedSeriesId && setActiveSeries(series.id)"
          @mouseleave="!lockedSeriesId && clearActiveSeries()"
          @click="onLegendClick(series.id, $event)"
        >
          <span
            class="swatch"
            :style="{
              '--swatch-color': series.color,
              '--swatch-dasharray': series.dasharray || 'none',
            }"
          />
          <span class="legend-label">{{ series.label }}</span>
        </li>
      </ul>
    </aside>
    <div ref="hostRef" class="d3-host" />
    <div ref="tooltipRef" class="tooltip" />
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

.linechart-wrap :deep(.series-line) {
  opacity: 1;
  transition: opacity 0.18s ease, stroke-width 0.18s ease;
}

.linechart-wrap :deep(.series-line.is-active) {
  opacity: 1;
  stroke-width: 3.2;
}

.linechart-wrap :deep(.series-line.is-inactive) {
  opacity: 1;
}

.linechart-wrap :deep(.series-line-overlay) {
  cursor: pointer;
}

.linechart-wrap :deep(.hover-line) {
  stroke: #334155;
  stroke-width: 1.2;
  stroke-dasharray: 4 4;
  pointer-events: none;
}

.linechart-wrap :deep(.hover-line-label) {
  fill: #0f172a;
  font-size: 0.7rem;
  font-weight: 600;
  pointer-events: none;
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
  width: 1rem;
  height: 0;
  border-top: 3px solid var(--swatch-color);
  border-top-style: solid;
  border-radius: 2px;
  background: transparent;
  border-image: none;
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
    top: 0.2rem;
  }
}
</style>

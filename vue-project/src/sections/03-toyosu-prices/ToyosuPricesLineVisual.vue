<script setup>
import { max, min } from 'd3-array'
import { axisBottom, axisLeft } from 'd3-axis'
import { csvParse } from 'd3-dsv'
import { line } from 'd3-shape'
import { scaleLinear } from 'd3-scale'
import { pointer, select } from 'd3-selection'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import csvRaw from '../../data/csv/toyosu_avg_all.csv?raw'
import { readStoryScale } from '../../utils/readStoryScale.js'

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

/** Space below the plot for the x-axis (matches TunaProductionStreamgraphVisual). */
const X_AXIS_BAND = 34
const Y_AXIS_LABEL = 'Price per kg (JPY)'
const Y_AXIS_TICK_PADDING = 10
const Y_AXIS_TICK_SIZE = 6

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
    label: 'Bluefin tuna - median price',
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

const LEGEND_SERIES_IDS = new Set(['bluefin_mid'])
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
  const width = host.clientWidth || 800
  const height = host.clientHeight || 520
  if (width < 20 || height < 20) return
  const storyScale = readStoryScale(wrapRef.value ?? host)
  const scalePx = (value) => value * storyScale
  const baseMargin = {
    top: scalePx(48),
    right: scalePx(34),
    bottom: scalePx(48),
    left: scalePx(84),
  }
  const innerH = height - baseMargin.top - baseMargin.bottom
  const xAxisBand = scalePx(X_AXIS_BAND)
  if (innerH < xAxisBand + scalePx(40)) return

  const chartHeight = innerH - xAxisBand

  const yearMin = min(chartState.years) ?? YEAR_START
  const yearMax = max(chartState.years) ?? YEAR_END
  const yMinDomain = Math.max(0, chartState.yMin * 0.92)
  const yMaxDomain = chartState.yMax * 1.08

  const yScaleForMeasure = scaleLinear().domain([yMinDomain, yMaxDomain]).range([chartHeight, 0])
  const yAxisForMeasure = () =>
    axisLeft(yScaleForMeasure)
      .ticks(7)
      .tickSizeInner(scalePx(Y_AXIS_TICK_SIZE))
      .tickPadding(scalePx(Y_AXIS_TICK_PADDING))
      .tickFormat((d) => Number(d).toLocaleString())

  svg.attr('width', width).attr('height', height)
  svg.selectAll('*').remove()

  const measureLayer = svg
    .append('g')
    .attr('class', 'axis-measure')
    .attr('visibility', 'hidden')
    .attr('aria-hidden', 'true')
  const measureYAxis = measureLayer
    .append('g')
    .attr('class', 'story-chart-axis axis axis-y')
    .call(yAxisForMeasure())
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
      .attr('class', 'story-chart-axis-label axis-label')
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
  const innerWidth = width - margin.left - margin.right
  if (innerWidth < 20) return

  const xScale = scaleLinear().domain([yearMin, yearMax]).range([0, innerWidth])
  const yScale = scaleLinear().domain([yMinDomain, yMaxDomain]).range([chartHeight, 0])
  const yAxisDraw = () =>
    axisLeft(yScale)
      .ticks(7)
      .tickSizeInner(scalePx(Y_AXIS_TICK_SIZE))
      .tickPadding(scalePx(Y_AXIS_TICK_PADDING))
      .tickFormat((d) => Number(d).toLocaleString())

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)
  const gPlot = g.append('g').attr('class', 'panel-top')
  const gAxisX = g.append('g').attr('class', 'story-chart-axis axis axis-x')

  const lineGen = line()
    .x((d) => xScale(d.year))
    .y((d) => yScale(d.value))

  const lineEndY = chartHeight
  const hoverLabelY = scalePx(12)
  const hoverLineStartY = hoverLabelY + scalePx(6)

  const hoverLine = g
    .append('line')
    .attr('class', 'hover-line')
    .attr('x1', 0)
    .attr('x2', 0)
    .attr('y1', hoverLineStartY)
    .attr('y2', lineEndY)
    .style('opacity', 0)

  const hoverLabel = g
    .append('text')
    .attr('class', 'hover-line-label')
    .attr('text-anchor', 'middle')
    .attr('x', 0)
    .attr('y', hoverLabelY)
    .style('opacity', 0)

  gAxisX.attr('transform', `translate(0,${chartHeight})`).call(
    axisBottom(xScale)
      .tickValues(chartState.years)
      .tickFormat((d) => `${Math.round(Number(d))}`),
  )

  gPlot.append('g').attr('class', 'story-chart-axis axis axis-y').call(yAxisDraw())

  gPlot
    .append('text')
    .attr('class', 'story-chart-axis-label axis-label')
    .attr('text-anchor', 'middle')
    .attr(
      'transform',
      `translate(${labelCenterFromLeftEdge - margin.left}, ${chartHeight / 2}) rotate(-90)`,
    )
    .attr('dominant-baseline', 'middle')
    .attr('fill', '#334155')
    .text(Y_AXIS_LABEL)

  const seriesGroups = gPlot
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
    .attr('stroke-width', (d) => scalePx(d.strokeWidth || 2))
    .attr('stroke-opacity', (d) => d.defaultOpacity ?? 1)

  const tooltipEl = tooltipRef.value
  seriesGroups
    .append('path')
    .attr('class', 'series-line-overlay')
    .attr('data-series-overlay', 'true')
    .attr('data-series-id', (d) => d.id)
    .attr('d', (d) => lineGen(d.points))
    .attr('stroke', 'transparent')
    .attr('stroke-width', scalePx(12))
    .attr('fill', 'none')
    .attr('pointer-events', 'stroke')
    .on('mouseenter', function (event, d) {
      if (!lockedSeriesId.value) setActiveSeries(d.id)
      updateHoverLine(event)
      if (!tooltipEl) return
      tooltipEl.style.opacity = '1'
      tooltipEl.textContent = d.itemName
      tooltipEl.style.left = `${event.offsetX + scalePx(12)}px`
      tooltipEl.style.top = `${event.offsetY + scalePx(12)}px`
    })
    .on('mousemove', function (event, d) {
      if (!lockedSeriesId.value) setActiveSeries(d.id)
      updateHoverLine(event)
      if (!tooltipEl) return
      tooltipEl.textContent = d.itemName
      tooltipEl.style.left = `${event.offsetX + scalePx(12)}px`
      tooltipEl.style.top = `${event.offsetY + scalePx(12)}px`
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
    .attr('height', chartHeight)
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
      .text(`Bluefin: ${Math.round(bluefinMid || 0).toLocaleString()}/kg in ${year}`)
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
    <h1 class="visual-title linechart-title">Toyosu Tuna Prices</h1>
    <div class="chart-plot-layer">
      <div ref="hostRef" class="d3-host" />
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
    </div>
    <div ref="tooltipRef" class="tooltip" />
  </div>
</template>

<style scoped>
.linechart-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: var(--viz-chart-wrap-height);
  max-height: var(--viz-chart-wrap-max-height);
  overflow: hidden;
  font-family: var(--font-ui);
  font-weight: var(--font-weight-ui);
}

.linechart-title {
  flex-shrink: 0;
  margin-bottom: var(--space-visual-title-gap);
}

.chart-plot-layer {
  position: relative;
  flex: 1;
  min-height: 0;
  width: 100%;
  height: 100%;
}

.legend {
  position: absolute;
  right: var(--viz-chart-margin-right);
  bottom: calc(
    var(--viz-chart-margin-bottom) + var(--viz-x-axis-band) + var(--viz-legend-above-axis-gap)
  );
  z-index: 7;
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
  font-size: var(--font-size-ui);
  font-family: inherit;
  line-height: var(--viz-legend-line-height);
  color: #0f172a;
  cursor: pointer;
  transition: opacity 0.18s ease;
  margin: 0;
}

.legend-item.is-active {
  opacity: 1;
  font-weight: var(--font-weight-ui);
}

.legend-item.is-inactive {
  opacity: 0.32;
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

.linechart-wrap :deep(.series-line) {
  opacity: 1;
  transition: opacity 0.18s ease, stroke-width 0.18s ease;
}

.linechart-wrap :deep(.series-line.is-active) {
  opacity: 1;
  stroke-width: calc(3.2px * var(--story-scale));
}

.linechart-wrap :deep(.series-line.is-inactive) {
  opacity: 1;
}

.linechart-wrap :deep(.series-line-overlay) {
  cursor: pointer;
}

.linechart-wrap :deep(.hover-line) {
  stroke: #334155;
  stroke-width: calc(2px * var(--story-scale));
  stroke-dasharray: 6 4;
  pointer-events: none;
}

.linechart-wrap :deep(.hover-line-label) {
  fill: #0f172a;
  font-size: var(--font-size-ui);
  font-family: var(--font-ui);
  font-weight: var(--font-weight-ui);
  pointer-events: none;
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

.legend-label {
  white-space: nowrap;
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
  font-family: var(--font-ui);
  font-weight: var(--font-weight-copy);
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

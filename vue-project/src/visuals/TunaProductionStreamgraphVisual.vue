<script setup>
import { rollup, sum } from 'd3-array'
import { axisBottom, axisLeft } from 'd3-axis'
import { csvParse } from 'd3-dsv'
import { format as d3Format } from 'd3-format'
import { scaleLinear } from 'd3-scale'
import { pointer, select } from 'd3-selection'
import { area, curveMonotoneX, stack } from 'd3-shape'
import 'd3-transition'
import { onMounted, onUnmounted, nextTick, ref } from 'vue'
import aquaCsvRaw from '../data/bluefin_aquaculture.csv?raw'
import csvRaw from '../data/GTA_FIRMs_tuna_cleaned_countries.csv?raw'
import { readColorDefaultBlue, readColorTunaFarmed } from '../utils/readStoryColors.js'

const compactNumber = d3Format('~s')
function formatTickShort(d) {
  const n = Number(d)
  if (!Number.isFinite(n)) return ''
  if (Math.abs(n) < 1000) return compactNumber(n)
  return compactNumber(n).replace('G', 'B')
}

const hostRef = ref(null)
const wrapRef = ref(null)
const tooltipRef = ref(null)

let svg
let resizeObserver
let intersectionObserver

const YEAR_START = 1965
const YEAR_END = 2022
const TARGET_SPECIES = new Set(['SBF', 'BFT', 'PBF'])

const SERIES_KEYS = ['CAPTURE', 'MARINE']
const SERIES_LABELS = {
  CAPTURE: 'Wild capture',
  MARINE: 'Farmed',
}

/** Space below the stream panel for the x-axis (aligns with stacked-bar tick / margin rhythm). */
const X_AXIS_BAND = 34
/** Fixed y-scale (tonnes), matched with TunaStackedBarsVisual. */
const Y_AXIS_MAX = 120_000

function parseAquacultureRowsForYears(years) {
  const rows = csvParse(aquaCsvRaw, (d) => ({
    year: Number(d.year),
    productionType: d.production_type?.trim(),
    value: Number(d.measurement_value),
  })).filter(
    (d) =>
      Number.isFinite(d.year) &&
      Number.isFinite(d.value) &&
      d.productionType &&
      SERIES_KEYS.includes(d.productionType) &&
      d.year >= YEAR_START && d.year <= YEAR_END,
  )

  const byYear = rollup(
    rows,
    (values) => sum(values, (d) => d.value),
    (d) => d.year,
    (d) => d.productionType,
  )

  return years.map((year) => {
    const yearMap = byYear.get(year)
    const entry = { year }
    for (const key of SERIES_KEYS) {
      entry[key] = yearMap?.get(key) ?? 0
    }
    return entry
  })
}

function parseCountryTotalsForYears(years) {
  const rows = csvParse(csvRaw, (d) => ({
    year: Number(d.year),
    species: d.species?.trim(),
    value: Number(d.measurement_value),
  }))
    .filter((d) => Number.isFinite(d.year) && Number.isFinite(d.value) && d.species)
    .filter((d) => TARGET_SPECIES.has(d.species))
    .filter((d) => d.year >= YEAR_START && d.year <= YEAR_END)

  const byYear = rollup(
    rows,
    (values) => sum(values, (d) => d.value),
    (d) => d.year,
  )

  return years.map((year) => ({
    year,
    total: byYear.get(year) ?? 0,
  }))
}

function drawChart() {
  if (!hostRef.value || !svg) return

  const years = []
  for (let y = YEAR_START; y <= YEAR_END; y++) years.push(y)
  const stackRowsAqua = parseAquacultureRowsForYears(years)
  const countryTotals = parseCountryTotalsForYears(years)
  if (!years.length || !stackRowsAqua.length || !countryTotals.length) return
  const totalsByYear = new Map(countryTotals.map((d) => [d.year, d.total]))

  const streamRows = stackRowsAqua.map((row) => {
    const totalCatch = totalsByYear.get(row.year) ?? 0
    const cap = row.CAPTURE || 0
    const mar = row.MARINE || 0
    const aquaTotal = cap + mar
    if (aquaTotal <= 0 || totalCatch <= 0) {
      return { year: row.year, CAPTURE: totalCatch, MARINE: 0 }
    }
    const wildShare = cap / aquaTotal
    const farmShare = mar / aquaTotal
    return {
      year: row.year,
      CAPTURE: totalCatch * wildShare,
      MARINE: totalCatch * farmShare,
    }
  })

  const host = hostRef.value
  const width = host.clientWidth || 800
  const height = host.clientHeight || 520
  if (width < 20 || height < 20) return
  const margin = { top: 48, right: 34, bottom: 48, left: 84 }
  const innerWidth = width - margin.left - margin.right
  const innerH = height - margin.top - margin.bottom
  if (innerWidth < 20 || innerH < X_AXIS_BAND + 40) return

  /** Stream area only; x-axis sits at y = chartHeight (matches innerH − band, same pattern as TunaStackedBarsVisual inner plot). */
  const chartHeight = innerH - X_AXIS_BAND

  svg.attr('width', width).attr('height', height)
  svg.selectAll('*').remove()

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)
  const gTop = g.append('g').attr('class', 'panel-top')
  const gAxisX = g.append('g').attr('class', 'axis axis-x')



  const xScale = scaleLinear().domain([YEAR_START, YEAR_END]).range([0, innerWidth])
  const aquaStackGen = stack().keys(SERIES_KEYS)
  const aquaLayers = aquaStackGen(streamRows)
  const yScaleTop = scaleLinear().domain([0, Y_AXIS_MAX]).range([chartHeight, 0])
  const getAquaFill = (key) => (key === 'CAPTURE' ? readColorDefaultBlue() : readColorTunaFarmed())

  const areaTop = area()
    .curve(curveMonotoneX)
    .x((point) => xScale(point.data.year))
    .y0((point) => yScaleTop(point[0]))
    .y1((point) => yScaleTop(point[1]))

  const lineEndY = chartHeight
  const hoverLabelY = 12
  const hoverLineStartY = hoverLabelY + 6

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

  const tooltipEl = tooltipRef.value

  function hideTooltip() {
    if (!tooltipEl) return
    tooltipEl.style.opacity = '0'
  }

  function hideHoverLine() {
    hoverLine.style('opacity', 0)
    hoverLabel.style('opacity', 0)
  }

  function clampYearFromEvent(event) {
    const [mouseX] = pointer(event, g.node())
    const domainYear = Math.round(xScale.invert(mouseX))
    return Math.min(Math.max(domainYear, YEAR_START), YEAR_END)
  }

  function updateHoverLine(event) {
    const clampedYear = clampYearFromEvent(event)
    const xPos = xScale(clampedYear)
    const selected = streamRows.find((d) => d.year === clampedYear)
    if (!selected) return
    const total = SERIES_KEYS.reduce((acc, key) => acc + (selected[key] || 0), 0)

    hoverLine.attr('x1', xPos).attr('x2', xPos).style('opacity', 1)
    hoverLabel
      .attr('x', xPos)
      .text(`Total ${total.toLocaleString(undefined, { maximumFractionDigits: 0 })} tonnes`)
      .style('opacity', 1)
  }

  function updateTooltipTop(event, series) {
    if (!tooltipEl) return
    const clampedYear = clampYearFromEvent(event)
    const selected = streamRows.find((d) => d.year === clampedYear)
    if (!selected) return

    const tonnes = selected[series.key] || 0
    const totalA = SERIES_KEYS.reduce((acc, key) => acc + (selected[key] || 0), 0)
    const pct = totalA > 0 ? (tonnes / totalA) * 100 : 0
    const label = SERIES_LABELS[series.key] || series.key
    tooltipEl.innerHTML = `<div class="country">${label}</div><div>${clampedYear}: ${pct.toFixed(1)}% (${tonnes.toLocaleString(undefined, { maximumFractionDigits: 0 })} tonnes)</div>`
    tooltipEl.style.opacity = '1'
    tooltipEl.style.left = `${event.offsetX + 14}px`
    tooltipEl.style.top = `${event.offsetY + 14}px`
  }

  gTop
    .append('g')
    .attr('class', 'streams-shell-top')
    .selectAll('.stream.stream-top')
    .data(aquaLayers)
    .join('path')
    .attr('class', 'stream stream-top')
    .attr('d', areaTop)
    .attr('fill', (d) => getAquaFill(d.key))
    .on('mouseenter', function (event, series) {
      gTop.selectAll('.stream-top').classed('inactive', (d) => d.key !== series.key)
      updateTooltipTop(event, series)
      updateHoverLine(event)
    })
    .on('mousemove', function (event, series) {
      updateTooltipTop(event, series)
      updateHoverLine(event)
    })
    .on('mouseleave', () => {
      gTop.selectAll('.stream-top').classed('inactive', false)
      hideTooltip()
      hideHoverLine()
    })

  gAxisX.attr('transform', `translate(0,${chartHeight})`).call(
    axisBottom(xScale).tickFormat((d) => Number(d).toString()),
  )

  gTop.append('g').attr('class', 'axis axis-y').call(
    axisLeft(yScaleTop)
      .ticks(4)
      .tickPadding(10)
      .tickFormat(formatTickShort),
  )

  gTop
    .append('text')
    .attr('class', 'axis-label')
    .attr('text-anchor', 'middle')
    .attr('transform', 'rotate(-90)')
    .attr('y', -54)
    .attr('x', -chartHeight / 2)
    .attr('dy', '.32em')
    .attr('fill', '#334155')
    .text('Catch (tonnes)')

  hoverLine.raise()
  hoverLabel.raise()
}

onMounted(() => {
  const host = hostRef.value
  if (!host) return

  svg = select(host).append('svg').attr('class', 'tuna-production-streamgraph-svg')
  drawChart()

  resizeObserver = new ResizeObserver(() => drawChart())
  resizeObserver.observe(host)

  nextTick(() => {
    const wrap = wrapRef.value
    if (!wrap || typeof IntersectionObserver === 'undefined') {
      return
    }

    intersectionObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return
        if (!entry.isIntersecting && tooltipRef.value) tooltipRef.value.style.opacity = '0'
      },
      {
        root: null,
        rootMargin: '0px',
        threshold: [0, 0.12, 0.45, 0.7, 1],
      },
    )
    intersectionObserver.observe(wrap)
  })
})

onUnmounted(() => {
  intersectionObserver?.disconnect()
  intersectionObserver = undefined
  resizeObserver?.disconnect()
  resizeObserver = null
  svg?.remove()
  svg = null
})
</script>

<template>
  <div ref="wrapRef" class="streamgraph-wrap">
    <h1 class="visual-title streamgraph-title">Bluefin Tuna: Wild Capture vs Farmed</h1>
    <div class="chart-plot-layer">
      <div ref="hostRef" class="d3-host" />
      <aside class="legend" role="note" aria-label="Production type color key">
        <ul class="legend-list">
          <li class="legend-item">
            <span class="swatch swatch-wild" />
            <span class="legend-label">Wild capture</span>
          </li>
          <li class="legend-item">
            <span class="swatch swatch-farmed" />
            <span class="legend-label">Farmed</span>
          </li>
        </ul>
      </aside>
    </div>
    <div ref="tooltipRef" class="tooltip" />
  </div>
</template>

<style scoped>
.streamgraph-wrap {
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

.streamgraph-title {
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
  max-width: min(280px, 46vw);
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
  cursor: default;
  transition: opacity 0.18s ease;
  margin: 0;
}

.swatch {
  width: 1rem;
  height: 0.48rem;
  border-radius: 2px;
  background: #94a3b8;
  flex-shrink: 0;
}

.swatch-wild {
  background: var(--color-default-blue);
}

.swatch-farmed {
  background: var(--color-tuna-farmed);
}

.legend-label {
  white-space: nowrap;
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

.streamgraph-wrap :deep(.axis text) {
  fill: #475569;
  font-size: var(--font-size-axis-tick);
  font-family: var(--font-family-axis-tick);
  font-weight: var(--font-weight-axis-tick);
}

.streamgraph-wrap :deep(.axis-label) {
  font-size: var(--font-size-axis-title);
  font-family: var(--font-family-axis-title);
  font-weight: var(--font-weight-axis-title);
}

.streamgraph-wrap :deep(.axis path),
.streamgraph-wrap :deep(.axis line) {
  stroke: #94a3b8;
}

.streamgraph-wrap :deep(.axis) {
  pointer-events: none;
}

.streamgraph-wrap :deep(.stream) {
  fill-opacity: 0.88;
  transition: fill-opacity 0.2s ease;
  cursor: pointer;
}

.streamgraph-wrap :deep(.stream:hover) {
  fill-opacity: 0.98;
}

.streamgraph-wrap :deep(.stream.inactive) {
  fill-opacity: 0.12;
}

.streamgraph-wrap :deep(.hover-line) {
  stroke: #334155;
  stroke-width: 2;
  stroke-dasharray: 6 4;
  pointer-events: none;
}

.streamgraph-wrap :deep(.hover-line-label) {
  fill: #0f172a;
  font-size: var(--font-size-ui);
  font-family: var(--font-ui);
  font-weight: var(--font-weight-ui);
  pointer-events: none;
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
  font-family: var(--font-ui);
  font-weight: var(--font-weight-copy);
}

.tooltip :deep(.country) {
  font-weight: 700;
}

.tooltip :deep(.tooltip-note) {
  margin-top: 0.35rem;
  padding-top: 0.35rem;
  border-top: 1px solid rgba(248, 250, 252, 0.2);
  font-size: 0.7rem;
  color: #cbd5e1;
}

@media (max-width: 900px) {
  .legend {
    max-width: min(220px, 56vw);
  }
}

@media (max-width: 640px) {
  /* Static flow under chart; box style still matches shared tokens */
  .legend {
    position: static;
    margin-top: 0.55rem;
    margin-left: auto;
    max-width: 100%;
  }
}
</style>

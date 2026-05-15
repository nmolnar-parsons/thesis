<script setup>
import { rollup, sum } from 'd3-array'
import { axisBottom, axisLeft } from 'd3-axis'
import { csvParse } from 'd3-dsv'
import { format as d3Format } from 'd3-format'
import { scaleLinear } from 'd3-scale'
import { pointer, select } from 'd3-selection'
import { area, curveMonotoneX, stack } from 'd3-shape'
import 'd3-transition'
import { onMounted, onUnmounted, nextTick, ref, watch } from 'vue'
import aquaCsvRaw from '../../data/csv/bluefin_aquaculture.csv?raw'
import csvRaw from '../../data/csv/GTA_FIRMs_tuna_cleaned_countries.csv?raw'
import { readColorDefaultBlue, readColorTunaFarmed } from '../../utils/readStoryColors.js'
import { readStoryScale } from '../../utils/readStoryScale.js'
import { BLUEFIN_YEAR_AXIS_TICKS, formatYearTick } from '../shared/chartAxisConfig.js'
import {
  CONTINENT_ORDER,
  continentLegendSwatch,
  getContinent,
  getCountryColor,
  normalizeCountry,
} from '../shared/countryContinentColors.js'

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
/** `'aqua'` = wild/farmed split (default); `'countries'` = stacked by country + Unreported */
const viewMode = ref('aqua')
/** Continent legend hover highlights matching streams (`null` = none). */
const activeLegendContinent = ref(null)
/** Stream under pointer takes precedence over legend highlight. */
const activeStreamKey = ref(null)
/** Built in `drawChart` for countries mode: `{ continent, countries }[]` in display order. */
const countryLegendGroups = ref([])

const UNREPORTED_LABEL = 'Unreported'

const continentRank = new Map(CONTINENT_ORDER.map((c, i) => [c, i]))

function syncStreamHighlightClasses() {
  const host = hostRef.value
  if (!host) return
  const streamKey = activeStreamKey.value
  const cont = activeLegendContinent.value
  host.querySelectorAll('.stream-top').forEach((el) => {
    const key = el.getAttribute('data-country')
    const c = el.getAttribute('data-continent')
    let inactive = false
    if (streamKey != null && streamKey !== '') inactive = key !== streamKey
    else if (cont != null) inactive = c !== cont
    el.classList.toggle('inactive', inactive)
  })
}

watch([activeLegendContinent, activeStreamKey], () => {
  nextTick(() => syncStreamHighlightClasses())
})

function setLegendContinentHighlight(continent) {
  activeLegendContinent.value = continent
}

function clearLegendContinentHighlight() {
  activeLegendContinent.value = null
}

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
const Y_AXIS_LABEL = 'Global Bluefin Catch (tonnes)'
const Y_AXIS_TICK_PADDING = 10
const Y_AXIS_TICK_SIZE = 6

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

/**
 * Per-year rows for d3.stack: one numeric column per country label (blank CSV country → Unreported).
 * Keys: **Unreported** first (bottom of stack), then others by continent (CONTINENT_ORDER), descending
 * total tonnage within continent, then name.
 */
function parseCountryByYearForStack(years) {
  const rows = csvParse(csvRaw, (d) => ({
    year: Number(d.year),
    species: d.species?.trim(),
    value: Number(d.measurement_value),
    countryRaw: d.country,
  }))
    .filter((d) => Number.isFinite(d.year) && Number.isFinite(d.value) && d.species)
    .filter((d) => TARGET_SPECIES.has(d.species))
    .filter((d) => d.year >= YEAR_START && d.year <= YEAR_END)

  const labeled = rows.map((d) => {
    const trimmed = d.countryRaw?.trim()
    const label = trimmed ? normalizeCountry(trimmed) : UNREPORTED_LABEL
    return { year: d.year, label, value: d.value }
  })

  const byYearLabel = rollup(
    labeled,
    (values) => sum(values, (x) => x.value),
    (d) => d.year,
    (d) => d.label,
  )

  const sumsByLabel = new Map()
  for (const year of years) {
    const yearMap = byYearLabel.get(year)
    if (!yearMap) continue
    for (const [label, v] of yearMap) {
      sumsByLabel.set(label, (sumsByLabel.get(label) ?? 0) + v)
    }
  }

  const keys = [...sumsByLabel.keys()]
  keys.sort((a, b) => {
    const ca = getContinent(a)
    const cb = getContinent(b)
    const ra = continentRank.get(ca) ?? 99
    const rb = continentRank.get(cb) ?? 99
    if (ra !== rb) return ra - rb
    const da = sumsByLabel.get(a) ?? 0
    const db = sumsByLabel.get(b) ?? 0
    if (db !== da) return db - da
    return a.localeCompare(b, 'en')
  })
  const rest = keys.filter((k) => k !== UNREPORTED_LABEL)
  const countryKeys = keys.includes(UNREPORTED_LABEL)
    ? [UNREPORTED_LABEL, ...rest]
    : keys

  const legendContinents = []
  for (const continent of CONTINENT_ORDER) {
    if (continent === 'Other') continue
    const countries = countryKeys.filter((k) => getContinent(k) === continent)
    if (countries.length) legendContinents.push({ continent, countries })
  }

  const stackRows = years.map((year) => {
    const yearMap = byYearLabel.get(year)
    const row = { year }
    for (const key of countryKeys) {
      row[key] = yearMap?.get(key) ?? 0
    }
    return row
  })

  return { stackRows, countryKeys, legendContinents }
}

function drawChart() {
  if (!hostRef.value || !svg) return

  const years = []
  for (let y = YEAR_START; y <= YEAR_END; y++) years.push(y)
  if (!years.length) return

  const useCountryView = viewMode.value === 'countries'

  let streamRows
  let stackKeys
  let legendContinentsForTemplate = []

  if (useCountryView) {
    const { stackRows: countryRows, countryKeys, legendContinents } = parseCountryByYearForStack(years)
    if (!countryRows.length || !countryKeys.length) return
    streamRows = countryRows
    stackKeys = countryKeys
    legendContinentsForTemplate = legendContinents
  } else {
    const stackRowsAqua = parseAquacultureRowsForYears(years)
    const countryTotals = parseCountryTotalsForYears(years)
    if (!stackRowsAqua.length || !countryTotals.length) return
    const totalsByYear = new Map(countryTotals.map((d) => [d.year, d.total]))

    streamRows = stackRowsAqua.map((row) => {
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
    stackKeys = SERIES_KEYS
  }

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

  /** Stream area only; x-axis sits at y = chartHeight (matches innerH − band, same pattern as TunaStackedBarsVisual inner plot). */
  const chartHeight = innerH - xAxisBand

  svg.attr('width', width).attr('height', height)
  svg.selectAll('*').remove()

  const yScaleTop = scaleLinear().domain([0, Y_AXIS_MAX]).range([chartHeight, 0])
  const yAxisTop = () =>
    axisLeft(yScaleTop)
      .ticks(4)
      .tickSizeInner(scalePx(Y_AXIS_TICK_SIZE))
      .tickPadding(scalePx(Y_AXIS_TICK_PADDING))
      .tickFormat(formatTickShort)

  const measureLayer = svg
    .append('g')
    .attr('class', 'axis-measure')
    .attr('visibility', 'hidden')
    .attr('aria-hidden', 'true')
  const measureYAxis = measureLayer
    .append('g')
    .attr('class', 'story-chart-axis axis axis-y')
    .call(yAxisTop())
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

  if (wrapRef.value) {
    wrapRef.value.style.setProperty('--streamgraph-chart-margin-left', `${margin.left}px`)
  }

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)
  const gTop = g.append('g').attr('class', 'panel-top')
  const gAxisX = g.append('g').attr('class', 'story-chart-axis axis axis-x')

  const xScale = scaleLinear().domain([YEAR_START, YEAR_END]).range([0, innerWidth])
  const layers = stack().keys(stackKeys)(streamRows)
  const getAquaFill = (key) => (key === 'CAPTURE' ? readColorDefaultBlue() : readColorTunaFarmed())
  const getStreamFill = (key) => (useCountryView ? getCountryColor(key) : getAquaFill(key))

  const areaTop = area()
    .curve(curveMonotoneX)
    .x((point) => xScale(point.data.year))
    .y0((point) => yScaleTop(point[0]))
    .y1((point) => yScaleTop(point[1]))

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
    const total = stackKeys.reduce((acc, key) => acc + (selected[key] || 0), 0)

    hoverLine.attr('x1', xPos).attr('x2', xPos).style('opacity', 1)
    hoverLabel
      .attr('x', xPos)
      .text(`Total ${total.toLocaleString(undefined, { maximumFractionDigits: 0 })} tonnes`)
      .style('opacity', 1)
  }

  function updateTooltipAqua(event, series) {
    if (!tooltipEl) return
    const clampedYear = clampYearFromEvent(event)
    const selected = streamRows.find((d) => d.year === clampedYear)
    if (!selected) return

    const tonnes = selected[series.key] || 0
    const totalA = stackKeys.reduce((acc, key) => acc + (selected[key] || 0), 0)
    const pct = totalA > 0 ? (tonnes / totalA) * 100 : 0
    const label = SERIES_LABELS[series.key] || series.key
    tooltipEl.innerHTML = `<div class="country">${label}</div><div>${clampedYear}: ${pct.toFixed(1)}% (${tonnes.toLocaleString(undefined, { maximumFractionDigits: 0 })} tonnes)</div>`
    tooltipEl.style.opacity = '1'
    tooltipEl.style.left = `${event.offsetX + scalePx(14)}px`
    tooltipEl.style.top = `${event.offsetY + scalePx(14)}px`
  }

  function updateTooltipCountry(event, series) {
    if (!tooltipEl) return
    const clampedYear = clampYearFromEvent(event)
    const selected = streamRows.find((d) => d.year === clampedYear)
    if (!selected) return
    const tonnes = selected[series.key] || 0
    const name = series.key
    tooltipEl.innerHTML = `<div class="country">${name}</div><div>${clampedYear}: ${tonnes.toLocaleString(undefined, { maximumFractionDigits: 0 })} tonnes</div>`
    tooltipEl.style.opacity = '1'
    tooltipEl.style.left = `${event.offsetX + scalePx(14)}px`
    tooltipEl.style.top = `${event.offsetY + scalePx(14)}px`
  }

  function updateTooltipStream(event, series) {
    if (useCountryView) updateTooltipCountry(event, series)
    else updateTooltipAqua(event, series)
  }

  gTop
    .append('g')
    .attr('class', 'streams-shell-top')
    .selectAll('.stream.stream-top')
    .data(layers)
    .join('path')
    .attr('class', 'stream stream-top')
    .attr('data-country', (d) => d.key)
    .attr('data-continent', (d) => getContinent(d.key))
    .attr('d', areaTop)
    .attr('fill', (d) => getStreamFill(d.key))
    .on('mouseenter', function (event, series) {
      activeStreamKey.value = series.key
      syncStreamHighlightClasses()
      updateTooltipStream(event, series)
      updateHoverLine(event)
    })
    .on('mousemove', function (event, series) {
      updateTooltipStream(event, series)
      updateHoverLine(event)
    })
    .on('mouseleave', () => {
      activeStreamKey.value = null
      syncStreamHighlightClasses()
      hideTooltip()
      hideHoverLine()
    })

  gAxisX.attr('transform', `translate(0,${chartHeight})`).call(
    axisBottom(xScale).tickValues(BLUEFIN_YEAR_AXIS_TICKS).tickFormat(formatYearTick),
  )

  gTop.append('g').attr('class', 'story-chart-axis axis axis-y').call(yAxisTop())

  gTop
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

  hoverLine.raise()
  hoverLabel.raise()

  countryLegendGroups.value = legendContinentsForTemplate

  nextTick(() => syncStreamHighlightClasses())
}

watch(viewMode, () => {
  activeLegendContinent.value = null
  activeStreamKey.value = null
  nextTick(() => drawChart())
})

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
    <h1 class="visual-title streamgraph-title">Your Bluefin is Farmed</h1>
    <div
      class="view-toggle"
      role="group"
      aria-label="Chart view"
      :style="{ paddingLeft: 'var(--streamgraph-chart-margin-left, 84px)' }"
    >
      <button
        type="button"
        class="view-toggle-btn"
        :aria-pressed="viewMode === 'aqua'"
        @click="viewMode = 'aqua'"
      >
        Aquaculture
      </button>
      <button
        type="button"
        class="view-toggle-btn"
        :aria-pressed="viewMode === 'countries'"
        @click="viewMode = 'countries'"
      >
        Countries
      </button>
    </div>
    <div class="chart-plot-layer">
      <div ref="hostRef" class="d3-host" />
      <aside
        v-show="viewMode === 'aqua'"
        class="legend"
        role="note"
        aria-label="Production type color key"
      >
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
      <aside
        v-show="viewMode === 'countries'"
        class="legend legend--continents"
        role="list"
        aria-label="Catch by continent"
      >
        <div
          v-for="group in countryLegendGroups"
          :key="group.continent"
          class="legend-continent-block"
          :class="{ 'legend-continent-block--active': activeLegendContinent === group.continent }"
          role="listitem"
          @mouseenter="setLegendContinentHighlight(group.continent)"
          @mouseleave="clearLegendContinentHighlight()"
        >
          <div class="legend-continent-header">
            <span
              class="swatch swatch-continent"
              :style="{ background: continentLegendSwatch(group.continent) }"
            />
            <span class="legend-label">{{ group.continent }}</span>
          </div>
        </div>
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

.view-toggle {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 0.5rem;
  flex-shrink: 0;
}

.view-toggle-btn {
  font-family: var(--font-ui);
  font-size: var(--font-size-ui);
  font-weight: var(--font-weight-ui);
  padding: 0.35rem 0.65rem;
  border: 1px solid #cbd5e1;
  border-radius: 0;
  background: #f8fafc;
  color: #0f172a;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.view-toggle-btn:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
}

.view-toggle-btn[aria-pressed='true'] {
  background: #0f172a;
  border-color: #0f172a;
  color: #f8fafc;
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

.legend.legend--continents {
  left: auto;
  right: var(--viz-chart-margin-right);
  width: max-content;
  max-width: calc(100% - var(--streamgraph-chart-margin-left, 84px) - var(--viz-chart-margin-right));
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-start;
  gap: 0.65rem 1rem;
  padding: 0.45rem 0.65rem;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
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

.legend-continent-block {
  cursor: pointer;
  border-radius: 2px;
  padding: 0.12rem 0.35rem;
  margin: 0;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, opacity 0.15s ease;
}

.legend-continent-block:hover,
.legend-continent-block--active {
  background: rgba(15, 23, 42, 0.06);
}

.legend-continent-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  justify-content: center;
  font-size: var(--font-size-ui);
  line-height: var(--viz-legend-line-height);
  color: #0f172a;
}

.swatch-continent {
  width: 1rem;
  height: 0.48rem;
  border-radius: 2px;
  flex-shrink: 0;
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
  stroke-width: calc(2px * var(--story-scale));
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

  .legend.legend--continents {
    max-width: calc(100% - var(--streamgraph-chart-margin-left, 84px) - var(--viz-chart-margin-right));
    left: auto;
    right: var(--viz-chart-margin-right);
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

  .legend.legend--continents {
    margin-left: auto;
    margin-right: 0;
    max-width: 100%;
    width: max-content;
  }
}
</style>

<script setup>
import { max, rollup, sum } from 'd3-array'
import { axisBottom, axisLeft } from 'd3-axis'
import { csvParse } from 'd3-dsv'
import { easeCubicOut } from 'd3-ease'
import { format as d3Format } from 'd3-format'
import { scaleLinear } from 'd3-scale'
import { pointer, select } from 'd3-selection'
import { area, stack, stackOffsetExpand } from 'd3-shape'
import 'd3-transition'
import { onMounted, onUnmounted, nextTick, ref, watch } from 'vue'
import csvRaw from '../data/GTA_FIRMs_tuna_cleaned_countries.csv?raw'
import aquaCsvRaw from '../data/bluefin_aquaculture.csv?raw'
import {
  CONTINENT_ORDER,
  continentLegendSwatch,
  getContinent,
  getCountryColor as stableCountryColor,
} from './countryContinentColors.js'

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
/** When set, catch panel dims countries not in this continent (toggle same chip to clear). */
const legendContinent = ref(null)

let svg
let resizeObserver
let intersectionObserver

/** Rough vertical visibility of wrap (overlap height / bounding height); mirrors IO ratio for tall blocks in full-width layouts. */
function wrapIntersectionRatioApprox() {
  const wrap = wrapRef.value
  if (!wrap) return 0
  const rect = wrap.getBoundingClientRect()
  const vh = window.innerHeight || 1
  if (rect.height <= 1) return 0
  const topClamp = Math.max(0, rect.top)
  const bottomClamp = Math.min(vh, rect.bottom)
  const overlapPx = Math.max(0, bottomClamp - topClamp)
  return overlapPx / rect.height
}

/** One-shot left-to-right fill has finished; redraw omits clipping. */
let streamsRevealDone = false
/** Guard duplicate starts from IO vs resize probing. */
let revealInProgress = false

let lastRevealInnerWidth = 0
let countryTotals = new Map()

/** Per-panel defs ids; rects live at (0,0) inside each clipped shell so coords match `.stream` path space. */
const STREAM_CLIP_PANEL_TOP = 'tuna-stream-clip-panel-top'
const STREAM_CLIP_PANEL_BOTTOM = 'tuna-stream-clip-panel-bottom'
const STREAM_REVEAL_MS = 1150
const REVEAL_START_INTERSECTION = 1 / 3

function maybeStartStreamReveal(ioEntryMaybe) {
  if (!svg || streamsRevealDone || revealInProgress) return
  const innerWidthPx = lastRevealInnerWidth
  if (innerWidthPx < 20) return

  let ratio
  if (ioEntryMaybe) {
    if (!ioEntryMaybe.isIntersecting) return
    ratio = ioEntryMaybe.intersectionRatio
  } else {
    ratio = wrapIntersectionRatioApprox()
  }

  if (ratio + 1e-5 < REVEAL_START_INTERSECTION) return

  const topSel = svg.select('.clip-reveal-top')
  const bottomSel = svg.select('.clip-reveal-bottom')
  if (!topSel.node() || !bottomSel.node()) return

  revealInProgress = true
  let pending = 2
  function onEnd() {
    pending -= 1
    if (pending > 0) return
    revealInProgress = false
    streamsRevealDone = true
    svg.select('.streams-shell-top').attr('clip-path', null)
    svg.select('.streams-shell-aqua').attr('clip-path', null)
  }

  topSel
    .transition()
    .duration(STREAM_REVEAL_MS)
    .ease(easeCubicOut)
    .attr('width', innerWidthPx)
    .on('end', onEnd)

  bottomSel
    .transition()
    .duration(STREAM_REVEAL_MS)
    .ease(easeCubicOut)
    .attr('width', innerWidthPx)
    .on('end', onEnd)
}

const TARGET_SPECIES = new Set(['SBF', 'BFT', 'PBF'])
/** SVG pattern ids for wild vs farmed area fills (bottom panel). */
const PATTERN_WILD_CAPTURE_FILL = 'tuna-wild-capture-texture'
const PATTERN_AQUACULTURE_FILL = 'tuna-aquaculture-texture'
const UNREPORTED_COUNTRY = 'Unreported'
const UNREPORTED_GREY = '#9ca3af'
const YEAR_START = 1965
const YEAR_END = 2022

const SERIES_KEYS = ['CAPTURE', 'MARINE']
const SERIES_LABELS = {
  CAPTURE: 'Wild capture',
  MARINE: 'Marine aquaculture',
}

const X_AXIS_BAND = 34
/** Space between top and bottom panels (fits bottom section subtitle). */
const PANEL_GAP = 28
/** Height reserved for the top section subtitle above the streamgraph. */
const SUBTITLE_BAND = 22

function parseProductionData() {
  const rows = csvParse(csvRaw, (d) => ({
    year: Number(d.year),
    country: d.country?.trim() || UNREPORTED_COUNTRY,
    species: d.species?.trim(),
    value: Number(d.measurement_value),
  }))
    .filter((d) => Number.isFinite(d.year) && Number.isFinite(d.value) && d.species)
    .filter((d) => TARGET_SPECIES.has(d.species))
    .filter((d) => d.year >= YEAR_START && d.year <= YEAR_END)

  const grouped = rollup(
    rows,
    (values) => sum(values, (d) => d.value),
    (d) => d.year,
    (d) => d.country,
  )

  countryTotals = rollup(
    rows,
    (values) => sum(values, (d) => d.value),
    (d) => d.country,
  )

  const countries = Array.from(new Set(rows.map((d) => d.country))).sort((a, b) => {
    if (a === UNREPORTED_COUNTRY && b !== UNREPORTED_COUNTRY) return -1
    if (b === UNREPORTED_COUNTRY && a !== UNREPORTED_COUNTRY) return 1
    const ordA = CONTINENT_ORDER.indexOf(getContinent(a))
    const ordB = CONTINENT_ORDER.indexOf(getContinent(b))
    const ia = ordA === -1 ? CONTINENT_ORDER.length : ordA
    const ib = ordB === -1 ? CONTINENT_ORDER.length : ordB
    if (ia !== ib) return ia - ib
    return a.localeCompare(b)
  })

  const years = []
  for (let y = YEAR_START; y <= YEAR_END; y++) years.push(y)

  const stackRows = years.map((year) => {
    const entry = { year }
    for (const country of countries) {
      entry[country] = grouped.get(year)?.get(country) || 0
    }
    return entry
  })

  return { years, countries, stackRows }
}

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

function updateTopPanelContinentHighlight() {
  if (!svg) return
  const sel = legendContinent.value
  svg.selectAll('.stream.stream-top').classed('inactive', (d) => sel != null && getContinent(d.key) !== sel)
}

function appendBottomStripHatchPattern(
  defs,
  id,
  tileSize,
  hatchAngleDeg,
  hatchSpacing,
  hatchStroke,
  hatchStrokeWidth,
  hatchBackground,
) {
  const w = Math.max(8, tileSize)
  const h = Math.max(8, tileSize)
  const spacing = Math.max(6, hatchSpacing)
  const strokeWidth = Math.max(0.7, hatchStrokeWidth)
  const hatchExtent = (w + h) * 2

  const pat = defs
    .append('pattern')
    .attr('id', id)
    .attr('patternUnits', 'userSpaceOnUse')
    .attr('patternContentUnits', 'userSpaceOnUse')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', w)
    .attr('height', h)
    .attr('patternTransform', `rotate(${hatchAngleDeg})`)

  pat.append('rect').attr('x', 0).attr('y', 0).attr('width', w).attr('height', h).attr('fill', hatchBackground)

  const lineGroup = pat
    .append('g')
    .attr('stroke', hatchStroke)
    .attr('stroke-width', strokeWidth)
    .attr('stroke-linecap', 'square')

  for (let offset = -hatchExtent; offset <= hatchExtent; offset += spacing) {
    lineGroup
      .append('line')
      .attr('x1', offset)
      .attr('y1', h)
      .attr('x2', offset + h)
      .attr('y2', 0)
  }
}

function appendBottomStripDotPattern(
  defs,
  id,
  tileSize,
  dotRadius,
  dotFill,
  patternBackground,
) {
  const w = Math.max(8, tileSize)
  const h = Math.max(8, tileSize)
  const r = Math.max(0.8, dotRadius)

  const pat = defs
    .append('pattern')
    .attr('id', id)
    .attr('patternUnits', 'userSpaceOnUse')
    .attr('patternContentUnits', 'userSpaceOnUse')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', w)
    .attr('height', h)

  pat.append('rect').attr('x', 0).attr('y', 0).attr('width', w).attr('height', h).attr('fill', patternBackground)
  pat.append('circle').attr('cx', w * 0.25).attr('cy', h * 0.25).attr('r', r).attr('fill', dotFill)
  pat.append('circle').attr('cx', w * 0.75).attr('cy', h * 0.75).attr('r', r).attr('fill', dotFill)
}

function drawChart() {
  if (!hostRef.value || !svg) return

  const { years, countries, stackRows } = parseProductionData()
  if (!years.length || !countries.length) return

  const stackRowsAqua = parseAquacultureRowsForYears(years)

  const host = hostRef.value
  const width = host.clientWidth || 800
  const height = host.clientHeight || 520
  if (width < 20 || height < 20) return
  const margin = { top: 28, right: 34, bottom: 48, left: 84 }
  const innerWidth = width - margin.left - margin.right
  const available = height - margin.top - margin.bottom
  if (innerWidth < 20 || available < 20) return

  const availableForPanels = available - SUBTITLE_BAND - X_AXIS_BAND - PANEL_GAP
  const hTop = Math.max(120, (availableForPanels * 3) / 4)
  const hBottom = Math.max(48, hTop / 3)
  const plotHeight = SUBTITLE_BAND + hTop + PANEL_GAP + hBottom + X_AXIS_BAND

  const svgHeight = margin.top + plotHeight + margin.bottom

  svg.selectAll('.clip-reveal-top, .clip-reveal-bottom').interrupt()
  svg.selectAll('*').interrupt()
  revealInProgress = false

  svg.attr('width', width).attr('height', svgHeight)
  svg.selectAll('*').remove()

  const defs = svg.append('defs')
  if (!streamsRevealDone) {
    defs
      .append('clipPath')
      .attr('id', STREAM_CLIP_PANEL_TOP)
      .attr('clipPathUnits', 'userSpaceOnUse')
      .append('rect')
      .attr('class', 'clip-reveal-top')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', 0)
      .attr('height', hTop)

    defs
      .append('clipPath')
      .attr('id', STREAM_CLIP_PANEL_BOTTOM)
      .attr('clipPathUnits', 'userSpaceOnUse')
      .append('rect')
      .attr('class', 'clip-reveal-bottom')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', 0)
      .attr('height', hBottom)
  }
  appendBottomStripHatchPattern(
    defs,
    PATTERN_WILD_CAPTURE_FILL,
    18,
    -90,
    9,
    '#b3bfd1',
    1.6,
    '#13265f',
  )
  appendBottomStripDotPattern(
    defs,
    PATTERN_AQUACULTURE_FILL,
    16,
    1.8,
    '#b3bfd1',
    '#13265f',
  )

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  const gTop = g.append('g').attr('class', 'panel-top').attr('transform', `translate(0,${SUBTITLE_BAND})`)
  const gAxisX = g.append('g').attr('class', 'axis axis-x')
  const gAqua = g
    .append('g')
    .attr('class', 'panel-aqua')
    .attr('transform', `translate(0,${SUBTITLE_BAND + hTop + PANEL_GAP})`)

  g.append('text')
    .attr('class', 'panel-subtitle')
    .attr('text-anchor', 'start')
    .attr('x', 0)
    .attr('y', 14)
    .text('Bluefin Tuna Production by Country')

  g.append('rect')
    .attr('class', 'panel-subtitle-bottom-bg')
    .attr('x', -4)
    .attr('y', SUBTITLE_BAND + hTop + PANEL_GAP - 20)
    .attr('width', 178)
    .attr('height', 18)
    .attr('rx', 2)

  g.append('text')
    .attr('class', 'panel-subtitle panel-subtitle-bottom')
    .attr('text-anchor', 'start')
    .attr('x', 0)
    .attr('y', SUBTITLE_BAND + hTop + PANEL_GAP - 8)
    .text('Wild/Farmed Proportion')

  const stackGen = stack().keys(countries)
  const layers = stackGen(stackRows)

  const stackedMax = max(layers, (series) => max(series, (point) => point[1])) ?? 1
  const maxY = Math.max(1, stackedMax * 1.5)
  const xScale = scaleLinear().domain([YEAR_START, YEAR_END]).range([0, innerWidth])
  const yScaleTop = scaleLinear().domain([0, maxY]).range([hTop, 0])

  const aquaStackGen = stack().keys(SERIES_KEYS).offset(stackOffsetExpand)
  const aquaLayers = aquaStackGen(stackRowsAqua)
  const yScaleAqua = scaleLinear().domain([0, 1]).range([hBottom, 0])

  const getCountryColor = (country) =>
    country === UNREPORTED_COUNTRY ? UNREPORTED_GREY : stableCountryColor(country)

  const getAquaFill = (key) =>
    key === 'CAPTURE'
      ? `url(#${PATTERN_WILD_CAPTURE_FILL})`
      : `url(#${PATTERN_AQUACULTURE_FILL})`

  const areaTop = area()
    .x((point) => xScale(point.data.year))
    .y0((point) => yScaleTop(point[0]))
    .y1((point) => yScaleTop(point[1]))

  const areaAqua = area()
    .x((point) => xScale(point.data.year))
    .y0((point) => yScaleAqua(point[0]))
    .y1((point) => yScaleAqua(point[1]))

  const lineEndY = SUBTITLE_BAND + hTop + PANEL_GAP + hBottom
  const hoverLabelY = SUBTITLE_BAND + 12
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

  function importTotalForYear(y) {
    const row = stackRows.find((d) => d.year === y)
    if (!row) return 0
    return countries.reduce((acc, c) => acc + (row[c] || 0), 0)
  }

  function aquacultureHtmlForYear(y) {
    const row = stackRowsAqua.find((d) => d.year === y)
    if (!row) return ''
    const cap = row.CAPTURE || 0
    const mar = row.MARINE || 0
    const tot = cap + mar
    if (tot <= 0) {
      return '<div class="tooltip-note">Wild / farmed production: no data</div>'
    }
    const pCap = (cap / tot) * 100
    const pMar = (mar / tot) * 100
    return `<div class="tooltip-note">Wild ${pCap.toFixed(0)}% (${cap.toLocaleString(undefined, { maximumFractionDigits: 1 })} t) · Farmed ${pMar.toFixed(0)}% (${mar.toLocaleString(undefined, { maximumFractionDigits: 1 })} t)</div>`
  }

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
    const selected = stackRows.find((d) => d.year === clampedYear)
    if (!selected) return
    const total = countries.reduce((acc, country) => acc + (selected[country] || 0), 0)

    hoverLine.attr('x1', xPos).attr('x2', xPos).style('opacity', 1)
    hoverLabel
      .attr('x', xPos)
      .text(`Total ${total.toLocaleString(undefined, { maximumFractionDigits: 0 })} tonnes`)
      .style('opacity', 1)
  }

  function updateTooltipTop(event, series) {
    if (!tooltipEl) return
    const clampedYear = clampYearFromEvent(event)
    const selected = stackRows.find((d) => d.year === clampedYear)
    if (!selected) return

    const value = selected[series.key] || 0
    tooltipEl.innerHTML = `<div class="country">${series.key}</div><div>${clampedYear}: ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} tonnes</div>`
    tooltipEl.style.opacity = '1'
    tooltipEl.style.left = `${event.offsetX + 14}px`
    tooltipEl.style.top = `${event.offsetY + 14}px`
  }

  function updateTooltipAqua(event, series) {
    if (!tooltipEl) return
    const clampedYear = clampYearFromEvent(event)
    const selected = stackRowsAqua.find((d) => d.year === clampedYear)
    if (!selected) return

    const tonnes = selected[series.key] || 0
    const totalA = SERIES_KEYS.reduce((acc, key) => acc + (selected[key] || 0), 0)
    const pct = totalA > 0 ? (tonnes / totalA) * 100 : 0
    const label = SERIES_LABELS[series.key] || series.key
    const imp = importTotalForYear(clampedYear)
    tooltipEl.innerHTML = `<div class="country">${label}</div><div>${clampedYear}: ${pct.toFixed(1)}% </div></div>`
    tooltipEl.style.opacity = '1'
    tooltipEl.style.left = `${event.offsetX + 14}px`
    tooltipEl.style.top = `${event.offsetY + 14}px`
  }

  const streamsShellTop = gTop
    .append('g')
    .attr('class', 'streams-shell-top')
    .attr('clip-path', streamsRevealDone ? null : `url(#${STREAM_CLIP_PANEL_TOP})`)

  streamsShellTop
    .selectAll('.stream.stream-top')
    .data(layers)
    .join('path')
    .attr('class', 'stream stream-top')
    .attr('d', areaTop)
    .attr('fill', (d) => getCountryColor(d.key))
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
      updateTopPanelContinentHighlight()
      hideTooltip()
      hideHoverLine()
    })

  const streamsShellAqua = gAqua
    .append('g')
    .attr('class', 'streams-shell-aqua')
    .attr('clip-path', streamsRevealDone ? null : `url(#${STREAM_CLIP_PANEL_BOTTOM})`)

  streamsShellAqua
    .selectAll('.stream.stream-aqua')
    .data(aquaLayers)
    .join('path')
    .attr('class', 'stream stream-aqua')
    .attr('d', areaAqua)
    .attr('fill', (d) => getAquaFill(d.key))
    .on('mouseenter', function (event, series) {
      gAqua.selectAll('.stream-aqua').classed('inactive', (d) => d.key !== series.key)
      updateTooltipAqua(event, series)
      updateHoverLine(event)
    })
    .on('mousemove', function (event, series) {
      updateTooltipAqua(event, series)
      updateHoverLine(event)
    })
    .on('mouseleave', () => {
      gAqua.selectAll('.stream-aqua').classed('inactive', false)
      hideTooltip()
      hideHoverLine()
    })

  gAxisX
    .attr('transform', `translate(0,${SUBTITLE_BAND + hTop + PANEL_GAP + hBottom})`)
    .call(axisBottom(xScale).tickFormat((d) => Number(d).toString()))

  gTop.append('g').attr('class', 'axis axis-y').call(
    axisLeft(yScaleTop)
      .tickPadding(10)
      .tickFormat(formatTickShort),
  )

  gAqua.append('g').attr('class', 'axis axis-y axis-y-aqua').call(
    axisLeft(yScaleAqua)
      .ticks(3)
      .tickPadding(10)
      .tickFormat((d) => `${Math.round(Number(d) * 100)}%`),
  )

  gTop
    .append('text')
    .attr('class', 'axis-label')
    .attr('text-anchor', 'middle')
    .attr('transform', 'rotate(-90)')
    .attr('y', -54)
    .attr('x', -hTop / 2)
    .attr('dy', '.32em')
    .attr('fill', '#334155')
    .attr('font-size', 13)
    .attr('font-family', 'inherit')
    .text('Catch (tonnes)')

  gAqua
    .append('text')
    .attr('class', 'axis-label axis-label-aqua')
    .attr('text-anchor', 'middle')
    .attr('transform', 'rotate(-90)')
    .attr('y', -54)
    .attr('x', -hBottom / 2)
    .attr('dy', '.32em')
    .attr('fill', '#334155')
    .attr('font-size', 13)
    .attr('font-family', 'inherit')
    .text('% of production')

  hoverLine.raise()
  hoverLabel.raise()
  g.selectAll('.panel-subtitle-bottom-bg, .panel-subtitle-bottom').raise()

  updateTopPanelContinentHighlight()

  lastRevealInnerWidth = innerWidth
  maybeStartStreamReveal()
}

function toggleLegendContinent(continent) {
  legendContinent.value = legendContinent.value === continent ? null : continent
}

watch(legendContinent, () => {
  updateTopPanelContinentHighlight()
})

onMounted(() => {
  const host = hostRef.value
  if (!host) return

  svg = select(host).append('svg').attr('class', 'tuna-production-countries-svg')
  drawChart()

  resizeObserver = new ResizeObserver(() => drawChart())
  resizeObserver.observe(host)

  nextTick(() => {
    const wrap = wrapRef.value
    maybeStartStreamReveal()

    if (!wrap || typeof IntersectionObserver === 'undefined') {
      return
    }

    intersectionObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return
        maybeStartStreamReveal(entry)
      },
      {
        root: null,
        rootMargin: '0px',
        threshold: [0, 0.12, REVEAL_START_INTERSECTION, 0.45, 0.7, 1],
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
    <aside class="legend" role="toolbar" aria-label="Catch by continent color group">
      <ul class="legend-list">
        <li
          v-for="c in CONTINENT_ORDER"
          :key="c"
          class="legend-item"
          :class="{
            'is-inactive': legendContinent !== null && legendContinent !== c,
            'is-active': legendContinent !== null && legendContinent === c,
          }"
          :aria-pressed="legendContinent === c"
          role="button"
          tabindex="0"
          @click="toggleLegendContinent(c)"
          @keydown.enter.prevent="toggleLegendContinent(c)"
          @keydown.space.prevent="toggleLegendContinent(c)"
        >
          <span
            class="swatch"
            :style="{
              '--swatch-color': continentLegendSwatch(c),
            }"
          />
          <span class="legend-label">{{ c }}</span>
        </li>
      </ul>
    </aside>
    <div ref="hostRef" class="d3-host" />
    <div ref="tooltipRef" class="tooltip" />
  </div>
</template>

<style scoped>
.streamgraph-wrap {
  --viz-height: clamp(340px, 78vh, 640px);
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: var(--viz-height);
  max-height: 640px;
  overflow: hidden;
}

.legend {
  position: relative;
  flex-shrink: 0;
  width: 100%;
  max-width: 1180px;
  margin: 0 auto 0.6rem;
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
  cursor: pointer;
  transition: opacity 0.18s ease;
  margin: 0;
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

.legend-label {
  white-space: nowrap;
}

.d3-host {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.d3-host :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}

.streamgraph-wrap :deep(.axis text) {
  fill: #475569;
  font-size: 0.78rem;
  font-family: inherit;
}

.streamgraph-wrap :deep(.axis path),
.streamgraph-wrap :deep(.axis line) {
  stroke: #94a3b8;
}

.streamgraph-wrap :deep(.axis) {
  pointer-events: none;
}

.streamgraph-wrap :deep(.stream) {
  fill-opacity: 0.76;
  transition: fill-opacity 0.2s ease;
  cursor: pointer;
}

.streamgraph-wrap :deep(.stream.stream-aqua) {
  fill-opacity: 0.92;
}

.streamgraph-wrap :deep(.stream:hover) {
  fill-opacity: 0.9;
}

.streamgraph-wrap :deep(.stream.stream-aqua:hover) {
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

.streamgraph-wrap :deep(.panel-subtitle) {
  fill: #0f172a;
  font-size: 0.78rem;
  font-weight: 600;
}

.streamgraph-wrap :deep(.panel-subtitle-bottom-bg) {
  fill: #ffffff;
}

.streamgraph-wrap :deep(.hover-line-label) {
  fill: #0f172a;
  font-size: 0.7rem;
  font-weight: 600;
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
  .streamgraph-wrap {
    --viz-height: clamp(270px, 60vh, 480px);
    max-height: 480px;
  }
}
</style>

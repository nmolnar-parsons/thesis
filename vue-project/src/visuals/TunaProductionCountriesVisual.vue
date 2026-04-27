<script setup>
import { max, rollup, sum } from 'd3-array'
import { axisBottom, axisLeft } from 'd3-axis'
import { csvParse } from 'd3-dsv'
import { scaleLinear } from 'd3-scale'
import { pointer, select } from 'd3-selection'
import { area, stack, stackOffsetExpand } from 'd3-shape'
import { onMounted, onUnmounted, ref } from 'vue'
import csvRaw from '../data/GTA_FIRMs_tuna_cleaned_countries.csv?raw'
import aquaCsvRaw from '../data/bluefin_aquaculture.csv?raw'

const hostRef = ref(null)
const tooltipRef = ref(null)

let svg
let resizeObserver
let countryTotals = new Map()

const JAPAN_RED = '#d32f2f'
const TARGET_SPECIES = new Set(['SBF', 'BFT', 'PBF'])
const LIGHT_BLUE = '#bfdbfe'
const DEEP_BLUE = '#1d4ed8'
const AQUA_MARINE = '#38bdf8'
const YEAR_START = 1965

const SERIES_KEYS = ['CAPTURE', 'MARINE']
const SERIES_LABELS = {
  CAPTURE: 'Wild capture',
  MARINE: 'Marine aquaculture',
}

const X_AXIS_BAND = 34
const PANEL_GAP = 8

function parseProductionData() {
  const rows = csvParse(csvRaw, (d) => ({
    year: Number(d.year),
    country: d.country?.trim(),
    species: d.species?.trim(),
    value: Number(d.measurement_value),
  }))
    .filter((d) => Number.isFinite(d.year) && Number.isFinite(d.value) && d.country && d.species)
    .filter((d) => TARGET_SPECIES.has(d.species))
    .filter((d) => d.year >= YEAR_START)

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

  const years = Array.from(grouped.keys()).sort((a, b) => a - b)
  const countries = Array.from(new Set(rows.map((d) => d.country))).sort()

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
      d.year >= YEAR_START,
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

function drawChart() {
  if (!hostRef.value || !svg) return

  const { years, countries, stackRows } = parseProductionData()
  if (!years.length || !countries.length) return

  const stackRowsAqua = parseAquacultureRowsForYears(years)

  const host = hostRef.value
  const width = host.clientWidth || 800
  const height = host.clientHeight || 520
  const margin = { top: 28, right: 24, bottom: 48, left: 64 }
  const innerWidth = width - margin.left - margin.right
  const available = height - margin.top - margin.bottom

  const hTop = Math.max(120, ((available - X_AXIS_BAND - PANEL_GAP) * 3) / 4)
  const hBottom = Math.max(48, hTop / 3)
  const plotHeight = hTop + X_AXIS_BAND + PANEL_GAP + hBottom

  const svgHeight = margin.top + plotHeight + margin.bottom

  svg.attr('width', width).attr('height', svgHeight)
  svg.selectAll('*').remove()

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  const gTop = g.append('g').attr('class', 'panel-top')
  const gAxisX = g.append('g').attr('class', 'axis axis-x')
  const gAqua = g.append('g').attr('class', 'panel-aqua').attr('transform', `translate(0,${hTop + X_AXIS_BAND + PANEL_GAP})`)

  const stackGen = stack().keys(countries)
  const layers = stackGen(stackRows)

  const maxY = max(layers, (series) => max(series, (point) => point[1])) ?? 1
  const xScale = scaleLinear().domain([years[0], years[years.length - 1]]).range([0, innerWidth])
  const yScaleTop = scaleLinear().domain([0, maxY]).range([hTop, 0])

  const aquaStackGen = stack().keys(SERIES_KEYS).offset(stackOffsetExpand)
  const aquaLayers = aquaStackGen(stackRowsAqua)
  const yScaleAqua = scaleLinear().domain([0, 1]).range([hBottom, 0])

  const nonJapanTotals = countries
    .filter((country) => country.toLowerCase() !== 'japan')
    .map((country) => countryTotals.get(country) || 0)
  const minTotal = Math.min(...nonJapanTotals, 0)
  const maxTotal = Math.max(...nonJapanTotals, 1)
  const blueScale = scaleLinear().domain([minTotal, maxTotal]).range([LIGHT_BLUE, DEEP_BLUE])
  const getCountryColor = (country) =>
    country.toLowerCase() === 'japan' ? JAPAN_RED : blueScale(countryTotals.get(country) || 0)

  const getAquaColor = (key) => (key === 'CAPTURE' ? DEEP_BLUE : AQUA_MARINE)

  const areaTop = area()
    .x((point) => xScale(point.data.year))
    .y0((point) => yScaleTop(point[0]))
    .y1((point) => yScaleTop(point[1]))

  const areaAqua = area()
    .x((point) => xScale(point.data.year))
    .y0((point) => yScaleAqua(point[0]))
    .y1((point) => yScaleAqua(point[1]))

  const lineEndY = hTop + X_AXIS_BAND + PANEL_GAP + hBottom

  const hoverLine = g
    .append('line')
    .attr('class', 'hover-line')
    .attr('x1', 0)
    .attr('x2', 0)
    .attr('y1', 0)
    .attr('y2', lineEndY)
    .style('opacity', 0)

  const hoverLabel = g
    .append('text')
    .attr('class', 'hover-line-label')
    .attr('text-anchor', 'middle')
    .attr('x', 0)
    .attr('y', -5)
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
    return Math.min(Math.max(domainYear, years[0]), years[years.length - 1])
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
      .text(`${total.toLocaleString(undefined, { maximumFractionDigits: 1 })} tonnes`)
      .style('opacity', 1)
  }

  function updateTooltipTop(event, series) {
    if (!tooltipEl) return
    const clampedYear = clampYearFromEvent(event)
    const selected = stackRows.find((d) => d.year === clampedYear)
    if (!selected) return

    const value = selected[series.key] || 0
    tooltipEl.innerHTML = `<div class="country">${series.key}</div><div>${clampedYear}: ${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} tonnes</div>${aquacultureHtmlForYear(clampedYear)}`
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
    tooltipEl.innerHTML = `<div class="country">${label}</div><div>${clampedYear}: ${pct.toFixed(1)}% of wild/farmed total · ${tonnes.toLocaleString(undefined, { maximumFractionDigits: 1 })} t</div><div class="tooltip-note">Imports (all countries): ${imp.toLocaleString(undefined, { maximumFractionDigits: 1 })} t</div>`
    tooltipEl.style.opacity = '1'
    tooltipEl.style.left = `${event.offsetX + 14}px`
    tooltipEl.style.top = `${event.offsetY + 14}px`
  }

  gTop
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
      gTop.selectAll('.stream-top').classed('inactive', false)
      hideTooltip()
      hideHoverLine()
    })

  gAqua
    .selectAll('.stream.stream-aqua')
    .data(aquaLayers)
    .join('path')
    .attr('class', 'stream stream-aqua')
    .attr('d', areaAqua)
    .attr('fill', (d) => getAquaColor(d.key))
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

  gAxisX.attr('transform', `translate(0,${hTop})`).call(axisBottom(xScale).tickFormat((d) => Number(d).toString()))

  gTop.append('g').attr('class', 'axis axis-y').call(
    axisLeft(yScaleTop).tickFormat((d) => Number(d).toLocaleString(undefined, { maximumFractionDigits: 0 })),
  )

  gAqua.append('g').attr('class', 'axis axis-y axis-y-aqua').call(
    axisLeft(yScaleAqua)
      .ticks(3)
      .tickFormat((d) => `${Math.round(Number(d) * 100)}%`),
  )

  gTop
    .append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('y', -margin.left + 5)
    .attr('x', -hTop / 2)
    .attr('dy', '.8em')
    .text('Catch (tonnes)')

  gAqua
    .append('text')
    .attr('class', 'axis-label axis-label-aqua')
    .attr('transform', 'rotate(-90)')
    .attr('y', -margin.left + 5)
    .attr('x', -hBottom / 2)
    .attr('dy', '.8em')
    .text('Wild vs farmed (share)')

  hoverLine.raise()
  hoverLabel.raise()
}

onMounted(() => {
  const host = hostRef.value
  if (!host) return

  svg = select(host).append('svg').attr('class', 'tuna-production-countries-svg')
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
  <div class="streamgraph-wrap">
    <div ref="hostRef" class="d3-host" />
    <div ref="tooltipRef" class="tooltip" />
  </div>
</template>

<style scoped>
.streamgraph-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: min(78vh, 640px);
  overflow: hidden;
}

.d3-host {
  width: 100%;
  height: 100%;
  min-height: min(78vh, 640px);
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

.streamgraph-wrap :deep(.axis) {
  pointer-events: none;
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

.streamgraph-wrap :deep(.hover-line) {
  stroke: #334155;
  stroke-width: 1.2;
  stroke-dasharray: 4 4;
  pointer-events: none;
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
</style>

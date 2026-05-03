<script setup>
import { arc, pie } from 'd3-shape'
import { csvParse } from 'd3-dsv'
import { computed, ref, watch } from 'vue'
import csvRaw from '../data/tuna_imports_usa_customs.csv?raw'
import { getContinent, getCountryColor } from './countryContinentColors.js'

const YEAR_TARGET = 2025
const BLUEFIN_PRODUCT = 'Tuna Bluefin Fresh'
const SELECT_ALL_KEY = 'all'

const GRID_OUTER_RADIUS = 62
const GRID_INNER_RADIUS = 34
const GRID_SVG_SIZE = 150
const GRID_CENTER = GRID_SVG_SIZE / 2

const SINGLE_OUTER_RADIUS = 152
const SINGLE_INNER_RADIUS = 84
const SINGLE_SVG_SIZE = 640
const SINGLE_CENTER = SINGLE_SVG_SIZE / 2

/** Radial bump then horizontal segment for donut callout lines (single view) */
const CALLOUT_RADIAL_BUMP = 22
const CALLOUT_HORIZONTAL = 48

const NYC_DISTRICT_KEY = 'New York, NY'

const hoveredCountry = ref('')
const selectedKey = ref(NYC_DISTRICT_KEY)

const tooltip = ref({
  visible: false,
  x: 0,
  y: 0,
  country: '',
  district: '',
  percent: 0,
  tonnes: 0,
})

const parsedRows = csvParse(csvRaw, (d) => {
  const year = Number(d.Year)
  const country = d['Country Name']?.trim()
  const district = d['US Customs District']?.trim()
  const productName = d['Product Name']?.trim()
  const kg = Number(d['Volume (kg)'])
  const tonnes = kg / 1000

  if (!Number.isFinite(year) || !country || !district || !productName || !Number.isFinite(tonnes)) return null

  return { year, country, district, productName, tonnes }
}).filter(Boolean)

const filteredImportRows = computed(() =>
  parsedRows.filter((d) => d.year === YEAR_TARGET && d.productName === BLUEFIN_PRODUCT),
)

const pieGenerator = pie()
  .sort((a, b) => b.tonnes - a.tonnes)
  .value((d) => d.tonnes)

const arcGeneratorGrid = arc().innerRadius(GRID_INNER_RADIUS).outerRadius(GRID_OUTER_RADIUS)
const arcGeneratorSingle = arc().innerRadius(SINGLE_INNER_RADIUS).outerRadius(SINGLE_OUTER_RADIUS)

function chartFromDistrictEntry(districtEntry) {
  const segments = Array.from(districtEntry.countries.entries())
    .map(([country, tonnes]) => ({
      country,
      tonnes,
      percent: districtEntry.totalTonnes > 0 ? (tonnes / districtEntry.totalTonnes) * 100 : 0,
    }))
    .sort((a, b) => b.tonnes - a.tonnes)

  return {
    district: districtEntry.district,
    totalTonnes: districtEntry.totalTonnes,
    segments,
    arcs: pieGenerator(segments),
  }
}

const districtCharts = computed(() => {
  const districtMap = new Map()

  for (const row of filteredImportRows.value) {
    if (!districtMap.has(row.district)) {
      districtMap.set(row.district, { district: row.district, totalTonnes: 0, countries: new Map() })
    }

    const districtEntry = districtMap.get(row.district)
    districtEntry.totalTonnes += row.tonnes
    districtEntry.countries.set(row.country, (districtEntry.countries.get(row.country) || 0) + row.tonnes)
  }

  return Array.from(districtMap.values())
    .filter((e) => e.totalTonnes > 0)
    .map(chartFromDistrictEntry)
    .sort((a, b) => b.totalTonnes - a.totalTonnes)
})

const navItems = computed(() => {
  const items = []
  for (const c of districtCharts.value) {
    items.push({ key: c.district, label: c.district })
  }
  items.push({ key: SELECT_ALL_KEY, label: 'All districts' })
  return items
})

watch(
  districtCharts,
  (charts) => {
    if (!charts.length) return
    const keys = new Set(charts.map((c) => c.district))
    if (selectedKey.value !== SELECT_ALL_KEY && !keys.has(selectedKey.value)) {
      selectedKey.value = keys.has(NYC_DISTRICT_KEY) ? NYC_DISTRICT_KEY : charts[0].district
    }
  },
  { immediate: true },
)

const selectedDistrictChart = computed(() => {
  if (selectedKey.value === SELECT_ALL_KEY) return null
  return districtCharts.value.find((c) => c.district === selectedKey.value) ?? null
})

function selectNext() {
  const items = navItems.value
  const i = items.findIndex((x) => x.key === selectedKey.value)
  const next = (i + 1) % items.length
  selectedKey.value = items[next].key
}

function selectPrev() {
  const items = navItems.value
  const i = items.findIndex((x) => x.key === selectedKey.value)
  const prev = (i - 1 + items.length) % items.length
  selectedKey.value = items[prev].key
}

function sortLegendEntries(a, b) {
  if (a.country.toLowerCase() === 'japan') return -1
  if (b.country.toLowerCase() === 'japan') return 1
  if (a.continent !== b.continent) return a.continent.localeCompare(b.continent)
  return b.tonnes - a.tonnes
}

const legendCountries = computed(() => {
  const rows =
    selectedKey.value === SELECT_ALL_KEY
      ? filteredImportRows.value
      : filteredImportRows.value.filter((d) => d.district === selectedKey.value)

  const totals = new Map()
  for (const row of rows) {
    totals.set(row.country, (totals.get(row.country) || 0) + row.tonnes)
  }
  return Array.from(totals.entries())
    .map(([country, tonnes]) => ({ country, tonnes, continent: getContinent(country) }))
    .sort(sortLegendEntries)
})

/** Leader-line callouts in donut-centered coords (radial dir from arc centroid = d3 arc convention) */
function calloutForArc(arcDatum, arcGen, outerR, radialBump, horizontalLen) {
  const [gcx, gcy] = arcGen.centroid(arcDatum)
  const glen = Math.hypot(gcx, gcy) || 1
  const ux = gcx / glen
  const uy = gcy / glen
  const ax = ux * outerR
  const ay = uy * outerR
  const bx = ux * (outerR + radialBump)
  const by = uy * (outerR + radialBump)
  const onRight = ux >= 0
  const tx = bx + (onRight ? horizontalLen : -horizontalLen)
  const ty = by
  const dotPad = 10
  const dotR = 4.5
  const textGap = 8
  let dotX
  let textX
  let textAnchor
  if (onRight) {
    dotX = tx + dotPad
    textX = dotX + dotR + textGap
    textAnchor = 'start'
  } else {
    dotX = tx - dotPad
    textX = dotX - dotR - textGap
    textAnchor = 'end'
  }
  const dotY = ty
  const textY = ty
  return {
    country: arcDatum.data.country,
    color: getCountryColor(arcDatum.data.country),
    polylinePoints: `${ax},${ay} ${bx},${by} ${tx},${ty} ${dotX},${dotY}`,
    dotX,
    dotY,
    dotR,
    textX,
    textY,
    textAnchor,
    onRight,
  }
}

const singleDonutCallouts = computed(() => {
  const chart = selectedDistrictChart.value
  if (!chart) return []
  return chart.arcs.map((arcDatum) => ({
    ...calloutForArc(arcDatum, arcGeneratorSingle, SINGLE_OUTER_RADIUS, CALLOUT_RADIAL_BUMP, CALLOUT_HORIZONTAL),
    segment: arcDatum.data,
  }))
})

function onArcEnter(event, district, segment) {
  hoveredCountry.value = segment.country
  tooltip.value = {
    visible: true,
    x: event.clientX + 12,
    y: event.clientY + 12,
    country: segment.country,
    district: district.district,
    percent: segment.percent,
    tonnes: segment.tonnes,
  }
}

function onArcMove(event) {
  tooltip.value.x = event.clientX + 12
  tooltip.value.y = event.clientY + 12
}

function onArcLeave() {
  hoveredCountry.value = ''
  tooltip.value.visible = false
}

function onLegendEnter(country) {
  hoveredCountry.value = country
}

function onLegendLeave() {
  hoveredCountry.value = ''
}

function formatTonnes(value) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 })
}
</script>

<template>
  <div class="imports-wrap">
    <p class="imports-label">Bluefin imports by U.S. customs district (2025)</p>
    <div class="country-legend" aria-label="Country color legend">
      <div
        v-for="entry in legendCountries"
        :key="entry.country"
        class="legend-item"
        :class="{
          'legend-item--dimmed': hoveredCountry && hoveredCountry !== entry.country,
          'legend-item--active': hoveredCountry && hoveredCountry === entry.country,
        }"
        @mouseenter="onLegendEnter(entry.country)"
        @mouseleave="onLegendLeave"
      >
        <span class="legend-swatch" :style="{ background: getCountryColor(entry.country) }" />
        <span class="legend-country">{{ entry.country }}</span>
      </div>
    </div>

    <div class="imports-body">
      <aside class="district-sidebar" aria-label="Customs district selection">
        <div class="sidebar-nav">
          <button type="button" class="nav-arrow" aria-label="Previous district" @click="selectPrev">‹</button>
          <button type="button" class="nav-arrow" aria-label="Next district" @click="selectNext">›</button>
        </div>
        <ul class="district-list">
          <li v-for="item in navItems" :key="item.key">
            <button
              type="button"
              class="district-list__btn"
              :class="{ 'district-list__btn--active': selectedKey === item.key }"
              @click="selectedKey = item.key"
            >
              {{ item.label }}
            </button>
          </li>
        </ul>
      </aside>

      <div class="imports-center">
        <template v-if="selectedKey === SELECT_ALL_KEY">
          <div class="district-grid">
            <article v-for="district in districtCharts" :key="district.district" class="district-card">
              <h3 class="district-title">{{ district.district }}</h3>
              <p class="district-total">{{ formatTonnes(district.totalTonnes) }} t total</p>

              <svg
                :width="GRID_SVG_SIZE"
                :height="GRID_SVG_SIZE"
                :viewBox="`0 0 ${GRID_SVG_SIZE} ${GRID_SVG_SIZE}`"
                class="donut-svg"
              >
                <g :transform="`translate(${GRID_CENTER},${GRID_CENTER})`">
                  <path
                    v-for="arcDatum in district.arcs"
                    :key="`${district.district}-${arcDatum.data.country}`"
                    :d="arcGeneratorGrid(arcDatum)"
                    :fill="getCountryColor(arcDatum.data.country)"
                    class="arc-segment"
                    :class="{
                      'arc-segment--dimmed':
                        hoveredCountry && hoveredCountry !== arcDatum.data.country,
                      'arc-segment--highlight':
                        hoveredCountry && hoveredCountry === arcDatum.data.country,
                    }"
                    @mouseenter="onArcEnter($event, district, arcDatum.data)"
                    @mousemove="onArcMove($event)"
                    @mouseleave="onArcLeave"
                  />
                </g>
              </svg>
            </article>
          </div>
        </template>

        <template v-else-if="selectedDistrictChart">
          <article class="district-card district-card--single">
            <h3 class="district-title">{{ selectedDistrictChart.district }}</h3>
            <p class="district-total">{{ formatTonnes(selectedDistrictChart.totalTonnes) }} t total</p>

            <svg
              :width="SINGLE_SVG_SIZE"
              :height="SINGLE_SVG_SIZE"
              :viewBox="`0 0 ${SINGLE_SVG_SIZE} ${SINGLE_SVG_SIZE}`"
              class="donut-svg donut-svg--single"
            >
              <g :transform="`translate(${SINGLE_CENTER},${SINGLE_CENTER})`">
                <path
                  v-for="arcDatum in selectedDistrictChart.arcs"
                  :key="`${selectedDistrictChart.district}-${arcDatum.data.country}`"
                  :d="arcGeneratorSingle(arcDatum)"
                  :fill="getCountryColor(arcDatum.data.country)"
                  class="arc-segment"
                  :class="{
                    'arc-segment--dimmed':
                      hoveredCountry && hoveredCountry !== arcDatum.data.country,
                    'arc-segment--highlight':
                      hoveredCountry && hoveredCountry === arcDatum.data.country,
                  }"
                  @mouseenter="onArcEnter($event, selectedDistrictChart, arcDatum.data)"
                  @mousemove="onArcMove($event)"
                  @mouseleave="onArcLeave"
                />
                <g
                  v-for="item in singleDonutCallouts"
                  :key="`callout-${selectedDistrictChart.district}-${item.country}`"
                  class="callout-group"
                  :class="{
                    'callout-group--dimmed':
                      hoveredCountry && hoveredCountry !== item.country,
                    'callout-group--highlight':
                      hoveredCountry && hoveredCountry === item.country,
                  }"
                  @mouseenter="onArcEnter($event, selectedDistrictChart, item.segment)"
                  @mousemove="onArcMove($event)"
                  @mouseleave="onArcLeave"
                >
                  <polyline :points="item.polylinePoints" class="callout-line" fill="none" />
                  <circle :cx="item.dotX" :cy="item.dotY" :r="item.dotR" class="callout-dot" :fill="item.color" />
                  <text
                    :x="item.textX"
                    :y="item.textY"
                    class="callout-text"
                    :text-anchor="item.textAnchor"
                    dominant-baseline="middle"
                  >
                    {{ item.country }}
                  </text>
                </g>
              </g>
            </svg>
          </article>
        </template>
      </div>
    </div>

    <div
      v-if="tooltip.visible"
      class="tooltip"
      :style="{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }"
    >
      <div class="tooltip-country">{{ tooltip.country }}</div>
      <div>{{ tooltip.percent.toFixed(1) }}% of imports</div>
      <div>{{ formatTonnes(tooltip.tonnes) }} tonnes</div>
    </div>
  </div>
</template>

<style scoped>
.imports-wrap {
  position: relative;
}

.imports-label {
  margin: 0 0 0.9rem;
  text-align: center;
  font-size: 0.78rem;
  color: #475569;
}

.country-legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.45rem 0.8rem;
  margin: 0 auto 1rem;
  max-width: 1180px;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.72rem;
  color: #334155;
  cursor: pointer;
  transition: opacity 0.16s ease;
}

.legend-item--dimmed {
  opacity: 0.28;
}

.legend-item--active {
  opacity: 1;
}

.legend-swatch {
  width: 0.62rem;
  height: 0.62rem;
  border-radius: 2px;
  border: 1px solid rgba(15, 23, 42, 0.2);
  flex-shrink: 0;
}

.legend-country {
  white-space: nowrap;
}

.imports-body {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  max-width: 1280px;
  margin: 0 auto;
}

.district-sidebar {
  flex: 0 0 13rem;
  min-width: 0;
}

.sidebar-nav {
  display: flex;
  gap: 0.35rem;
  margin-bottom: 0.5rem;
}

.nav-arrow {
  flex: 1;
  padding: 0.35rem 0.5rem;
  font-size: 1.1rem;
  line-height: 1;
  color: #0f172a;
  background: #f1f5f9;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 0.35rem;
  cursor: pointer;
  transition: background 0.15s ease;
}

.nav-arrow:hover {
  background: #e2e8f0;
}

.district-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: min(70vh, 28rem);
  overflow-y: auto;
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 0.4rem;
  background: #fafafa;
}

.district-list li {
  margin: 0;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
}

.district-list li:last-child {
  border-bottom: none;
}

.district-list__btn {
  display: block;
  width: 100%;
  padding: 0.45rem 0.55rem;
  text-align: left;
  font-size: 0.72rem;
  line-height: 1.35;
  color: #334155;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.district-list__btn:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.district-list__btn--active {
  background: #e0f2fe;
  color: #0c4a6e;
  font-weight: 600;
}

.imports-center {
  flex: 1;
  min-width: 0;
}

.district-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.85rem;
}

.district-card {
  padding: 0.25rem 0.35rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 210px;
}

.district-card--single {
  min-height: auto;
  max-width: min(100%, 42rem);
  margin: 0 auto;
}

.district-title {
  margin: 0;
  text-align: center;
  font-size: 0.8rem;
  line-height: 1.3;
  color: #0f172a;
}

.district-total {
  margin: 0.35rem 0 0.6rem;
  font-size: 0.74rem;
  color: #475569;
}

.donut-svg {
  overflow: visible;
}

.donut-svg--single {
  display: block;
  margin: 0 auto;
}

.arc-segment {
  cursor: pointer;
  transition: opacity 0.16s ease, stroke-width 0.16s ease;
}

.arc-segment:hover {
  opacity: 0.86;
}

.arc-segment--dimmed {
  opacity: 0.18;
}

.arc-segment--highlight {
  opacity: 1;
  stroke: #0f172a;
  stroke-width: 1.1;
}

.callout-group {
  cursor: pointer;
  pointer-events: all;
  transition: opacity 0.16s ease;
}

.callout-line {
  stroke: #64748b;
  stroke-width: 1.15;
  stroke-linejoin: round;
  pointer-events: visibleStroke;
}

.callout-dot {
  stroke: rgba(15, 23, 42, 0.25);
  stroke-width: 0.75;
  pointer-events: visibleFill;
}

.callout-text {
  font-size: 0.72rem;
  font-weight: 600;
  fill: #0f172a;
  pointer-events: visibleFill;
}

.callout-group--dimmed {
  opacity: 0.22;
}

.callout-group--highlight {
  opacity: 1;
}

.callout-group--highlight .callout-line {
  stroke: #0f172a;
  stroke-width: 1.35;
}

.tooltip {
  position: fixed;
  z-index: 30;
  pointer-events: none;
  padding: 0.5rem 0.65rem;
  border-radius: 0.45rem;
  background: rgba(15, 23, 42, 0.92);
  color: #f8fafc;
  font-size: 0.73rem;
  line-height: 1.35;
}

.tooltip-country {
  font-weight: 700;
}

@media (max-width: 1280px) {
  .district-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 980px) {
  .district-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .country-legend {
    justify-content: flex-start;
  }
}

@media (max-width: 720px) {
  .imports-body {
    flex-direction: column;
  }

  .district-sidebar {
    flex: none;
    width: 100%;
  }

  .district-list {
    max-height: 10rem;
  }

  .district-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

<script setup>
import { arc, pie } from 'd3-shape'
import { csvParse } from 'd3-dsv'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import csvRaw from '../data/tuna_imports_usa_customs.csv?raw'
import { getContinent, getCountryColor } from './countryContinentColors.js'

const YEAR_TARGET = 2025
const BLUEFIN_PRODUCT = 'Tuna Bluefin Fresh'
const GRID_OUTER_RADIUS = 44
const GRID_INNER_RADIUS = 24
const GRID_SVG_SIZE = 108
const GRID_CENTER = GRID_SVG_SIZE / 2

const SINGLE_OUTER_RADIUS = 152
const SINGLE_INNER_RADIUS = 84
const SINGLE_SVG_SIZE = 640
const SINGLE_CENTER = SINGLE_SVG_SIZE / 2

/** Radial bump from arc, then one straight segment to label (single bend). Donut-centered coords. */
const CALLOUT_RADIAL_BUMP = 30
/** Chord length along mostly-horizontal run from bump toward label */
const CALLOUT_HORIZONTAL = 58
/** Min vertical gap between stacked labels (same side), SVG user units */
const CALLOUT_MIN_LABEL_GAP = 20
/** Keep left callouts from reaching too far toward the menu (max x is toward +∞; clamp floor) */
const CALLOUT_MIN_LEFT_X = -208
/** Optional cap on right-side extent (donut-centered x) */
const CALLOUT_MAX_RIGHT_X = 248
const CALLOUT_DOT_R = 5.5
const CALLOUT_TEXT_GAP = 12

/** Leader lines / labels draw in the last portion of the morph (after arcs have mostly settled). */
const CALLOUT_REVEAL_MORPH_START = 0.62

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

/** Fit all menu donuts in the left column without scrolling (cols capped for narrow 1/3 strip). */
const menuGridLayout = computed(() => {
  const n = districtCharts.value.length
  if (n === 0) return { cols: 1, rows: 1 }
  let cols = Math.ceil(Math.sqrt(n))
  cols = Math.min(Math.max(cols, 2), 4)
  const rows = Math.ceil(n / cols)
  return { cols, rows }
})

watch(
  districtCharts,
  (charts) => {
    if (!charts.length) return
    const keys = new Set(charts.map((c) => c.district))
    if (!keys.has(selectedKey.value)) {
      selectedKey.value = keys.has(NYC_DISTRICT_KEY) ? NYC_DISTRICT_KEY : charts[0].district
    }
  },
  { immediate: true },
)

const selectedDistrictChart = computed(() => {
  return districtCharts.value.find((c) => c.district === selectedKey.value) ?? null
})

/** District-switch donut morph (interpolate arc angles between pies). */
const MORPH_DURATION_MS = 560

const morphArcs = ref(null)
const morphCalloutReveal = ref(1)
const isMorphing = ref(false)
let morphRafId = 0

function cancelMorphAnimation() {
  if (morphRafId) {
    cancelAnimationFrame(morphRafId)
    morphRafId = 0
  }
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

/** Build synthetic pie arc data at eased progress `te` in [0, 1] between two district charts. */
function buildMorphArcPayload(prev, next, te) {
  const prevBy = new Map(
    prev.arcs.map((a) => [a.data.country, { startAngle: a.startAngle, endAngle: a.endAngle, data: a.data }]),
  )
  const nextBy = new Map(
    next.arcs.map((a) => [a.data.country, { startAngle: a.startAngle, endAngle: a.endAngle, data: a.data }]),
  )
  const seen = new Set()
  const orderedCountries = []
  for (const a of next.arcs) {
    const c = a.data.country
    if (!seen.has(c)) {
      seen.add(c)
      orderedCountries.push(c)
    }
  }
  for (const a of prev.arcs) {
    const c = a.data.country
    if (!seen.has(c)) {
      seen.add(c)
      orderedCountries.push(c)
    }
  }

  const out = []
  for (const country of orderedCountries) {
    const pa = prevBy.get(country)
    const na = nextBy.get(country)
    const data = na?.data ?? pa?.data
    if (!data) continue

    let s0 = pa?.startAngle
    let e0 = pa?.endAngle
    let s1 = na?.startAngle
    let e1 = na?.endAngle

    if (na && !pa) {
      const mid = (na.startAngle + na.endAngle) / 2
      s0 = mid
      e0 = mid
    }
    if (pa && !na) {
      const mid = (pa.startAngle + pa.endAngle) / 2
      s1 = mid
      e1 = mid
    }

    const startAngle = s0 + (s1 - s0) * te
    const endAngle = e0 + (e1 - e0) * te
    if (endAngle - startAngle < 1e-7) continue

    out.push({
      data,
      value: data.tonnes,
      startAngle,
      endAngle,
      padAngle: 0,
      index: 0,
    })
  }
  out.sort((a, b) => a.startAngle - b.startAngle)
  return out
}

watch(
  selectedDistrictChart,
  (next, prev) => {
    cancelMorphAnimation()
    morphArcs.value = null
    morphCalloutReveal.value = 1
    hoveredCountry.value = ''
    tooltip.value.visible = false

    if (!next) {
      isMorphing.value = false
      return
    }
    if (!prev || prev.district === next.district) {
      isMorphing.value = false
      return
    }

    isMorphing.value = true
    morphCalloutReveal.value = 0
    morphArcs.value = buildMorphArcPayload(prev, next, 0)
    const t0 = performance.now()

    function tick(now) {
      const rawU = Math.min(1, (now - t0) / MORPH_DURATION_MS)
      const te = easeInOutCubic(rawU)
      morphArcs.value = buildMorphArcPayload(prev, next, te)
      morphCalloutReveal.value =
        rawU <= CALLOUT_REVEAL_MORPH_START
          ? 0
          : easeInOutCubic((rawU - CALLOUT_REVEAL_MORPH_START) / (1 - CALLOUT_REVEAL_MORPH_START))
      if (rawU >= 1) {
        morphArcs.value = null
        morphCalloutReveal.value = 1
        isMorphing.value = false
        morphRafId = 0
        return
      }
      morphRafId = requestAnimationFrame(tick)
    }
    morphRafId = requestAnimationFrame(tick)
  },
)

onBeforeUnmount(() => {
  cancelMorphAnimation()
})

const displaySingleArcs = computed(() => {
  if (isMorphing.value) return morphArcs.value ?? selectedDistrictChart.value?.arcs ?? []
  return selectedDistrictChart.value?.arcs ?? []
})

const calloutStrokeReveal = computed(() => (isMorphing.value ? morphCalloutReveal.value : 1))

function sortLegendEntries(a, b) {
  if (a.country.toLowerCase() === 'japan') return -1
  if (b.country.toLowerCase() === 'japan') return 1
  if (a.continent !== b.continent) return a.continent.localeCompare(b.continent)
  return b.tonnes - a.tonnes
}

const legendCountries = computed(() => {
  const rows = filteredImportRows.value.filter((d) => d.district === selectedKey.value)

  const totals = new Map()
  for (const row of rows) {
    totals.set(row.country, (totals.get(row.country) || 0) + row.tonnes)
  }
  return Array.from(totals.entries())
    .map(([country, tonnes]) => ({ country, tonnes, continent: getContinent(country) }))
    .sort(sortLegendEntries)
})

/**
 * One bend only: outer arc → radial bump → straight to dot at label height.
 * horizontalSpan: approximate run from bump toward the label (donut-centered x).
 */
function applyOneTurnLayout(r, labelY, horizontalSpan) {
  const sx = r.onRight ? 1 : -1
  let ex = r.bx + sx * horizontalSpan
  const ey = labelY
  if (!r.onRight) ex = Math.max(ex, CALLOUT_MIN_LEFT_X)
  else ex = Math.min(ex, CALLOUT_MAX_RIGHT_X)
  const dotX = ex
  const dotY = ey
  const textAnchor = r.onRight ? 'start' : 'end'
  const textX = r.onRight ? dotX + CALLOUT_DOT_R + CALLOUT_TEXT_GAP : dotX - CALLOUT_DOT_R - CALLOUT_TEXT_GAP
  return {
    ...r,
    tx: ex,
    elbowY: r.by,
    dotX,
    dotY,
    textX,
    textY: ey,
    textAnchor,
    polylinePoints: `${r.ax},${r.ay} ${r.bx},${r.by} ${ex},${ey}`,
  }
}

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
  const base = {
    country: arcDatum.data.country,
    color: getCountryColor(arcDatum.data.country),
    ux,
    uy,
    ax,
    ay,
    bx,
    by,
    onRight,
    dotR: CALLOUT_DOT_R,
    labelY0: by,
    segment: arcDatum.data,
  }
  return applyOneTurnLayout(base, by, horizontalLen)
}

/** Nudge label Y on each side so stacked callouts do not overlap; rebuild one-turn polylines. */
function packCalloutLabelYs(rows, minGap) {
  const left = rows.filter((r) => !r.onRight)
  const right = rows.filter((r) => r.onRight)
  const placed = new Map()

  for (const group of [left, right]) {
    const sorted = [...group].sort((a, b) => a.labelY0 - b.labelY0)
    let prevY = -Infinity
    for (const r of sorted) {
      const labelY = Math.max(r.labelY0, prevY + minGap)
      prevY = labelY
      placed.set(r.country, labelY)
    }
  }

  return rows.map((r) => {
    const labelY = placed.get(r.country) ?? r.labelY0
    return applyOneTurnLayout(r, labelY, CALLOUT_HORIZONTAL)
  })
}

function measurePolylineLength(pointsStr) {
  const nums = pointsStr
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number)
  let len = 0
  for (let i = 2; i < nums.length; i += 2) {
    len += Math.hypot(nums[i] - nums[i - 2], nums[i + 1] - nums[i - 1])
  }
  return Math.max(len, 1)
}

function buildPackedCallouts(chart) {
  if (!chart?.arcs?.length) return []
  const raw = chart.arcs.map((arcDatum) => ({
    ...calloutForArc(arcDatum, arcGeneratorSingle, SINGLE_OUTER_RADIUS, CALLOUT_RADIAL_BUMP, CALLOUT_HORIZONTAL),
    segment: arcDatum.data,
  }))
  const packed = packCalloutLabelYs(raw, CALLOUT_MIN_LABEL_GAP)
  for (const r of packed) {
    r.lineLength = measurePolylineLength(r.polylinePoints)
  }
  return packed
}

const singleDonutCallouts = computed(() => buildPackedCallouts(selectedDistrictChart.value))

function onArcEnter(event, district, segment) {
  if (isMorphing.value) return
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
  if (isMorphing.value) return
  hoveredCountry.value = country
}

function onLegendLeave() {
  hoveredCountry.value = ''
}

function formatTonnes(value) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

function districtHasCountrySlice(district, country) {
  if (!country || !district?.arcs?.length) return false
  return district.arcs.some((a) => a.data.country === country)
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

    <div class="imports-body imports-body--with-menu">
      <aside class="district-menu" aria-label="Customs district selection">
        <div
          class="district-menu-grid"
          :style="{
            gridTemplateColumns: `repeat(${menuGridLayout.cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${menuGridLayout.rows}, minmax(0, 1fr))`,
          }"
        >
          <button
            v-for="district in districtCharts"
            :key="district.district"
            type="button"
            class="district-menu-card"
            :class="{ 'district-menu-card--active': selectedKey === district.district }"
            :aria-label="`Select ${district.district}, ${formatTonnes(district.totalTonnes)} t total`"
            @click="selectedKey = district.district"
          >
            <div class="district-menu-card__viz">
              <svg
                :viewBox="`0 0 ${GRID_SVG_SIZE} ${GRID_SVG_SIZE}`"
                class="donut-svg donut-svg--menu"
                preserveAspectRatio="xMidYMid meet"
                width="100%"
                height="100%"
                aria-hidden="true"
              >
                <g :transform="`translate(${GRID_CENTER},${GRID_CENTER})`">
                  <path
                    v-for="arcDatum in district.arcs"
                    :key="`${district.district}-${arcDatum.data.country}`"
                    :d="arcGeneratorGrid(arcDatum)"
                    :fill="getCountryColor(arcDatum.data.country)"
                    class="arc-segment arc-segment--menu"
                    :class="{
                      'arc-segment--dimmed':
                        hoveredCountry &&
                        districtHasCountrySlice(district, hoveredCountry) &&
                        hoveredCountry !== arcDatum.data.country,
                      'arc-segment--highlight':
                        hoveredCountry && hoveredCountry === arcDatum.data.country,
                    }"
                  />
                </g>
              </svg>
            </div>
            <span class="district-menu-card__label">
              {{ district.district }}
            </span>
          </button>
        </div>
      </aside>

      <div class="imports-center">
        <template v-if="selectedDistrictChart">
          <article
            class="district-card district-card--single"
            :class="{ 'district-card--morphing': isMorphing }"
          >
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
                  v-for="arcDatum in displaySingleArcs"
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
                  <polyline
                    :points="item.polylinePoints"
                    class="callout-line"
                    fill="none"
                    :stroke="item.color"
                    stroke-linecap="round"
                    :stroke-dasharray="`${item.lineLength} ${item.lineLength}`"
                    :stroke-dashoffset="item.lineLength * (1 - calloutStrokeReveal)"
                  />
                  <circle
                    :cx="item.dotX"
                    :cy="item.dotY"
                    :r="item.dotR"
                    class="callout-dot"
                    :fill="item.color"
                    :opacity="calloutStrokeReveal"
                  />
                  <text
                    :x="item.textX"
                    :y="item.textY"
                    class="callout-text"
                    :text-anchor="item.textAnchor"
                    dominant-baseline="middle"
                    :opacity="calloutStrokeReveal"
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

.imports-body--with-menu {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  align-items: stretch;
  gap: 1rem;
}

.district-menu {
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.district-menu-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  gap: clamp(0.2rem, 1.2vw, 0.45rem);
  align-content: stretch;
  justify-content: stretch;
}

.district-menu-card {
  position: relative;
  display: grid;
  grid-template: 1fr / 1fr;
  place-items: center;
  min-width: 0;
  min-height: 0;
  margin: 0;
  padding: clamp(0.1rem, 0.6vw, 0.2rem);
  border: none;
  border-radius: 0.3rem;
  background: transparent;
  cursor: pointer;
  transition: box-shadow 0.14s ease;
}

.district-menu-card:hover {
  box-shadow: none;
}

.district-menu-card--active {
  box-shadow: inset 0 0 0 2px rgba(12, 74, 110, 0.45);
  border-radius: 0.35rem;
}

.district-menu-card__viz {
  grid-area: 1 / 1;
  z-index: 0;
  width: 100%;
  max-width: 100%;
  max-height: 100%;
  aspect-ratio: 1;
  height: auto;
  justify-self: center;
  align-self: center;
  transition: opacity 0.18s ease;
}

.district-menu-card:hover .district-menu-card__viz {
  opacity: 0.38;
}

.district-menu-card__label {
  grid-area: 1 / 1;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: stretch;
  justify-self: stretch;
  padding: 0.15rem;
  text-align: center;
  font-size: clamp(0.52rem, 2.1vw, 0.72rem);
  font-weight: 600;
  line-height: 1.15;
  color: #0f172a;
  background: none;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.16s ease;
  text-shadow:
    0 0 6px rgba(255, 255, 255, 0.98),
    0 0 14px rgba(255, 255, 255, 0.85),
    0 1px 2px rgba(255, 255, 255, 0.95);
}

.district-menu-card:hover .district-menu-card__label {
  opacity: 1;
}

.donut-svg--menu {
  display: block;
}

.arc-segment--menu {
  pointer-events: none;
}

.arc-segment--menu.arc-segment--highlight {
  stroke-width: 1.65;
}

.imports-center {
  flex: 1;
  min-width: 0;
}

.imports-body--with-menu .imports-center {
  min-width: 0;
}

.district-card--single {
  min-height: auto;
  max-width: 100%;
  margin: 0 auto;
}

.district-card--single .district-title {
  margin-bottom: 0;
}

.district-card--single .district-total {
  margin: 0.2rem 0 0.25rem;
}

.district-card--morphing .arc-segment {
  pointer-events: none;
}

.district-card--morphing .callout-group {
  pointer-events: none;
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
  width: min(100%, 640px);
  max-width: 100%;
  height: auto;
  margin: -5.25rem auto 0;
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
  stroke-width: 2.35;
  stroke-linejoin: round;
  stroke-linecap: round;
  pointer-events: visibleStroke;
}

.callout-dot {
  stroke: rgba(15, 23, 42, 0.25);
  stroke-width: 0.75;
  pointer-events: visibleFill;
}

.callout-text {
  font-size: 15px;
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
  stroke-width: 2.85;
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

@media (max-width: 980px) {
  .country-legend {
    justify-content: flex-start;
  }
}

@media (max-width: 720px) {
  .imports-body {
    flex-direction: column;
  }

  .imports-body--with-menu {
    grid-template-columns: 1fr;
  }

  .district-menu {
    width: 100%;
  }

  .district-menu-grid {
    flex: none;
    min-height: auto;
    grid-template-columns: repeat(auto-fill, minmax(3.4rem, 1fr)) !important;
    grid-template-rows: none !important;
    grid-auto-rows: minmax(3.25rem, auto);
    gap: 0.35rem;
  }
}
</style>

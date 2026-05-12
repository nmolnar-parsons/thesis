<script setup>
import { arc, pie } from 'd3-shape'
import { csvParse } from 'd3-dsv'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import csvRaw from '../data/tuna_imports_usa_customs.csv?raw'
import { readStoryScale } from '../utils/readStoryScale.js'
import {
  CONTINENT_ORDER,
  buildCountryColorMapForSubset,
  getColorFromMap,
  getContinent,
} from './countryContinentColors.js'

const YEAR_TARGET = 2025
const BLUEFIN_PRODUCT = 'Tuna Bluefin Fresh'
const MIN_DISTRICT_TONNES = 10
const GRID_OUTER_RADIUS = 40
const GRID_INNER_RADIUS = 22
const GRID_SVG_SIZE = 97

const SINGLE_OUTER_RADIUS = 137
const SINGLE_INNER_RADIUS = 76
const SINGLE_SVG_SIZE = 576

/** Radial bump from arc, then one straight segment to label (single bend). Donut-centered coords. */
const CALLOUT_RADIAL_BUMP = 27
/** How far out labels sit from donut edge along slice direction */
const CALLOUT_LABEL_RADIUS = SINGLE_OUTER_RADIUS + 45
const CALLOUT_DOT_R = 5
const CALLOUT_TEXT_GAP = 13
const CALLOUT_VERTICAL_GAP = 25
const CALLOUT_REVEAL_DURATION_MS = 440
/** Same radial offset above/below y=0: label dots sit on ±(outer+bump+pad) from donut center */
const CALLOUT_AXIS_PAD = 23

const NYC_DISTRICT_KEY = 'New York, NY'

const hoveredCountry = ref('')
const selectedKey = ref(NYC_DISTRICT_KEY)
const visualScale = ref(1)

const tooltip = ref({
  visible: false,
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

const continentRank = new Map(CONTINENT_ORDER.map((continent, index) => [continent, index]))

const pieGenerator = pie()
  .sort((a, b) => {
    const aContinent = getContinent(a.country)
    const bContinent = getContinent(b.country)
    const aRank = continentRank.get(aContinent) ?? Number.MAX_SAFE_INTEGER
    const bRank = continentRank.get(bContinent) ?? Number.MAX_SAFE_INTEGER
    if (aRank !== bRank) return aRank - bRank
    return a.country.localeCompare(b.country)
  })
  .value((d) => d.tonnes)

const donutGeometry = computed(() => {
  const scale = visualScale.value
  const singleOuterRadius = SINGLE_OUTER_RADIUS * scale
  const singleInnerRadius = SINGLE_INNER_RADIUS * scale
  const calloutRadialBump = CALLOUT_RADIAL_BUMP * scale
  const calloutAxisPad = CALLOUT_AXIS_PAD * scale
  const topCalloutAnchorY = -(singleOuterRadius + calloutRadialBump + calloutAxisPad)
  const bottomCalloutAnchorY = singleOuterRadius + calloutRadialBump + calloutAxisPad

  return {
    gridSvgSize: GRID_SVG_SIZE * scale,
    gridCenter: (GRID_SVG_SIZE * scale) / 2,
    singleSvgSize: SINGLE_SVG_SIZE * scale,
    singleCenter: (SINGLE_SVG_SIZE * scale) / 2,
    singleOuterRadius,
    calloutLabelRadius: CALLOUT_LABEL_RADIUS * scale,
    calloutDotR: CALLOUT_DOT_R * scale,
    calloutTextGap: CALLOUT_TEXT_GAP * scale,
    calloutVerticalGap: CALLOUT_VERTICAL_GAP * scale,
    topCalloutAnchorY,
    bottomCalloutAnchorY,
    calloutVerticalBand: bottomCalloutAnchorY - topCalloutAnchorY,
    arcGeneratorGrid: arc()
      .innerRadius(GRID_INNER_RADIUS * scale)
      .outerRadius(GRID_OUTER_RADIUS * scale),
    arcGeneratorSingle: arc()
      .innerRadius(singleInnerRadius)
      .outerRadius(singleOuterRadius),
    outerArcGeneratorSingle: arc()
      .innerRadius(singleOuterRadius + calloutRadialBump)
      .outerRadius(singleOuterRadius + calloutRadialBump),
  }
})

const arcGeneratorGrid = computed(() => donutGeometry.value.arcGeneratorGrid)
const arcGeneratorSingle = computed(() => donutGeometry.value.arcGeneratorSingle)

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
    .filter((e) => e.totalTonnes >= MIN_DISTRICT_TONNES)
    .map(chartFromDistrictEntry)
    .sort((a, b) => b.totalTonnes - a.totalTonnes)
})

/** Union of all country strings in the donuts view — subset palette is built from this only. */
const donutCountriesInVisual = computed(() => {
  const set = new Set()
  for (const chart of districtCharts.value) {
    for (const seg of chart.segments) set.add(seg.country)
  }
  return [...set]
})

const donutCountryColorMap = computed(() => buildCountryColorMapForSubset(donutCountriesInVisual.value))

function colorForCountry(country) {
  return getColorFromMap(donutCountryColorMap.value, country)
}

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

watch(selectedDistrictChart, () => {
  hoveredCountry.value = ''
  tooltip.value.visible = false
})

const calloutReveal = ref(1)
/** True while waiting for donut fade-in to finish before running label reveal */
const pendingDonutCalloutReveal = ref(false)
let calloutRafId = 0

function syncVisualScale() {
  visualScale.value = readStoryScale(document.documentElement)
}

function cancelCalloutReveal() {
  if (calloutRafId) {
    cancelAnimationFrame(calloutRafId)
    calloutRafId = 0
  }
}

function easeCubicInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2
}

function startCalloutReveal() {
  cancelCalloutReveal()
  calloutReveal.value = 0
  const t0 = performance.now()
  function tick(now) {
    const u = Math.min(1, (now - t0) / CALLOUT_REVEAL_DURATION_MS)
    calloutReveal.value = easeCubicInOut(u)
    if (u >= 1) {
      calloutRafId = 0
      return
    }
    calloutRafId = requestAnimationFrame(tick)
  }
  calloutRafId = requestAnimationFrame(tick)
}

watch(
  selectedDistrictChart,
  (next, prev) => {
    cancelCalloutReveal()
    if (!next) {
      calloutReveal.value = 0
      pendingDonutCalloutReveal.value = false
      return
    }
    if (!prev || next.district === prev.district) {
      calloutReveal.value = 1
      pendingDonutCalloutReveal.value = false
      return
    }
    calloutReveal.value = 0
    pendingDonutCalloutReveal.value = true
  },
)

function onDonutArcsAfterEnter() {
  if (!pendingDonutCalloutReveal.value) return
  pendingDonutCalloutReveal.value = false
  startCalloutReveal()
}

onMounted(() => {
  syncVisualScale()
  window.addEventListener('resize', syncVisualScale)
})

onBeforeUnmount(() => {
  cancelCalloutReveal()
  window.removeEventListener('resize', syncVisualScale)
})

function midAngle(arcDatum) {
  return arcDatum.startAngle + (arcDatum.endAngle - arcDatum.startAngle) / 2
}

/** Observable-style callout geometry: arc centroid -> outerArc centroid -> side anchor. */
function calloutForArc(arcDatum, arcGen, outerArcGen) {
  const geom = donutGeometry.value
  const [cx, cy] = arcGen.centroid(arcDatum)
  const clen = Math.hypot(cx, cy) || 1
  const ax = (cx / clen) * geom.singleOuterRadius
  const ay = (cy / clen) * geom.singleOuterRadius
  const [bxRaw, byRaw] = outerArcGen.centroid(arcDatum)
  const side = midAngle(arcDatum) < Math.PI ? 1 : -1
  const dotX = geom.calloutLabelRadius * side
  const dotY = byRaw
  const by = dotY
  const bx = bxRaw
  const textX = dotX + side * (geom.calloutDotR + geom.calloutTextGap)
  const textY = dotY

  return {
    country: arcDatum.data.country,
    color: colorForCountry(arcDatum.data.country),
    side,
    dotR: geom.calloutDotR,
    ax,
    ay,
    bx,
    by,
    dotX,
    dotY,
    textX,
    textY,
    textAnchor: side > 0 ? 'start' : 'end',
    polylinePoints: `${ax},${ay} ${bx},${by} ${dotX},${dotY}`,
    segment: arcDatum.data,
  }
}

function applyVerticalPadding(rows) {
  const calloutVerticalGap = donutGeometry.value.calloutVerticalGap
  const out = rows.map((r) => ({ ...r }))
  for (const side of [-1, 1]) {
    const sideRows = out
      .filter((r) => r.side === side)
      .sort((a, b) => a.dotY - b.dotY)
    if (!sideRows.length) continue
    const originalYs = sideRows.map((r) => r.dotY)

    for (let i = 1; i < sideRows.length; i += 1) {
      const prev = sideRows[i - 1]
      const curr = sideRows[i]
      if (curr.dotY - prev.dotY < calloutVerticalGap) {
        curr.dotY = prev.dotY + calloutVerticalGap
      }
    }

    for (let i = sideRows.length - 2; i >= 0; i -= 1) {
      const next = sideRows[i + 1]
      const curr = sideRows[i]
      if (next.dotY - curr.dotY < calloutVerticalGap) {
        curr.dotY = next.dotY - calloutVerticalGap
      }
    }

    const targetCenter = originalYs.reduce((sum, y) => sum + y, 0) / originalYs.length
    const currentCenter = sideRows.reduce((sum, r) => sum + r.dotY, 0) / sideRows.length
    const centerShift = targetCenter - currentCenter
    for (const row of sideRows) {
      row.dotY += centerShift
      row.by = row.dotY
      row.textY = row.dotY
      row.polylinePoints = `${row.ax},${row.ay} ${row.bx},${row.by} ${row.dotX},${row.dotY}`
    }
  }
  return out
}

function shiftCalloutRowY(row, dy) {
  row.dotY += dy
  row.by = row.dotY
  row.textY = row.dotY
  row.polylinePoints = `${row.ax},${row.ay} ${row.bx},${row.by} ${row.dotX},${row.dotY}`
}

/**
 * When left and right each have at least one callout above donut midline (dotY < 0), align the topmost
 * upper callout on each side to the same y. Skips when a side has no upper labels (avoids Houston-style skew).
 */
function alignLeftRightTopHemisphereCalloutTops(rows) {
  if (!rows.length) return rows
  const out = rows.map((r) => ({ ...r }))
  const leftTop = out.filter((r) => r.side === -1 && r.dotY < 0)
  const rightTop = out.filter((r) => r.side === 1 && r.dotY < 0)
  if (!leftTop.length || !rightTop.length) return out
  const minL = Math.min(...leftTop.map((r) => r.dotY))
  const minR = Math.min(...rightTop.map((r) => r.dotY))
  const yTop = Math.min(minL, minR)
  for (const r of out.filter((x) => x.side === -1)) shiftCalloutRowY(r, yTop - minL)
  for (const r of out.filter((x) => x.side === 1)) shiftCalloutRowY(r, yTop - minR)
  return out
}

/** Scale label dotY about stack midpoint so span matches symmetric band (then bottom pin hits both anchors). */
function scaleCalloutRowsToVerticalBand(rows, band) {
  if (!rows.length) return rows
  const out = rows.map((r) => ({ ...r }))
  const globalMin = Math.min(...out.map((r) => r.dotY))
  const globalMax = Math.max(...out.map((r) => r.dotY))
  const span = globalMax - globalMin
  if (out.length <= 1 || span <= 1e-6 || span >= band - 1e-6) return out
  const mid = (globalMin + globalMax) / 2
  const scale = band / span
  for (const r of out) {
    r.dotY = mid + (r.dotY - mid) * scale
    r.by = r.dotY
    r.textY = r.dotY
    r.polylinePoints = `${r.ax},${r.ay} ${r.bx},${r.by} ${r.dotX},${r.dotY}`
  }
  return out
}

/**
 * Pin bottom row to BOTTOM anchor. If stack is taller than the band, floor the top at TOP anchor.
 * Pairs with scaleCalloutRowsToVerticalBand: after scaling, span ≈ band so one bottom pin sets min=TOP and max=BOTTOM.
 */
function pinCalloutsInVerticalBand(rows) {
  if (!rows.length) return rows
  const geom = donutGeometry.value
  const out = rows.map((r) => ({ ...r }))
  const globalMin = Math.min(...out.map((r) => r.dotY))
  const globalMax = Math.max(...out.map((r) => r.dotY))
  let pinShift = geom.bottomCalloutAnchorY - globalMax
  if (globalMin + pinShift < geom.topCalloutAnchorY) {
    pinShift = geom.topCalloutAnchorY - globalMin
  }
  if (Math.abs(pinShift) > 1e-6) {
    for (const r of out) shiftCalloutRowY(r, pinShift)
  }
  return out
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
  const packed = chart.arcs.map((arcDatum) => ({
    ...calloutForArc(
      arcDatum,
      donutGeometry.value.arcGeneratorSingle,
      donutGeometry.value.outerArcGeneratorSingle,
    ),
    segment: arcDatum.data,
  }))
  let out = applyVerticalPadding(packed)
  out = alignLeftRightTopHemisphereCalloutTops(out)
  out = scaleCalloutRowsToVerticalBand(out, donutGeometry.value.calloutVerticalBand)
  out = pinCalloutsInVerticalBand(out)
  for (const r of out) {
    r.lineLength = measurePolylineLength(r.polylinePoints)
  }
  return out
}

const singleDonutCallouts = computed(() => {
  const district = selectedDistrictChart.value
  if (!district) return []
  return buildPackedCallouts(district)
})
const centerTooltipCountry = computed(() =>
  tooltip.value.visible ? tooltip.value.country : '',
)
const centerTooltipDetail = computed(() => {
  if (tooltip.value.visible) {
    return `${tooltip.value.percent.toFixed(1)}% · ${formatTonnes(tooltip.value.tonnes)} t`
  }
  return ''
})
const importsTitleReference = 'Where Does New York Buy Bluefin?'
const importsTitleCity = computed(() =>
  selectedDistrictChart.value
    ? formatDistrictCity(selectedDistrictChart.value.district)
    : formatDistrictCity(selectedKey.value),
)

function onArcEnter(district, segment) {
  hoveredCountry.value = segment.country
  tooltip.value = {
    visible: true,
    country: segment.country,
    district: district.district,
    percent: segment.percent,
    tonnes: segment.tonnes,
  }
}

function onArcLeave() {
  hoveredCountry.value = ''
  tooltip.value.visible = false
}

function formatTonnes(value) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

function formatDistrictCity(district) {
  return district.split(',')[0]?.trim() || district
}

function districtHasCountrySlice(district, country) {
  if (!country || !district?.arcs?.length) return false
  return district.arcs.some((a) => a.data.country === country)
}
</script>

<template>
  <div class="imports-wrap">
    <h1 class="visual-title imports-title">
      <span class="imports-title-anchor">
        <span class="imports-title-reference" aria-hidden="true">{{ importsTitleReference }}</span>
        <span class="imports-title-text">
          Where Does <span class="imports-title-city">{{ importsTitleCity }}</span> Buy Bluefin?
        </span>
      </span>
    </h1>
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
            :class="{
              'district-menu-card--active': selectedKey === district.district,
              'district-menu-card--country-highlight':
                hoveredCountry && districtHasCountrySlice(district, hoveredCountry),
              'district-menu-card--country-muted':
                hoveredCountry && !districtHasCountrySlice(district, hoveredCountry),
            }"
            :aria-label="`Select ${district.district}, ${formatTonnes(district.totalTonnes)} t total`"
            @click="selectedKey = district.district"
          >
            <div class="district-menu-card__viz">
              <svg
                :viewBox="`0 0 ${donutGeometry.gridSvgSize} ${donutGeometry.gridSvgSize}`"
                class="donut-svg donut-svg--menu"
                preserveAspectRatio="xMidYMid meet"
                width="100%"
                height="100%"
                aria-hidden="true"
              >
                <g :transform="`translate(${donutGeometry.gridCenter},${donutGeometry.gridCenter})`">
                  <path
                    v-for="arcDatum in district.arcs"
                    :key="`${district.district}-${arcDatum.data.country}`"
                    :d="arcGeneratorGrid(arcDatum)"
                    :fill="colorForCountry(arcDatum.data.country)"
                    class="arc-segment arc-segment--menu"
                    :class="{
                      'arc-segment--dimmed':
                        hoveredCountry && hoveredCountry !== arcDatum.data.country,
                      'arc-segment--highlight':
                        hoveredCountry && hoveredCountry === arcDatum.data.country,
                    }"
                  />
                </g>
              </svg>
            </div>
            <span class="district-menu-card__label">
              {{ formatDistrictCity(district.district) }}
            </span>
          </button>
        </div>
      </aside>

      <div class="imports-center">
        <template v-if="selectedDistrictChart">
          <article
            class="district-card district-card--single"
          >
            <div class="district-single-stack">
              <h3
                class="district-heading-over-donut district-heading-over-donut--float"
              >
                <span class="district-heading-over-donut__name">{{ selectedDistrictChart.district }}</span>
                <span class="district-heading-over-donut__tonnes">
                  {{ formatTonnes(selectedDistrictChart.totalTonnes) }} tonnes total
                </span>
              </h3>
              <div class="district-donut-stage">
                <svg
                  :width="donutGeometry.singleSvgSize"
                  :height="donutGeometry.singleSvgSize"
                  :viewBox="`0 0 ${donutGeometry.singleSvgSize} ${donutGeometry.singleSvgSize}`"
                  class="donut-svg donut-svg--single"
                >
                  <g :transform="`translate(${donutGeometry.singleCenter},${donutGeometry.singleCenter})`">
                <Transition name="donut-fade" mode="out-in" @after-enter="onDonutArcsAfterEnter">
                  <g :key="selectedDistrictChart.district" class="donut-arcs">
                    <path
                      v-for="arcDatum in selectedDistrictChart.arcs"
                      :key="`${selectedDistrictChart.district}-${arcDatum.data.country}`"
                      :d="arcGeneratorSingle(arcDatum)"
                      :fill="colorForCountry(arcDatum.data.country)"
                      class="arc-segment"
                      :class="{
                        'arc-segment--dimmed':
                          hoveredCountry && hoveredCountry !== arcDatum.data.country,
                        'arc-segment--highlight':
                          hoveredCountry && hoveredCountry === arcDatum.data.country,
                      }"
                      @mouseenter="onArcEnter(selectedDistrictChart, arcDatum.data)"
                      @mouseleave="onArcLeave"
                    />
                  </g>
                </Transition>
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
                  @mouseenter="onArcEnter(selectedDistrictChart, item.segment)"
                  @mouseleave="onArcLeave"
                >
                  <polyline
                    :points="item.polylinePoints"
                    class="callout-line"
                    fill="none"
                    :stroke="item.color"
                    stroke-linecap="round"
                    :stroke-dasharray="`${item.lineLength} ${item.lineLength}`"
                    :stroke-dashoffset="item.lineLength * (1 - calloutReveal)"
                  />
                  <circle
                    :cx="item.dotX"
                    :cy="item.dotY"
                    :r="item.dotR"
                    class="callout-dot"
                    :fill="item.color"
                    :opacity="calloutReveal"
                  />
                  <text
                    :x="item.textX"
                    :y="item.textY"
                    class="callout-label"
                    :text-anchor="item.textAnchor"
                    dominant-baseline="middle"
                    :opacity="calloutReveal"
                  >
                    {{ item.country }}
                  </text>
                </g>
                <g class="center-tooltip">
                  <text
                    x="0"
                    y="-8"
                    class="center-tooltip__country"
                    text-anchor="middle"
                  >
                    {{ centerTooltipCountry }}
                  </text>
                  <text
                    x="0"
                    y="14"
                    class="center-tooltip__detail"
                    text-anchor="middle"
                  >
                    {{ centerTooltipDetail }}
                  </text>
                </g>
                  </g>
                </svg>
              </div>
            </div>
          </article>
        </template>
      </div>

    </div>
  </div>
</template>

<style scoped>
.imports-wrap {
  --district-menu-card-padding: clamp(0.1rem, 0.6vw, 0.2rem);

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

.imports-title {
  flex-shrink: 0;
  margin-bottom: var(--space-visual-title-gap);
}

.imports-title-anchor {
  position: relative;
  display: inline-block;
  text-align: left;
  white-space: nowrap;
}

.imports-title-reference {
  visibility: hidden;
}

.imports-title-text {
  position: absolute;
  top: 0;
  left: 0;
}

.imports-title-city {
  text-decoration: underline;
  text-decoration-thickness: 0.06em;
  text-underline-offset: 0.08em;
}

.imports-body {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  flex: 1;
  min-height: 0;
  width: 100%;
  max-width: min(86.4vw, calc(1584px * var(--story-scale)));
  margin: 0 auto;
}

.imports-body--with-menu {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: stretch;
  gap: 0;
}

.district-menu {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 0;
  align-self: stretch;
  height: 100%;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.5);
}

.district-menu-grid {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  display: grid;
  column-gap: clamp(0.2rem, 1.2vw, 0.45rem);
  row-gap: clamp(0.55rem, 1.5vw, 0.9rem);
  align-content: stretch;
  justify-content: stretch;
}

.district-menu-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
  min-width: 0;
  min-height: 0;
  margin: 0;
  padding: var(--district-menu-card-padding);
  border: none;
  border-radius: 0.3rem;
  background: transparent;
  cursor: pointer;
  transition: box-shadow 0.14s ease;
}

.district-menu-card:not(.district-menu-card--active):hover {
  box-shadow: none;
}

.district-menu-card--active {
  box-shadow: inset 0 0 0 2px rgba(12, 74, 110, 0.45);
  border-radius: 0.35rem;
}

.district-menu-card__viz {
  flex: 0 1 auto;
  min-height: 0;
  width: 100%;
  max-width: 100%;
  max-height: 100%;
  aspect-ratio: 1;
  height: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  justify-self: center;
  align-self: center;
  transition: opacity 0.18s ease;
}

.district-menu-card__label {
  display: block;
  flex: 0 0 auto;
  max-width: 100%;
  padding: 0;
  text-align: center;
  font-size: var(--font-size-ui);
  font-weight: var(--font-weight-ui);
  line-height: 1.15;
  color: #0f172a;
  background: none;
  opacity: 0.32;
  pointer-events: none;
  transition: opacity 0.16s ease;
}

.district-menu-card:hover .district-menu-card__label,
.district-menu-card:focus-visible .district-menu-card__label,
.district-menu-card--active .district-menu-card__label,
.district-menu-card--country-highlight .district-menu-card__label {
  opacity: 1;
}

.district-menu-card--country-muted .district-menu-card__label {
  opacity: 0.32;
}

.district-menu-card--active.district-menu-card--country-muted .district-menu-card__label {
  opacity: 1;
}

.donut-svg--menu {
  display: block;
}

.arc-segment--menu {
  pointer-events: none;
}

.arc-segment--menu.arc-segment--highlight {
  stroke-width: calc(1.65px * var(--story-scale));
}

.imports-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: stretch;
  min-width: 0;
  min-height: 0;
  align-self: stretch;
  height: 100%;
  padding: 0.5rem 0.65rem 0.5rem;
  background: rgba(255, 255, 255, 0.35);
}

.imports-body--with-menu .imports-center {
  min-width: 0;
}

.district-card--single {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
  max-width: 100%;
  margin: 0;
}

.district-single-stack {
  --district-display-label-space: clamp(2.25rem, 6.2vw, 2.8rem);

  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  align-items: center;
  width: 100%;
  max-width: min(100%, calc(1000px * var(--story-scale)));
  margin-inline: auto;
  padding-bottom: var(--district-display-label-space);
}

.district-heading-over-donut--float {
  position: absolute;
  top: auto;
  left: 0;
  right: 0;
  bottom: var(--district-menu-card-padding);
  margin: 0;
  z-index: 1;
  pointer-events: none;
}

.district-donut-stage {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  transform: translateY(calc(var(--district-display-label-space) / 2));
}

.district-heading-over-donut {
  flex-shrink: 0;
  margin: 0;
  width: 100%;
  text-align: center;
  font-size: var(--font-size-axis-title);
  font-weight: var(--font-weight-ui);
  line-height: 1.25;
  color: #0f172a;
}

.district-heading-over-donut__name {
  display: block;
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(100% + 0.15rem);
}

.district-heading-over-donut__tonnes {
  display: block;
  margin-top: 0;
  font-size: var(--font-size-axis-title);
  font-weight: var(--font-weight-ui);
  color: #475569;
}

.donut-svg {
  overflow: visible;
}

.donut-svg--single {
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 100%;
  margin: 0;
}

.donut-fade-enter-active,
.donut-fade-leave-active {
  transition: opacity 0.34s ease;
}

.donut-fade-enter-from,
.donut-fade-leave-to {
  opacity: 0;
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
  stroke-width: calc(1.1px * var(--story-scale));
}

.callout-group {
  cursor: pointer;
  pointer-events: all;
  transition: opacity 0.16s ease;
}

.callout-line {
  stroke-width: calc(2.35px * var(--story-scale));
  stroke-linejoin: round;
  stroke-linecap: round;
  pointer-events: visibleStroke;
}

.callout-dot {
  stroke: rgba(15, 23, 42, 0.25);
  stroke-width: calc(0.75px * var(--story-scale));
  pointer-events: visibleFill;
}

.callout-label {
  fill: #0f172a;
  font-size: 1rem;
  font-weight: 600;
  paint-order: stroke;
  stroke: rgba(255, 255, 255, 0.96);
  stroke-width: calc(2.25px * var(--story-scale));
  stroke-linejoin: round;
  pointer-events: none;
}

.callout-group--dimmed {
  opacity: 0.22;
}

.callout-group--highlight {
  opacity: 1;
}

.callout-group--highlight .callout-line {
  stroke-width: calc(2.85px * var(--story-scale));
}

.center-tooltip {
  pointer-events: none;
}

.center-tooltip__country {
  font-size: 1.05rem;
  font-weight: 700;
  fill: #0f172a;
}

.center-tooltip__detail {
  font-size: 0.84rem;
  font-weight: 600;
  fill: #334155;
}

.center-tooltip text {
  paint-order: stroke;
  stroke: rgba(255, 255, 255, 0.96);
  stroke-width: calc(3px * var(--story-scale));
  stroke-linejoin: round;
}

@media (min-width: 1600px) {
  .district-menu-grid {
    column-gap: clamp(0.35rem, 1.4vw, 0.7rem);
    row-gap: clamp(0.75rem, 1.7vw, 1.1rem);
  }
}

@media (max-width: 720px) {
  .imports-body {
    flex-direction: column;
  }

  .imports-body--with-menu {
    grid-template-columns: 1fr;
    gap: 0.6rem;
  }

  .district-menu {
    width: 100%;
  }

  .district-menu-grid {
    flex: none;
    min-height: auto;
    height: auto;
    grid-template-columns: repeat(auto-fill, minmax(3.4rem, 1fr)) !important;
    grid-template-rows: none !important;
    grid-auto-rows: minmax(4rem, auto);
    gap: 0.5rem 0.35rem;
  }

  .imports-center {
    border-radius: 0;
  }
}
</style>

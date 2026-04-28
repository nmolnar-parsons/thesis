<script setup>
import { arc, pie } from 'd3-shape'
import { csvParse } from 'd3-dsv'
import { scaleOrdinal } from 'd3-scale'
import { schemeTableau10 } from 'd3-scale-chromatic'
import { computed, ref } from 'vue'
import csvRaw from '../data/tuna_imports_usa_customs.csv?raw'

const YEAR_TARGET = 2025
const BLUEFIN_PRODUCT = 'Tuna Bluefin Fresh'
const MIN_DISTRICT_TONNES = 10
const JAPAN_RED = '#d32f2f'
const OUTER_RADIUS = 62
const INNER_RADIUS = 34
const SVG_SIZE = 150
const SVG_CENTER = SVG_SIZE / 2

const hoveredCountry = ref('')
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

const countryDomain = Array.from(new Set(parsedRows.map((d) => d.country))).sort()
const colorScale = scaleOrdinal(schemeTableau10).domain(countryDomain)
const pieGenerator = pie()
  .sort((a, b) => b.tonnes - a.tonnes)
  .value((d) => d.tonnes)
const arcGenerator = arc().innerRadius(INNER_RADIUS).outerRadius(OUTER_RADIUS)

const districtCharts = computed(() => {
  const filtered = parsedRows.filter((d) => d.year === YEAR_TARGET && d.productName === BLUEFIN_PRODUCT)
  const districtMap = new Map()

  for (const row of filtered) {
    if (!districtMap.has(row.district)) {
      districtMap.set(row.district, { district: row.district, totalTonnes: 0, countries: new Map() })
    }

    const districtEntry = districtMap.get(row.district)
    districtEntry.totalTonnes += row.tonnes
    districtEntry.countries.set(row.country, (districtEntry.countries.get(row.country) || 0) + row.tonnes)
  }

  return Array.from(districtMap.values())
    .filter((districtEntry) => districtEntry.totalTonnes >= MIN_DISTRICT_TONNES)
    .map((districtEntry) => {
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
    })
    .sort((a, b) => b.totalTonnes - a.totalTonnes)
})

function getCountryColor(country) {
  if (country.toLowerCase() === 'japan') return JAPAN_RED
  return colorScale(country)
}

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

function formatTonnes(value) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 })
}
</script>

<template>
  <div class="imports-wrap">
    <p class="imports-label">Bluefin imports by U.S. customs district (2025)</p>

    <div class="district-grid">
      <article v-for="district in districtCharts" :key="district.district" class="district-card">
        <h3 class="district-title">{{ district.district }}</h3>
        <p class="district-total">{{ formatTonnes(district.totalTonnes) }} t total</p>

        <svg :width="SVG_SIZE" :height="SVG_SIZE" viewBox="0 0 150 150" class="donut-svg">
          <g :transform="`translate(${SVG_CENTER},${SVG_CENTER})`">
            <path
              v-for="arcDatum in district.arcs"
              :key="`${district.district}-${arcDatum.data.country}`"
              :d="arcGenerator(arcDatum)"
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

.district-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.85rem;
  max-width: 1180px;
  margin: 0 auto;
}

.district-card {
  padding: 0.25rem 0.35rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 210px;
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
}

@media (max-width: 720px) {
  .district-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

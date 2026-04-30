<script setup>
import { arc, pie } from 'd3-shape'
import { csvParse } from 'd3-dsv'
import { computed, ref } from 'vue'
import csvRaw from '../data/tuna_imports_usa_customs.csv?raw'

const YEAR_TARGET = 2025
const BLUEFIN_PRODUCT = 'Tuna Bluefin Fresh'
const MIN_DISTRICT_TONNES = 10
const JAPAN_RED = '#d32f2f'
const CONTINENT_COLORS = {
  Asia: ['#ef9a9a', '#ef5350', '#e53935', '#c62828', '#b71c1c'],
  Europe: ['#c8e6c9', '#81c784', '#4caf50', '#2e7d32', '#1b5e20'],
  Americas: ['#bbdefb', '#64b5f6', '#1e88e5', '#1565c0', '#0d47a1'],
  Africa: ['#ffe0b2', '#ffb74d', '#fb8c00', '#ef6c00', '#e65100'],
  Oceania: ['#f8bbd0', '#f48fb1', '#ec407a', '#d81b60', '#ad1457'],
  Other: ['#e5e7eb', '#cbd5e1', '#94a3b8', '#64748b', '#475569'],
}
const COUNTRY_COLOR_OVERRIDES = {
  'South Africa': '#fb8c00',
  Australia: '#ec407a',
  'New Zealand': '#f48fb1',
}
const COUNTRY_TO_CONTINENT = {
  Japan: 'Asia',
  China: 'Asia',
  'South Korea': 'Asia',
  Korea: 'Asia',
  Taiwan: 'Asia',
  Vietnam: 'Asia',
  Indonesia: 'Asia',
  Philippines: 'Asia',
  Thailand: 'Asia',
  India: 'Asia',
  Sri_Lanka: 'Asia',
  Turkey: 'Europe',
  Spain: 'Europe',
  Italy: 'Europe',
  France: 'Europe',
  Greece: 'Europe',
  Croatia: 'Europe',
  Malta: 'Europe',
  Portugal: 'Europe',
  Albania: 'Europe',
  Norway: 'Europe',
  Mexico: 'Americas',
  Ecuador: 'Americas',
  Panama: 'Americas',
  Peru: 'Americas',
  Chile: 'Americas',
  Canada: 'Americas',
  USA: 'Americas',
  'United States': 'Americas',
  Morocco: 'Africa',
  'South Africa': 'Africa',
  Tunisia: 'Africa',
  Libya: 'Africa',
  Egypt: 'Africa',
  Seychelles: 'Africa',
  Australia: 'Oceania',
  'New Zealand': 'Oceania',
  Fiji: 'Oceania',
}
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

const pieGenerator = pie()
  .sort((a, b) => b.tonnes - a.tonnes)
  .value((d) => d.tonnes)
const arcGenerator = arc().innerRadius(INNER_RADIUS).outerRadius(OUTER_RADIUS)

function normalizeCountry(country) {
  return country.replace(/\./g, '').replace(/\s+/g, ' ').trim()
}

function getContinent(country) {
  const normalized = normalizeCountry(country)
  const key = normalized.replace(/\s+/g, '_')
  return COUNTRY_TO_CONTINENT[normalized] || COUNTRY_TO_CONTINENT[key] || 'Other'
}

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

  const allDistricts = Array.from(districtMap.values())
  const majorDistricts = allDistricts.filter((districtEntry) => districtEntry.totalTonnes >= MIN_DISTRICT_TONNES)
  const minorDistricts = allDistricts.filter((districtEntry) => districtEntry.totalTonnes < MIN_DISTRICT_TONNES)

  const charts = majorDistricts
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

  if (minorDistricts.length) {
    const otherCountries = new Map()
    let otherTotal = 0
    for (const districtEntry of minorDistricts) {
      otherTotal += districtEntry.totalTonnes
      for (const [country, tonnes] of districtEntry.countries.entries()) {
        otherCountries.set(country, (otherCountries.get(country) || 0) + tonnes)
      }
    }

    const otherSegments = Array.from(otherCountries.entries())
      .map(([country, tonnes]) => ({
        country,
        tonnes,
        percent: otherTotal > 0 ? (tonnes / otherTotal) * 100 : 0,
      }))
      .sort((a, b) => b.tonnes - a.tonnes)

    charts.push({
      district: 'Other',
      totalTonnes: otherTotal,
      segments: otherSegments,
      arcs: pieGenerator(otherSegments),
    })
  }

  return charts
})

const legendCountries = computed(() => {
  const filtered = parsedRows.filter((d) => d.year === YEAR_TARGET && d.productName === BLUEFIN_PRODUCT)
  const totals = new Map()
  for (const row of filtered) {
    totals.set(row.country, (totals.get(row.country) || 0) + row.tonnes)
  }
  return Array.from(totals.entries())
    .map(([country, tonnes]) => ({ country, tonnes, continent: getContinent(country) }))
    .sort((a, b) => {
      if (a.country.toLowerCase() === 'japan') return -1
      if (b.country.toLowerCase() === 'japan') return 1
      if (a.continent !== b.continent) return a.continent.localeCompare(b.continent)
      return b.tonnes - a.tonnes
    })
})

const countryColorMap = computed(() => {
  const byContinent = new Map()
  const map = new Map()
  for (const entry of legendCountries.value) {
    const c = entry.country
    if (c.toLowerCase() === 'japan') {
      map.set(c, JAPAN_RED)
      continue
    }
    const continent = entry.continent
    const list = byContinent.get(continent) || []
    list.push(c)
    byContinent.set(continent, list)
  }
  for (const [continent, countries] of byContinent.entries()) {
    const palette = CONTINENT_COLORS[continent] || CONTINENT_COLORS.Other
    const denom = Math.max(1, countries.length - 1)
    countries.forEach((country, index) => {
      const paletteIndex = Math.round((index / denom) * (palette.length - 1))
      map.set(country, palette[paletteIndex])
    })
  }
  return map
})

function getCountryColor(country) {
  if (COUNTRY_COLOR_OVERRIDES[country]) return COUNTRY_COLOR_OVERRIDES[country]
  return countryColorMap.value.get(country) || CONTINENT_COLORS.Other[2]
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

  .country-legend {
    justify-content: flex-start;
  }
}

@media (max-width: 720px) {
  .district-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

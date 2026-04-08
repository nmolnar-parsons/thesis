<script setup>
import { axisBottom, axisLeft } from 'd3-axis'
import { scaleBand, scaleLinear } from 'd3-scale'
import { select } from 'd3-selection'
import 'd3-transition'
import { computed, onMounted, ref, watch } from 'vue'

const props = defineProps({
  activeIndex: { type: Number, default: 0 },
})

const hostRef = ref(null)

const data = [
  { label: 'Japan', value: 74 },
  { label: 'US', value: 52 },
  { label: 'Spain', value: 38 },
  { label: 'China', value: 61 },
]

const steppedData = computed(() => {
  const multiplier = 0.8 + props.activeIndex * 0.12
  return data.map((d) => ({ ...d, value: Math.round(d.value * multiplier) }))
})

let svg

function draw() {
  const el = hostRef.value
  if (!el) return
  const width = el.clientWidth || 640
  const height = el.clientHeight || 420

  select(el).selectAll('*').remove()
  svg = select(el).append('svg').attr('width', width).attr('height', height)

  renderBars()
}

function renderBars() {
  if (!svg) return
  const width = Number(svg.attr('width'))
  const height = Number(svg.attr('height'))
  const margin = { top: 24, right: 18, bottom: 44, left: 48 }

  const x = scaleBand()
    .domain(steppedData.value.map((d) => d.label))
    .range([margin.left, width - margin.right])
    .padding(0.2)

  const y = scaleLinear().domain([0, 100]).nice().range([height - margin.bottom, margin.top])

  svg.selectAll('.axis').remove()
  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${height - margin.bottom})`).call(axisBottom(x))
  svg.append('g').attr('class', 'axis').attr('transform', `translate(${margin.left},0)`).call(axisLeft(y).ticks(5))

  const bars = svg.selectAll('.bar').data(steppedData.value, (d) => d.label)

  bars
    .enter()
    .append('rect')
    .attr('class', 'bar')
    .attr('x', (d) => x(d.label))
    .attr('y', y(0))
    .attr('width', x.bandwidth())
    .attr('height', 0)
    .attr('fill', '#1d4ed8')
    .merge(bars)
    .transition()
    .duration(320)
    .attr('x', (d) => x(d.label))
    .attr('width', x.bandwidth())
    .attr('y', (d) => y(d.value))
    .attr('height', (d) => y(0) - y(d.value))

  bars.exit().remove()
}

onMounted(draw)
watch(steppedData, renderBars, { deep: true })
</script>

<template>
  <div ref="hostRef" class="d3-host" />
</template>

<style scoped>
.d3-host {
  width: 100%;
  height: 100%;
}
</style>

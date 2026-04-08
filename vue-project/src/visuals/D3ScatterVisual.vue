<script setup>
import { axisBottom, axisLeft } from 'd3-axis'
import { scaleLinear } from 'd3-scale'
import { select } from 'd3-selection'
import { onMounted, ref } from 'vue'

const hostRef = ref(null)
const tooltipRef = ref(null)

const points = [
  { x: 8, y: 12, label: 'Atlantic' },
  { x: 15, y: 22, label: 'Mediterranean' },
  { x: 26, y: 16, label: 'Pacific' },
  { x: 34, y: 27, label: 'Indian' },
  { x: 41, y: 18, label: 'Arctic' },
]

onMounted(() => {
  const el = hostRef.value
  if (!el) return

  const width = el.clientWidth || 740
  const height = el.clientHeight || 420
  const margin = { top: 20, right: 20, bottom: 36, left: 42 }

  const svg = select(el).append('svg').attr('width', width).attr('height', height)
  const x = scaleLinear().domain([0, 50]).range([margin.left, width - margin.right])
  const y = scaleLinear().domain([0, 30]).range([height - margin.bottom, margin.top])

  svg.append('g').attr('transform', `translate(0,${height - margin.bottom})`).call(axisBottom(x))
  svg.append('g').attr('transform', `translate(${margin.left},0)`).call(axisLeft(y))

  svg
    .selectAll('circle')
    .data(points)
    .enter()
    .append('circle')
    .attr('cx', (d) => x(d.x))
    .attr('cy', (d) => y(d.y))
    .attr('r', 8)
    .attr('fill', '#0ea5e9')
    .on('mouseenter', (event, d) => {
      if (!tooltipRef.value) return
      tooltipRef.value.style.opacity = '1'
      tooltipRef.value.style.left = `${event.offsetX + 12}px`
      tooltipRef.value.style.top = `${event.offsetY + 12}px`
      tooltipRef.value.textContent = `${d.label}: (${d.x}, ${d.y})`
    })
    .on('mouseleave', () => {
      if (!tooltipRef.value) return
      tooltipRef.value.style.opacity = '0'
    })
})
</script>

<template>
  <div class="scatter-wrap">
    <div ref="hostRef" class="d3-host" />
    <div ref="tooltipRef" class="tooltip" />
  </div>
</template>

<style scoped>
.scatter-wrap {
  position: relative;
  width: 100%;
  height: 440px;
}

.d3-host {
  width: 100%;
  height: 100%;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 0.75rem;
}

.tooltip {
  position: absolute;
  opacity: 0;
  pointer-events: none;
  background: rgba(15, 23, 42, 0.9);
  color: #f8fafc;
  border-radius: 0.5rem;
  padding: 0.4rem 0.55rem;
  font-size: 0.8rem;
}
</style>

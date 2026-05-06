<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import csvRaw from '../data/toyosu_tuna_2023.csv?raw'
import pacificFishUrl from './tuna-images/pacific-bluefin.png'

const props = defineProps({
  activeStep: { type: Number, default: 0 },
  stepProgress: { type: Number, default: 0 },
})

const canvasRef = ref(null)
const fishAspect = ref(2.3)
const prefersReducedMotion = ref(false)
const waitingForStepProgressReset = ref(false)
const pendingStep = ref(-1)

let ctx = null
let resizeObserver = null
let motionMq = null
let fishImage = null

function clamp01(value) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function parse2023Counts(csvText) {
  const lines = csvText.trim().split(/\r?\n/)
  let yearFishCount = 0
  const weeks = new Set()

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    const cols = line.split(',')
    if (cols.length < 10) continue
    const year = Number(cols[0])
    if (year !== 2023) continue
    const approxFish = Number(cols[8])
    const weekNumber = Number(cols[9])
    if (Number.isFinite(approxFish)) yearFishCount += approxFish
    if (Number.isFinite(weekNumber)) weeks.add(weekNumber)
  }

  const weekCount = Math.max(1, weeks.size)
  const weekFishCount = Math.ceil(yearFishCount / weekCount)
  return { weekFishCount, yearFishCount }
}

const fishTotals = computed(() => parse2023Counts(csvRaw))

function getGridLayout(count, boxWidth, boxHeight, left, top, baseFishWidth, baseFishHeight, baseGap) {
  const safeCount = Math.max(1, count)
  const usableW = Math.max(80, boxWidth)
  const usableH = Math.max(80, boxHeight)

  const initialCols = Math.max(1, Math.ceil(Math.sqrt((safeCount * usableW) / usableH)))
  const maxCols = Math.min(safeCount, Math.max(initialCols * 2, initialCols + 6))
  const minCols = Math.max(1, Math.floor(initialCols / 2))

  let best = null
  for (let cols = minCols; cols <= maxCols; cols++) {
    const rows = Math.ceil(safeCount / cols)
    const contentW = cols * baseFishWidth + Math.max(0, cols - 1) * baseGap
    const contentH = rows * baseFishHeight + Math.max(0, rows - 1) * baseGap
    const fitScale = Math.min(usableW / contentW, usableH / contentH)
    if (!Number.isFinite(fitScale) || fitScale <= 0) continue
    if (!best || fitScale > best.fitScale) {
      best = { cols, rows, fitScale }
    }
  }

  if (!best) {
    best = { cols: 1, rows: safeCount, fitScale: 1 }
  }

  const fishW = baseFishWidth * best.fitScale
  const fishH = baseFishHeight * best.fitScale
  const gap = baseGap * best.fitScale

  const positions = []
  for (let i = 0; i < safeCount; i++) {
    const row = Math.floor(i / best.cols)
    const col = i % best.cols
    const x = left + col * (fishW + gap)
    const y = top + row * (fishH + gap)
    positions.push({ x, y, w: fishW, h: fishH })
  }

  return {
    left,
    top,
    width: best.cols * fishW + Math.max(0, best.cols - 1) * gap,
    height: best.rows * fishH + Math.max(0, best.rows - 1) * gap,
    positions,
  }
}

function drawImageFish(rect, alpha = 1) {
  if (!ctx || !fishImage) return
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  const drawLength = rect.h
  const drawThickness = rect.w

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(cx, cy)
  ctx.rotate(-Math.PI / 2)
  ctx.drawImage(
    fishImage,
    -drawLength / 2,
    -drawThickness / 2,
    drawLength,
    drawThickness,
  )
  ctx.restore()
}

function drawPixelFish(rect, alpha = 1) {
  if (!ctx) return
  const bodyH = rect.h * 0.54
  const bodyW = rect.w * 0.44
  const bodyX = rect.x + (rect.w - bodyW) / 2
  const bodyY = rect.y + rect.h * 0.26
  const finW = rect.w * 0.46
  const finH = rect.h * 0.14
  const headW = rect.w * 0.34
  const headH = rect.h * 0.24
  const tailW = rect.w * 0.32
  const tailH = rect.h * 0.2

  ctx.fillStyle = `rgba(241, 245, 249, ${alpha})`
  ctx.fillRect(Math.round(bodyX), Math.round(bodyY), Math.round(bodyW), Math.round(bodyH))
  ctx.fillRect(
    Math.round(rect.x + (rect.w - finW) / 2),
    Math.round(rect.y + rect.h * 0.4),
    Math.round(finW),
    Math.round(finH),
  )
  ctx.fillRect(
    Math.round(rect.x + (rect.w - headW) / 2),
    Math.round(rect.y + rect.h * 0.04),
    Math.round(headW),
    Math.round(headH),
  )
  ctx.fillRect(
    Math.round(rect.x + (rect.w - tailW) / 2),
    Math.round(rect.y + rect.h * 0.8),
    Math.round(tailW),
    Math.round(tailH),
  )
}

function drawGrid(layout, alpha = 1) {
  for (let i = 0; i < layout.positions.length; i++) {
    drawPixelFish(layout.positions[i], alpha)
  }
}

function drawImageGrid(layout, alpha = 1) {
  for (let i = 0; i < layout.positions.length; i++) {
    drawImageFish(layout.positions[i], alpha)
  }
}

function scaleRectFromAnchor(rect, anchor, scale) {
  return {
    x: anchor.x + (rect.x - anchor.x) * scale,
    y: anchor.y + (rect.y - anchor.y) * scale,
    w: rect.w * scale,
    h: rect.h * scale,
  }
}

function drawImageGridScaled(layout, anchorRect, scale, alpha = 1) {
  const anchor = { x: anchorRect.x, y: anchorRect.y }
  for (let i = 0; i < layout.positions.length; i++) {
    drawImageFish(scaleRectFromAnchor(layout.positions[i], anchor, scale), alpha)
  }
}

function draw() {
  const canvas = canvasRef.value
  if (!canvas || !ctx) return

  const dpr = window.devicePixelRatio || 1
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  const targetW = Math.round(width * dpr)
  const targetH = Math.round(height * dpr)
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW
    canvas.height = targetH
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  ctx.fillStyle = '#041b46'
  ctx.fillRect(0, 0, width, height)

  const aspectRatio = fishAspect.value
  const edgePad = 24
  const anchorX = width / 3
  const availableWidth = Math.max(60, width - anchorX - edgePad)
  const targetSingleHeight = height * 0.8
  const singleHeight = Math.min(targetSingleHeight, (availableWidth * aspectRatio) / 0.92)
  const singleWidth = singleHeight / aspectRatio
  const singleRect = {
    x: anchorX,
    y: (height - singleHeight) / 2,
    w: singleWidth,
    h: singleHeight,
  }
  const baseGap = Math.max(2, singleRect.h * 0.04)

  const weekLayout = getGridLayout(
    fishTotals.value.weekFishCount,
    availableWidth,
    singleHeight,
    singleRect.x,
    singleRect.y,
    singleRect.w,
    singleRect.h,
    baseGap,
  )
  const yearLayout = getGridLayout(
    fishTotals.value.yearFishCount,
    availableWidth,
    singleHeight,
    weekLayout.left,
    weekLayout.top,
    singleRect.w,
    singleRect.h,
    baseGap,
  )

  const weekTopLeft = weekLayout.positions[0] || singleRect
  const yearTopLeft = yearLayout.positions[0] || weekTopLeft

  const baseStep = Math.max(0, Math.min(4, props.activeStep))
  const reduced = prefersReducedMotion.value
  const rawProgress = clamp01(props.stepProgress)
  const progress = reduced
    ? 1
    : waitingForStepProgressReset.value && baseStep === pendingStep.value
      ? 0
      : rawProgress

  if (baseStep === 0) {
    drawImageFish(singleRect, 1)
    return
  }

  if (baseStep === 1) {
    const t = progress
    const startMatchScale = Math.max(1, singleRect.h / Math.max(1, weekTopLeft.h))
    const sharedShrink = lerp(1, 1 / startMatchScale, t)
    const singleScale = sharedShrink
    const weekScale = startMatchScale * sharedShrink

    drawImageGridScaled(weekLayout, weekTopLeft, weekScale, t)
    drawImageFish(scaleRectFromAnchor(singleRect, weekTopLeft, singleScale), 1 - t * 0.18)
    return
  }

  if (baseStep === 2) {
    drawImageGrid(weekLayout, 1)
    return
  }

  if (baseStep === 3) {
    const t = progress
    const startMatchScale = Math.max(1, weekTopLeft.h / Math.max(1, yearTopLeft.h))
    const sharedShrink = lerp(1, 1 / startMatchScale, t)
    const weekScale = sharedShrink
    const yearScale = startMatchScale * sharedShrink

    drawImageGridScaled(yearLayout, yearTopLeft, yearScale, t)
    drawImageGridScaled(weekLayout, yearTopLeft, weekScale, 1 - t * 0.15)
    return
  }

  drawImageGrid(yearLayout, 1)
}

function updateReducedMotion() {
  prefersReducedMotion.value = !!motionMq?.matches
  draw()
}

async function loadFishAspect() {
  const img = new Image()
  await new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = reject
    img.src = pacificFishUrl
  })
  if (img.naturalWidth && img.naturalHeight) {
    fishAspect.value = img.naturalWidth / img.naturalHeight
  }
  fishImage = img
}

onMounted(async () => {
  const canvas = canvasRef.value
  if (!canvas) return
  ctx = canvas.getContext('2d')
  if (!ctx) return

  motionMq = window.matchMedia('(prefers-reduced-motion: reduce)')
  updateReducedMotion()
  motionMq.addEventListener('change', updateReducedMotion)

  resizeObserver = new ResizeObserver(() => draw())
  resizeObserver.observe(canvas)

  try {
    await loadFishAspect()
  } catch {
    // Keep fallback aspect ratio if image metadata is unavailable.
  }
  draw()
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  motionMq?.removeEventListener('change', updateReducedMotion)
})

watch(
  () => props.activeStep,
  (nextStep, prevStep) => {
    if (nextStep !== prevStep) {
      const isForwardScroll = nextStep > prevStep
      if (isForwardScroll) {
        waitingForStepProgressReset.value = true
        pendingStep.value = nextStep
      } else {
        // On reverse scroll, keep live progress so transition steps play backward smoothly.
        waitingForStepProgressReset.value = false
        pendingStep.value = -1
      }
    }
    draw()
  },
)

watch(
  () => props.stepProgress,
  (nextProgress) => {
    if (waitingForStepProgressReset.value && clamp01(nextProgress) <= 0.05) {
      waitingForStepProgressReset.value = false
    }
    draw()
  },
)

watch(
  () => [fishTotals.value.weekFishCount, fishTotals.value.yearFishCount],
  () => draw(),
)
</script>

<template>
  <div class="breakdown-fish-visual">
    <canvas ref="canvasRef" aria-hidden="true" />
  </div>
</template>

<style scoped>
.breakdown-fish-visual {
  width: 100%;
  height: 100%;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>

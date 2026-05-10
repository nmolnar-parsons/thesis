<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { computeFishBreakdownLayout, parse2023Counts } from '../composables/useFishBreakdownLayout.js'
import { readColorDefaultBlue } from '../utils/readStoryColors.js'
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

function easeInOutCubic(t) {
  if (t <= 0) return 0
  if (t >= 1) return 1
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

function easedTransitionProgress(t) {
  // Add a small dead-band at both ends so transitions breathe
  // before accelerating and before settling.
  const start = 0.08
  const end = 0.92
  if (t <= start) return 0
  if (t >= end) return 1
  return easeInOutCubic((t - start) / (end - start))
}

/** Step 0 only: fade-in starts at this fraction of scroll progress through the step (scrollama 0–1). */
const FIRST_FISH_FADE_START = 0.8

function firstFishEnterAlpha(rawStepProgress, reducedMotion) {
  if (reducedMotion) return 1
  const p = clamp01(rawStepProgress)
  if (p <= FIRST_FISH_FADE_START) return 0
  return clamp01((p - FIRST_FISH_FADE_START) / (1 - FIRST_FISH_FADE_START))
}

const fishTotals = computed(() => parse2023Counts(csvRaw))

function drawImageFish(rect, alpha = 1) {
  if (!ctx || !fishImage) return
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.drawImage(fishImage, rect.x, rect.y, rect.w, rect.h)
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

function drawImageGridFromLead(layout, leadRect, scale, alpha = 1) {
  const first = layout.positions[0]
  if (!first) return
  for (let i = 0; i < layout.positions.length; i++) {
    const rect = layout.positions[i]
    drawImageFish(
      {
        x: leadRect.x + (rect.x - first.x) * scale,
        y: leadRect.y + (rect.y - first.y) * scale,
        w: rect.w * scale,
        h: rect.h * scale,
      },
      alpha,
    )
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

  ctx.fillStyle = readColorDefaultBlue()
  ctx.fillRect(0, 0, width, height)

  const aspectRatio = fishAspect.value
  const {
    singleCenterRect,
    weekLayout,
    yearLayout,
    weekTopLeft,
    yearTopLeft,
  } = computeFishBreakdownLayout(width, height, aspectRatio, fishTotals.value)

  const baseStep = Math.max(0, Math.min(9, props.activeStep))
  const reduced = prefersReducedMotion.value
  const rawProgress = clamp01(props.stepProgress)
  const progress = reduced
    ? 1
    : waitingForStepProgressReset.value && baseStep === pendingStep.value
      ? 0
      : rawProgress

  if (baseStep === 0) {
    const enterAlpha = firstFishEnterAlpha(rawProgress, reduced)
    drawImageFish(singleCenterRect, enterAlpha)
    return
  }

  if (baseStep >= 1 && baseStep <= 3) {
    drawImageFish(singleCenterRect, 1)
    return
  }

  if (baseStep === 4) {
    const t = easedTransitionProgress(progress)
    const startMatchScale = singleCenterRect.h / Math.max(1, weekTopLeft.h)
    const sharedShrink = lerp(1, 1 / startMatchScale, t)
    const weekScale = startMatchScale * sharedShrink

    const leadRect = {
      x: lerp(singleCenterRect.x, weekTopLeft.x, t),
      y: lerp(singleCenterRect.y, weekTopLeft.y, t),
      w: weekTopLeft.w * weekScale,
      h: weekTopLeft.h * weekScale,
    }

    drawImageGridFromLead(weekLayout, leadRect, weekScale, t)
    drawImageFish(leadRect, 1 - t * 0.18)
    return
  }

  if (baseStep === 5 || baseStep === 6) {
    drawImageGrid(weekLayout, 1)
    return
  }

  if (baseStep === 7) {
    const t = easedTransitionProgress(progress)
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
  position: relative;
  width: 100%;
  height: 100%;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.breakdown-fish-visual .visual-title {
  position: absolute;
  top: clamp(0.75rem, 2.5vh, 2rem);
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
  z-index: 1;
  white-space: nowrap;
}
</style>

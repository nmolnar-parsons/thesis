<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  /** Result of computeFishBreakdownLayout, or null before measure */
  layout: { type: Object, default: null },
  activeStep: { type: Number, default: 0 },
  stepProgress: { type: Number, default: 0 },
  /** Callouts shown on steps 1–3 (single-fish + lingers) */
  annotations: {
    type: Array,
    default: () => [],
  },
})

function clamp01(v) {
  if (!Number.isFinite(v)) return 0
  return Math.min(1, Math.max(0, v))
}

const showSingleAnnotations = computed(() => props.activeStep >= 1 && props.activeStep <= 3)

/** Step 1: hold annotations at 0 until this fraction so the fish lands before labels appear. */
const ANNOTATION_STEP1_FADE_START = 0.45

/**
 * Forward-scroll guard: scrollama fires onStepEnter (activeStep flips) before onStepProgress resets,
 * so for one tick stepProgress still holds the previous step's tail (~1). Without gating, layerOpacity
 * paints the annotation at full alpha for that tick before snapping back to 0 and fading in — the flash.
 * Mirrors the pattern in FishGridVisual.vue.
 */
const waitingForStepProgressReset = ref(false)
const pendingStep = ref(-1)

watch(
  () => props.activeStep,
  (nextStep, prevStep) => {
    if (nextStep === prevStep) return
    const isForwardScroll = nextStep > prevStep
    if (isForwardScroll) {
      waitingForStepProgressReset.value = true
      pendingStep.value = nextStep
    } else {
      waitingForStepProgressReset.value = false
      pendingStep.value = -1
    }
  },
)

watch(
  () => props.stepProgress,
  (nextProgress) => {
    if (waitingForStepProgressReset.value && clamp01(nextProgress) <= 0.05) {
      waitingForStepProgressReset.value = false
    }
  },
)

const gatedProgress = computed(() => {
  if (waitingForStepProgressReset.value && props.activeStep === pendingStep.value) return 0
  return clamp01(props.stepProgress)
})

const layerOpacity = computed(() => {
  if (!showSingleAnnotations.value) return 0
  if (props.activeStep === 1) {
    const p = gatedProgress.value
    if (p <= ANNOTATION_STEP1_FADE_START) return 0
    return clamp01((p - ANNOTATION_STEP1_FADE_START) / (1 - ANNOTATION_STEP1_FADE_START))
  }
  return 1
})

function rectToPct(rect, w, h) {
  if (!rect || !w || !h) return null
  return {
    left: (rect.x / w) * 100,
    top: (rect.y / h) * 100,
    width: (rect.w / w) * 100,
    height: (rect.h / h) * 100,
  }
}

const singlePct = computed(() => {
  const L = props.layout
  if (!L?.singleCenterRect || !L.width || !L.height) return null
  return rectToPct(L.singleCenterRect, L.width, L.height)
})
</script>

<template>
  <div
    class="fish-grid-annotation-layer"
    :style="{ opacity: layerOpacity }"
    aria-hidden="true"
  >
    <template v-if="showSingleAnnotations && singlePct">
      <div
        v-for="item in annotations"
        :key="item.id"
        class="annotation-anchor"
        :style="{
          left: `${singlePct.left}%`,
          top: `${singlePct.top}%`,
          width: `${singlePct.width}%`,
          height: `${singlePct.height}%`,
        }"
      >
        <div class="annotation-frame" :style="item.frameInset != null ? { inset: `${item.frameInset}px` } : undefined">
          <span v-if="item.number != null" class="annotation-badge">{{ item.number }}</span>
          <div v-if="item.title || item.body" class="annotation-copy">
            <span v-if="item.title" class="annotation-title">{{ item.title }}</span>
            <span v-if="item.body" class="annotation-body">{{ item.body }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.fish-grid-annotation-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
}

.annotation-anchor {
  position: absolute;
  box-sizing: border-box;
}

.annotation-frame {
  position: absolute;
  inset: 0;
  border: 2px solid var(--story-annotation-frame-border);
  border-radius: 0;
  box-shadow:
    0 0 0 1px var(--story-annotation-frame-shadow-ring),
    0 12px 40px var(--story-annotation-frame-shadow-soft);
}

.annotation-badge {
  position: absolute;
  top: -0.1rem;
  left: -0.1rem;
  transform: translate(-35%, -35%);
  min-width: 1.75rem;
  height: 1.75rem;
  padding: 0 0.4rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-copy-title, system-ui, sans-serif);
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--story-annotation-badge-fg);
  background: var(--story-annotation-badge-bg);
  border-radius: 0;
  border: 1px solid var(--story-annotation-badge-border);
}

.annotation-copy {
  position: absolute;
  left: 0;
  top: 100%;
  margin-top: clamp(0.45rem, 1.2vw, 0.75rem);
  max-width: min(18rem, 42vw);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
  text-align: left;
}

.annotation-title {
  font-family: var(--font-copy-title, system-ui, sans-serif);
  font-size: var(--font-size-copy-title, 0.95rem);
  font-weight: var(--font-weight-copy-title, 600);
  color: var(--story-annotation-copy-title);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
}

.annotation-body {
  font-family: var(--font-copy, system-ui, sans-serif);
  font-size: calc(var(--font-size-copy, 0.875rem) * 0.95);
  font-weight: var(--font-weight-copy, 400);
  line-height: 1.35;
  color: var(--story-annotation-copy-body);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
  white-space: pre-line;
}

@media (max-width: 980px) {
  .annotation-copy {
    max-width: min(16rem, calc(100vw - 2rem));
    left: 0;
    top: 100%;
    margin-top: 0.5rem;
    transform: none;
  }
}
</style>

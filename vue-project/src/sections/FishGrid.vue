<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { computeFishBreakdownLayout, parse2023Counts } from '../composables/useFishBreakdownLayout.js'
import csvRaw from '../data/toyosu_tuna_2023.csv?raw'
import pacificFishUrl from '../visuals/tuna-images/pacific-bluefin.png'
import PinnedScrollSection from '../components/story/PinnedScrollSection.vue'
import StorySection from '../components/story/StorySection.vue'
import CopyBlock from '../components/layout/CopyBlock.vue'
import BreakdownFishVisual from '../visuals/BreakdownFishVisual.vue'
import FishGridAnnotationLayer from '../components/story/FishGridAnnotationLayer.vue'

defineProps({
  minimalMode: {
    type: Boolean,
    default: false,
  },
})

const fishAspect = ref(2.3)
const containerRef = ref(null)
const containerSize = ref({ width: 0, height: 0 })

const fishTotals = computed(() => parse2023Counts(csvRaw))

const layout = computed(() => {
  const { width, height } = containerSize.value
  if (!width || !height) return null
  return computeFishBreakdownLayout(width, height, fishAspect.value, fishTotals.value)
})

let ro = null

onMounted(() => {
  const img = new Image()
  img.onload = () => {
    if (img.naturalWidth && img.naturalHeight) {
      fishAspect.value = img.naturalWidth / img.naturalHeight
    }
  }
  img.src = pacificFishUrl

  const el = containerRef.value
  if (el && typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect
      if (cr) {
        containerSize.value = { width: cr.width, height: cr.height }
      }
    })
    ro.observe(el)
    containerSize.value = { width: el.clientWidth, height: el.clientHeight }
  }
})

onUnmounted(() => {
  ro?.disconnect()
})

/** Single-fish callout (steps 1–3). */
const singleFishAnnotations = [
  {
    id: 'single-bluefin',
    body: 'This fish stands in for one animal counted in the 2023 Toyosu auction records.',
  },
]

const steps = [
  {
    id: 'fish-grid-single-fade',
    title: 'One fish',
    text: 'A single Pacific bluefin comes into view.',
  },
  {
    id: 'fish-grid-single-annotate',
    title: 'One fish',
    text: 'Labels clarify what you are looking at before we zoom out.',
  },
  {
    id: 'fish-grid-single-linger-a',
    title: 'One fish',
    text: 'Hold on the lone fish for a beat.',
  },
  {
    id: 'fish-grid-single-linger-b',
    title: 'One fish',
    text: 'Another linger so the scale lands before the field expands.',
  },
  {
    id: 'fish-grid-single-to-week',
    title: 'One fish',
    text: 'Zoom out to reveal a week of fish at the same resolution.',
  },
  {
    id: 'fish-grid-week-hold',
    title: 'A week of fish',
    text: 'Each icon is still one fish—now enough to fill a representative week in the data.',
  },
  {
    id: 'fish-grid-week-linger',
    title: 'A week of fish',
    text: 'Stay on the week grid while the copy settles.',
  },
  {
    id: 'fish-grid-week-to-year',
    title: 'A week of fish',
    text: 'Zoom out again to reveal roughly a full year of fish in the dataset.',
  },
  {
    id: 'fish-grid-year-hold',
    title: 'A year of fish',
    text: 'The full 2023 fish field stays readable at a glance.',
  },
  {
    id: 'fish-grid-year-linger',
    title: 'A year of fish',
    text: 'Linger on the year before the story continues.',
  },
]
</script>

<template>
  <StorySection id="fish-grid" height="overscroll" width="full">
    <PinnedScrollSection :steps="steps" :scroll-offset="0.65">
      <template #graphic="graphicProps">
        <div ref="containerRef" class="fish-grid-graphic-wrap">
          <BreakdownFishVisual
            :active-step="graphicProps.activeStep"
            :step-progress="graphicProps.stepProgress"
          />
          <FishGridAnnotationLayer
            :layout="layout"
            :active-step="graphicProps.activeStep"
            :step-progress="graphicProps.stepProgress"
            :annotations="singleFishAnnotations"
          />
        </div>
      </template>
      <template #step="{ step }">
        <CopyBlock v-if="!minimalMode" :title="step.title">
          <p>{{ step.text }}</p>
        </CopyBlock>
        <span v-else class="fish-grid-step-slot" aria-hidden="true" />
      </template>
    </PinnedScrollSection>
  </StorySection>
</template>

<style scoped>
.fish-grid-graphic-wrap {
  position: relative;
  width: 100%;
  height: 100%;
}

#fish-grid :deep(.sticky-graphic) {
  background: #17203d;
}

#fish-grid :deep(.scroll-step) {
  justify-content: flex-start;
  align-items: flex-start;
  padding-left: clamp(0.75rem, 4vw, 2.5rem);
  padding-right: 55%;
}

#fish-grid :deep(.scroll-step .copy-block),
#fish-grid :deep(.step-card) {
  max-width: min(22rem, 33vw);
  width: 100%;
  background: var(--color-step-card-bg);
  border: 1px solid var(--color-step-card-border);
  border-radius: var(--step-card-radius);
  padding: var(--step-card-padding-y) 1.15rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.18);
}

#fish-grid :deep(.step-column),
#fish-grid :deep(.scroll-step) {
  pointer-events: none;
}

#fish-grid :deep(.scroll-step .copy-block),
#fish-grid :deep(.step-card) {
  pointer-events: auto;
}

.fish-grid-step-slot {
  display: block;
  width: 0;
  height: 0;
  overflow: hidden;
  visibility: hidden;
  pointer-events: none;
}

@media (max-width: 980px) {
  #fish-grid :deep(.scroll-step) {
    padding-right: clamp(0.75rem, 6vw, 2rem);
  }

  #fish-grid :deep(.scroll-step .copy-block),
  #fish-grid :deep(.step-card) {
    max-width: min(32rem, calc(100% - 1.5rem));
  }
}
</style>

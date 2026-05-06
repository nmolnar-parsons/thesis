<script setup>
import PinnedScrollSection from '../components/story/PinnedScrollSection.vue'
import StorySection from '../components/story/StorySection.vue'
import CopyBlock from '../components/layout/CopyBlock.vue'
import BreakdownFishVisual from '../visuals/BreakdownFishVisual.vue'

defineProps({
  minimalMode: {
    type: Boolean,
    default: false,
  },
})

const steps = [
  {
    id: 'breakdown-single-hold',
    title: 'One fish',
    text: 'A single Pacific bluefin appears at full scale.',
  },
  {
    id: 'breakdown-single-to-week',
    title: 'One fish',
    text: 'Zoom out to reveal a week of fish.',
  },
  {
    id: 'breakdown-week-hold',
    title: 'A week of fish',
    text: "A week of fish remains on screen before the next zoom out.",
  },
  {
    id: 'breakdown-week-to-year',
    title: 'A week of fish',
    text: 'Zoom out again to reveal the full year.',
  },
  {
    id: 'breakdown-year-hold',
    title: 'A year of fish',
    text: 'The full 2023 fish field stays visible.',
  },
]
</script>

<template>
  <StorySection id="breakdown" height="overscroll" width="full">
    <PinnedScrollSection :steps="steps" :scroll-offset="0.65">
      <template #graphic="graphicProps">
        <BreakdownFishVisual
          :active-step="graphicProps.activeStep"
          :step-progress="graphicProps.stepProgress"
        />
      </template>
      <template #step="{ step }">
        <CopyBlock v-if="!minimalMode" :title="step.title">
          <p>{{ step.text }}</p>
        </CopyBlock>
        <span v-else class="breakdown-step-slot" aria-hidden="true" />
      </template>
    </PinnedScrollSection>
  </StorySection>
</template>

<style scoped>
#breakdown :deep(.sticky-graphic) {
  background: #041b46;
}

#breakdown :deep(.scroll-step) {
  justify-content: flex-start;
  align-items: flex-start;
  padding-left: clamp(0.75rem, 4vw, 2.5rem);
  padding-right: 55%;
}

#breakdown :deep(.scroll-step .copy-block),
#breakdown :deep(.step-card) {
  max-width: min(22rem, 33vw);
  width: 100%;
  background: var(--color-step-card-bg);
  border: 1px solid var(--color-step-card-border);
  border-radius: var(--step-card-radius);
  padding: var(--step-card-padding-y) 1.15rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.18);
}

#breakdown :deep(.step-column),
#breakdown :deep(.scroll-step) {
  pointer-events: none;
}

#breakdown :deep(.scroll-step .copy-block),
#breakdown :deep(.step-card) {
  pointer-events: auto;
}

.breakdown-step-slot {
  display: block;
  width: 0;
  height: 0;
  overflow: hidden;
  visibility: hidden;
  pointer-events: none;
}

@media (max-width: 980px) {
  #breakdown :deep(.scroll-step) {
    padding-right: clamp(0.75rem, 6vw, 2rem);
  }

  #breakdown :deep(.scroll-step .copy-block),
  #breakdown :deep(.step-card) {
    max-width: min(32rem, calc(100% - 1.5rem));
  }
}
</style>

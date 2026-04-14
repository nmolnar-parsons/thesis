<script setup>
import CopyBlock from '../components/layout/CopyBlock.vue'
import PinnedScrollSection from '../components/story/PinnedScrollSection.vue'
import StorySection from '../components/story/StorySection.vue'
import TunaStackedBarsVisual from '../visuals/TunaStackedBarsVisual.vue'

const steps = [
  {
    id: 'hf1',
    title: 'Pacific bluefin',
    text: 'Global tuna catch (tonnes) for Pacific bluefin (PBF) alone from 1965 onward. Bar height is raw catch each year.',
  },
  {
    id: 'hf2',
    title: 'Bluefin species',
    text: 'Atlantic (BFT) and southern (SBF) bluefin join the stack. The y-axis rescales to the largest yearly total in this view.',
  },
  {
    id: 'hf3',
    title: 'Tropical tunas',
    text: 'Yellowfin (YFT) and bigeye (BET) complete the five-species stack. The legend grows as each group appears.',
  },
]
</script>

<template>
  <StorySection id="historical-fishing" height="overscroll" width="full" background="#e2e8f0">
    <PinnedScrollSection :steps="steps">
      <template #graphic="graphicProps">
        <TunaStackedBarsVisual :active-step="graphicProps.activeStep" />
      </template>
      <template #step="{ step }">
        <CopyBlock eyebrow="Historical fishing" :title="step.title">
          <p>{{ step.text }}</p>
        </CopyBlock>
      </template>
    </PinnedScrollSection>
  </StorySection>
</template>

<style scoped>
#historical-fishing :deep(.sticky-graphic) {
  background: #e2e8f0;
}

#historical-fishing :deep(.scroll-step) {
  justify-content: flex-start;
  align-items: flex-start;
  padding-left: clamp(0.75rem, 4vw, 2.5rem);
  padding-right: 55%;
}

#historical-fishing :deep(.scroll-step .copy-block),
#historical-fishing :deep(.step-card) {
  max-width: min(22rem, 33vw);
  width: 100%;
  padding: 1rem 1.15rem;
  border-radius: 0.75rem;
  background: rgba(248, 250, 252, 0.94);
  border: 1px solid rgba(148, 163, 184, 0.45);
  box-shadow: 0 4px 24px rgba(15, 23, 42, 0.08);
}
</style>

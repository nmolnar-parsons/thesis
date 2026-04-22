<script setup>
import CopyBlock from '../components/layout/CopyBlock.vue'
import PinnedScrollSection from '../components/story/PinnedScrollSection.vue'
import StorySection from '../components/story/StorySection.vue'
import TunaStackedBarsVisual from '../visuals/TunaStackedBarsVisual.vue'

const steps = [
  {
    id: 'hf1',
    title: '...and the fishing world bent to its will.',
    text: "As sushi's popularity grew, so did the demand for bluefin tuna. In the 1980s, it became possible and profitable to ship Atlantic bluefin tuna to Japan. By 2007, over 60,000 tonnes of Atlantic bluefin tuna were caught yearly.",
  },
  {
    id: 'hf2',
    title: '',
    text: 'Yet not two years later, the global catch had fallen by 80%. Not for any change in demand — sushi remained popular - but a historic level of overfishing. The population was at risk of complete collapse. Strict management measures - effectively a lowering of quotas - were put in place.',
  },
  {
    id: 'hf3',
    title: '',
    text: "Slowly, the stock has recovered. Atlantic bluefin has moved from Endangered to Least Concern status, and quotas have increased. There is no immediate risk of a stock collapse, and so no immediate risk of a type of sushi wiped from existence.",
  },
  {
    id: 'hf4',
    title: '',
    text: 'This story is matched by Pacific and Southern Bluefin tuna species. High fishing pressure -> overfishing -> slow recovery after extensive stock management. 80,000 tonnes of bluefin are caught each year, mainly to serve the sushi industry.',
  },
  {
    id: 'hf5',
    title: 'Yet there was never a danger of running out of fish for sushi:',
    text: "While bluefin tuna"
  },
]
</script>

<template>
  <StorySection id="historical-fishing" height="overscroll" width="full">
    <PinnedScrollSection :steps="steps">
      <template #graphic="graphicProps">
        <TunaStackedBarsVisual :active-step="graphicProps.activeStep" />
      </template>
      <template #step="{ step }">
        <CopyBlock :title="step.title">
          <p>{{ step.text }}</p>
        </CopyBlock>
      </template>
    </PinnedScrollSection>
  </StorySection>
</template>

<style scoped>
#historical-fishing :deep(.sticky-graphic) {
  background: var(--color-section-surface);
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
  padding: var(--step-card-padding-y) 1.15rem;
  border-radius: var(--step-card-radius);
  background: var(--color-step-card-bg);
  border: 1px solid var(--color-step-card-border);
  box-shadow: 0 4px 24px rgba(15, 23, 42, 0.08);
}
</style>

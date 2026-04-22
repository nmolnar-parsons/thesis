<script setup>
import CopyBlock from '../components/layout/CopyBlock.vue'
import PinnedScrollSection from '../components/story/PinnedScrollSection.vue'
import StorySection from '../components/story/StorySection.vue'
import MapSectionVisual from '../visuals/MapSectionVisual.vue'

const steps = [
  { id: 'm1', title: 'Maybe change this to only show bluefin', text: '' },
  { id: 'm2', title: '', text: 'Thing2' },
  { id: 'm3', title: '', text: 'Thing3' },
  { id: 'm4', title: '', text: 'In the North Atlantic, tuna fishing has moved away from tropical/temperate waters towards the North Pole. The Mediterranean has become a hotspot as well.' },
]
</script>

<template>
  <StorySection id="map" height="overscroll" width="full">
    <PinnedScrollSection :steps="steps" :scroll-offset="0">
      <template #graphic="graphicProps">
        <MapSectionVisual
          :active-step="graphicProps.activeStep"
          :step-progress="graphicProps.stepProgress"
          :step-count="steps.length"
        />
      </template>
      <template #step="{ step }">
        <CopyBlock eyebrow="" :title="step.title">
          <p>{{ step.text }}</p>
        </CopyBlock>
      </template>
    </PinnedScrollSection>
  </StorySection>
</template>

<style scoped>
#map :deep(.step-column) {
  /* Delay first step activation until map has fully pinned. */
  padding-top: 90vh;
  /* Keep map pinned until the final step reaches the top. */
  padding-bottom: 90vh;
}
</style>

<script setup>
import CopyBlock from '../components/layout/CopyBlock.vue'
import PinnedScrollSection from '../components/story/PinnedScrollSection.vue'
import StorySection from '../components/story/StorySection.vue'
import MapSectionVisual from '../visuals/MapSectionVisual.vue'

const steps = [
  { id: 'm1', title: '', text: '' },
  { id: 'm2', title: '', text: '' },
  { id: 'm3', title: '', text: '' },
  { id: 'm4', title: '', text: '' },
  { id: 'm5', title: '', text: '' },
  { id: 'm6', title: '', text: '' },
  { id: 'm7', title: '', text: '' },
  { id: 'm8', title: '', text: '' },
  { id: 'm9', title: '', text: '' },
  { id: 'm10', title: '', text: '' },
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
        <CopyBlock v-if="step.title || step.text" eyebrow="" :title="step.title">
          <p>{{ step.text }}</p>
        </CopyBlock>
      </template>
    </PinnedScrollSection>
  </StorySection>
</template>

<style scoped>
#map :deep(.sticky-graphic) {
  background: transparent;
}

#map :deep(.step-column) {
  /* Delay first step activation until map has fully pinned. */
  padding-top: 90vh;
  /* Keep map pinned until the final step reaches the top. */
  padding-bottom: 90vh;
}

@media (max-width: 900px) {
  #map :deep(.step-column) {
    padding-top: 70vh;
    padding-bottom: 70vh;
  }
}
</style>

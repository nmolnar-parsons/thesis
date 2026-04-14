<script setup>
import CopyBlock from '../components/layout/CopyBlock.vue'
import PinnedScrollSection from '../components/story/PinnedScrollSection.vue'
import StorySection from '../components/story/StorySection.vue'
import MapSectionVisual from '../visuals/MapSectionVisual.vue'

const steps = [
  { id: 'm1', title: 'Global routes', text: 'The map section is pinned, so the visual stays full viewport while narrative cards move.' },
  { id: 'm2', title: 'Regional concentration', text: 'Use each step to discuss a different shipping or market focus on the same backdrop.' },
  { id: 'm3', title: 'Future overlay', text: 'Replace this placeholder with your Mapbox layer once you add a token.' },
  { id: 'm4', title: 'Poleward Movement', text: 'In the North Atlantic, tuna fishing has moved away from tropical/temperate waters towards the North Pole.' },
]
</script>

<template>
  <StorySection id="map" height="overscroll" width="full" background="#0f172a">
    <PinnedScrollSection :steps="steps">
      <template #graphic="graphicProps">
        <MapSectionVisual
          :active-step="graphicProps.activeStep"
          :step-progress="graphicProps.stepProgress"
          :step-count="steps.length"
        />
      </template>
      <template #step="{ step }">
        <CopyBlock eyebrow="Section 04" :title="step.title">
          <p>{{ step.text }}</p>
        </CopyBlock>
      </template>
    </PinnedScrollSection>
  </StorySection>
</template>

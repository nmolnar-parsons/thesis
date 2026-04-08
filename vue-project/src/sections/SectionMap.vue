<script setup>
import CopyBlock from '../components/layout/CopyBlock.vue'
import PinnedScrollSection from '../components/story/PinnedScrollSection.vue'
import StorySection from '../components/story/StorySection.vue'
import mapHere from '../visuals/map_here.jpg'

const steps = [
  { id: 'm1', title: 'Global routes', text: 'The map section is pinned, so the visual stays full viewport while narrative cards move.' },
  { id: 'm2', title: 'Regional concentration', text: 'Use each step to discuss a different shipping or market focus on the same backdrop.' },
  { id: 'm3', title: 'Future overlay', text: 'Replace this placeholder with your Mapbox layer once you add a token.' },
]
</script>

<template>
  <StorySection id="map" height="overscroll" width="full" background="#0f172a">
    <PinnedScrollSection :steps="steps">
      <template #graphic>
        <img class="map-placeholder" :src="mapHere" alt="Map placeholder for upcoming Mapbox visual" />
      </template>
      <template #step="{ step }">
        <CopyBlock eyebrow="Section 04" :title="step.title">
          <p>{{ step.text }}</p>
        </CopyBlock>
      </template>
    </PinnedScrollSection>
  </StorySection>
</template>

<style scoped>
.map-placeholder {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>

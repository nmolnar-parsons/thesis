<script setup>
import PinnedScrollSection from '../components/story/PinnedScrollSection.vue'
import StorySection from '../components/story/StorySection.vue'
import MapSectionVisual from '../visuals/MapSectionVisual.vue'

/** Scroll steps drive `activeStep` only; all copy lives on the map HUD in MapSectionVisual. */
const steps = [
  // 0–4: year animates 1965 → 2023 (global view)
  { id: 'm1', title: '', text: '' },
  { id: 'm2', title: '', text: '' },
  { id: 'm3', title: '', text: '' },
  { id: 'm4', title: '', text: '' },
  { id: 'm5', title: '', text: '' },
  // 5–8: global view linger (pacing)
  { id: 'm6', title: '', text: '' },
  { id: 'm7', title: '', text: '' },
  // 9–11: Mediterranean year scrub (2007 → 2023)
  { id: 'm10', title: '', text: '' },
  { id: 'm11', title: '', text: '' },
  { id: 'm12', title: '', text: '' },
  // 12: basin annotation appears (ellipse persists through next steps)
  { id: 'm13', title: '', text: '' },
  // 13–16: Mediterranean linger at 2023 (ellipse stays visible)
  { id: 'm14', title: '', text: '' },
  { id: 'm15', title: '', text: '' },
  { id: 'm16', title: '', text: '' },
  { id: 'm17', title: '', text: '' },
  // 17–19: return to global + end padding
  { id: 'm18', title: '', text: '' },
  { id: 'm19', title: '', text: '' },
  { id: 'm20', title: '', text: '' },
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
      <template #step>
        <!-- Non-empty slot suppresses PinnedScrollSection default .step-card fallback. -->
        <span class="map-step-slot" aria-hidden="true" />
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

#map :deep(.scroll-step) {
  padding: 0;
  background: transparent;
  border: none;
  box-shadow: none;
}

#map :deep(.scroll-step.active) {
  background: transparent;
  box-shadow: none;
}

/* Default slot fallback .step-card uses PinnedScrollSection scoped styles — hide entirely here. */
#map :deep(.step-card) {
  display: none !important;
}

#map :deep(.map-step-slot) {
  display: block;
  width: 0;
  height: 0;
  overflow: hidden;
  visibility: hidden;
  pointer-events: none;
}

@media (max-width: 900px) {
  #map :deep(.step-column) {
    padding-top: 70vh;
    padding-bottom: 70vh;
  }
}
</style>

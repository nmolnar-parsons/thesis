<script setup>
import PinnedScrollSection from '../components/story/PinnedScrollSection.vue'
import StorySection from '../components/story/StorySection.vue'
import MapSectionVisual from '../visuals/MapSectionVisual.vue'

defineProps({
  minimalMode: {
    type: Boolean,
    default: false,
  },
})

/** Scroll steps drive `activeStep` only; all copy lives on the map HUD in MapSectionVisual. */
const steps = [
  // 0–4: year animates 1965 → 2023 (global view)
  { id: 'm1', title: '', text: '' },
  { id: 'm2', title: '', text: '' },
  { id: 'm3', title: '', text: '' },
  { id: 'm4', title: '', text: '' },
  { id: 'm5', title: '', text: '' },
  // 5–8: global 2023 linger (basin cue on HUD)
  { id: 'm6', title: '', text: '' },
  { id: 'm7', title: '', text: '' },
  { id: 'm8', title: '', text: '' },
  { id: 'm9', title: '', text: '' },
  // 9: zoom into Mediterranean, year stays 2023 (no regional year scrub)
  { id: 'm10', title: '', text: '' },
  // 10–11: farm dots fade in, then single linger beat; still Med camera
  { id: 'm11', title: '', text: '' },
  { id: 'm12', title: '', text: '' },
  // 12–14: return to global + end padding (year stays 2023)
  { id: 'm13', title: '', text: '' },
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
          :minimal-mode="minimalMode"
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
:deep(#map.story-section) {
  padding-bottom: 32px;
}

#map :deep(.sticky-graphic) {
  background: var(--color-default-blue);
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

<script setup>
import CopyBlock from '../components/layout/CopyBlock.vue'
import SectionGrid from '../components/layout/SectionGrid.vue'
import StorySection from '../components/story/StorySection.vue'
import TunaProductionCountriesVisual from '../visuals/TunaProductionCountriesVisual.vue'

defineProps({
  minimalMode: {
    type: Boolean,
    default: false,
  },
})
</script>

<template>
  <StorySection id="country-production" height="min-screen" width="full">
    <SectionGrid :columns="12" gap="1.25rem" align="start">
      <div v-if="!minimalMode" class="story-copy story-copy--top production-copy">
        <CopyBlock title="Global Production">
          <p>
            The streamgraph tracks annual bluefin tuna imports by country. Stream thickness shows
            each country's volume contribution over time.
          </p>
        </CopyBlock>
      </div>
      <div class="production-visual">
        <TunaProductionCountriesVisual />
      </div>
    </SectionGrid>
  </StorySection>
</template>

<style scoped>
.production-copy {
  grid-column: 3 / span 8;
}

.production-visual {
  grid-column: 1 / span 12;
}

@media (max-width: 980px) {
  .production-copy,
  .production-visual {
    grid-column: 1 / -1;
  }
}
</style>

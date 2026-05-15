<script setup>
import CopyBlock from '../../components/layout/CopyBlock.vue'
import SectionGrid from '../../components/layout/SectionGrid.vue'
import StorySection from '../../components/story/StorySection.vue'
import TunaProductionStreamgraphVisual from './TunaProductionStreamgraphVisual.vue'

defineProps({
  minimalMode: {
    type: Boolean,
    default: false,
  },
})
</script>

<template>
  <StorySection id="country-production" height="min-screen" width="full">
    <div class="country-production-shell">
      <SectionGrid class="country-production-grid" :columns="12" gap="1.25rem" align="start">
        <div v-if="!minimalMode" class="story-copy story-copy--top">
          <CopyBlock title="Global Production">
            <p>
              The streamgraph tracks annual bluefin tuna imports by country. Stream thickness shows
              each country's volume contribution over time.
            </p>
          </CopyBlock>
        </div>
        <div class="production-visual">
          <TunaProductionStreamgraphVisual />
        </div>
      </SectionGrid>
    </div>
  </StorySection>
</template>

<style scoped>
.country-production-shell {
  min-height: 100vh;
  display: flex;
  align-items: center;
  width: 100%;
}

.country-production-grid {
  width: 100%;
}

.production-visual {
  grid-column: 1 / span 12;
}

@media (max-width: 980px) {
  .production-visual {
    grid-column: 1 / -1;
  }
}
</style>

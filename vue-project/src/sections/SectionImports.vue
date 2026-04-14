<script setup>
import CopyBlock from '../components/layout/CopyBlock.vue'
import SectionGrid from '../components/layout/SectionGrid.vue'
import StorySection from '../components/story/StorySection.vue'
import ImportStreamgraphVisual from '../visuals/ImportStreamgraphVisual.vue'
</script>

<template>
  <StorySection id="imports" height="min-screen" width="full" background="#e2e8f0">
    <SectionGrid :columns="12" gap="1.25rem" align="start">
      <div class="story-copy story-copy--top imports-copy">
        <CopyBlock eyebrow="Section 05" title="Imports">
          <p>
            The streamgraph tracks annual bluefin tuna imports by country. Stream thickness shows
            each country's volume contribution over time.
          </p>
        </CopyBlock>
      </div>
      <div class="imports-visual">
        <ImportStreamgraphVisual />
      </div>
    </SectionGrid>
  </StorySection>
</template>

<style scoped>
.imports-copy {
  grid-column: 3 / span 8;
}

.imports-visual {
  grid-column: 2 / span 10;
}

@media (max-width: 980px) {
  .imports-copy,
  .imports-visual {
    grid-column: 1 / -1;
  }

}
</style>

<script setup>
import CopyBlock from '../components/layout/CopyBlock.vue'
import SectionGrid from '../components/layout/SectionGrid.vue'
import StorySection from '../components/story/StorySection.vue'
import TunaDomesticImportsDistrictsVisual from '../visuals/TunaDomesticImportsDistrictsVisual.vue'
</script>

<template>
  <StorySection id="domestic-imports" height="min-screen" width="full">
    <SectionGrid :columns="12" gap="1.25rem" align="start">
      <div class="story-copy domestic-copy">
        <CopyBlock title="Where is your tuna coming from?">
          <p>
            When you eat sushi in the United States, it may be coming from one of these countries.
          </p>
        </CopyBlock>
      </div>
      <div class="domestic-visual">
        <TunaDomesticImportsDistrictsVisual />
      </div>
    </SectionGrid>
  </StorySection>
</template>

<style scoped>
.domestic-copy {
  grid-column: 3 / span 8;
}

.domestic-visual {
  grid-column: 1 / span 12;
}

@media (max-width: 980px) {
  .domestic-copy,
  .domestic-visual {
    grid-column: 1 / -1;
  }
}
</style>

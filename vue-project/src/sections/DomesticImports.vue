<script setup>
import CopyBlock from '../components/layout/CopyBlock.vue'
import SectionGrid from '../components/layout/SectionGrid.vue'
import StorySection from '../components/story/StorySection.vue'
import DistrictDonutsVisual from '../visuals/DistrictDonutsVisual.vue'

defineProps({
  minimalMode: {
    type: Boolean,
    default: false,
  },
})
</script>

<template>
  <StorySection id="domestic-imports" height="min-screen" width="full">
    <SectionGrid class="domestic-imports-grid" :columns="12" gap="1.25rem" align="start">
      <div v-if="!minimalMode" class="story-copy story-copy--top">
        <CopyBlock title="Lorem ipsum dolor sit amet">
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et
            dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex
            ea commodo consequat.
          </p>
        </CopyBlock>
      </div>
      <div class="domestic-visual">
        <DistrictDonutsVisual />
      </div>
      <div v-if="!minimalMode" class="story-copy story-copy--bottom">
        <CopyBlock title="Consectetur adipiscing elit">
          <p>
            Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
            Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est
            laborum.
          </p>
        </CopyBlock>
      </div>
    </SectionGrid>
  </StorySection>
</template>

<style scoped>
.domestic-imports-grid {
  min-height: 100vh;
  align-items: center;
}

.domestic-visual {
  grid-column: 1 / span 12;
  padding-bottom: clamp(2rem, 6vh, 5rem);
}

@media (max-width: 980px) {
  .domestic-visual {
    grid-column: 1 / -1;
  }
}
</style>

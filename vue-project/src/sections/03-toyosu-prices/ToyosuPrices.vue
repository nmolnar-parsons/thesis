<script setup>
import CopyBlock from '../../components/layout/CopyBlock.vue'
import SectionGrid from '../../components/layout/SectionGrid.vue'
import StorySection from '../../components/story/StorySection.vue'
import ToyosuPricesLineVisual from './ToyosuPricesLineVisual.vue'

defineProps({
  minimalMode: {
    type: Boolean,
    default: false,
  },
})
</script>

<template>
  <StorySection id="toyosu-prices" height="min-screen" width="full">
    <SectionGrid :columns="12" gap="1.25rem" align="start">
      <div v-if="!minimalMode" class="story-copy story-copy--top">
        <CopyBlock title="Why do we catch so much tuna">
          <p>
            it's really expensive!
          </p>
        </CopyBlock>
      </div>

      <div v-if="!minimalMode" class="toyosu-visual">
        <ToyosuPricesLineVisual />
      </div>

    </SectionGrid>
  </StorySection>
</template>

<style scoped>
.toyosu-visual {
  grid-column: 1 / span 12;
}

@media (max-width: 980px) {
  .toyosu-visual {
    grid-column: 1 / -1;
  }
}
</style>

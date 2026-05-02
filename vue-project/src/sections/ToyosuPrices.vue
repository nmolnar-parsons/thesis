<script setup>
import CopyBlock from '../components/layout/CopyBlock.vue'
import SectionGrid from '../components/layout/SectionGrid.vue'
import StorySection from '../components/story/StorySection.vue'
import ToyosuPricesLineVisual from '../visuals/ToyosuPricesLineVisual.vue'
</script>

<template>
  <StorySection id="toyosu-prices" height="min-screen" width="full">
    <SectionGrid :columns="12" gap="1.25rem" align="start">
      <div class="story-copy story-copy--top toyosu-copy-top">
        <CopyBlock title="Tsukiji and Toyosu and Where Your Fish Comes From">
          <p>
            Annual Toyosu market prices show how bluefin valuation shifts over two decades.
          </p>
        </CopyBlock>
      </div>

      <div class="toyosu-visual">
        <ToyosuPricesLineVisual />
      </div>

      <div class="story-copy toyosu-copy-bottom">
        <CopyBlock>
          <p>
            bluefin tuna is almost exclusively used for sushi. To do otherwise would be to throw
            value back into the ocean
          </p>
        </CopyBlock>
      </div>
    </SectionGrid>
  </StorySection>
</template>

<style scoped>
.toyosu-copy-top {
  grid-column: 3 / span 8;
}

.toyosu-visual {
  grid-column: 1 / span 12;
}

.toyosu-copy-bottom {
  grid-column: 3 / span 8;
}

@media (max-width: 980px) {
  .toyosu-copy-top,
  .toyosu-visual,
  .toyosu-copy-bottom {
    grid-column: 1 / -1;
  }
}
</style>

<script setup>
import CopyBlock from '../components/layout/CopyBlock.vue'
import SectionGrid from '../components/layout/SectionGrid.vue'
import StorySection from '../components/story/StorySection.vue'
import D3ScatterVisual from '../visuals/D3ScatterVisual.vue'
</script>

<template>
  <StorySection id="shipping-pricing" height="min-screen" width="wide" background="#e2e8f0">
    <SectionGrid :columns="12" gap="1rem">
      <div class="copy-col">
        <CopyBlock eyebrow="Shipping & Pricing" title="Tsukiji and Toyosu and Where Your Fish Comes From">
          <p>
            This is intentionally not pinned. 
          </p>
        </CopyBlock>
      </div>
      <div class="viz-col">
        <D3ScatterVisual />
      </div>
      <CopyBlock title="Part 2">
          <p>
            More text here, but not sure what yet...
          </p>
        </CopyBlock>
    </SectionGrid>
  </StorySection>
</template>

<style scoped>
.copy-col {
  grid-column: 1 / span 4;
}

.viz-col {
  grid-column: 5 / -1;
}
</style>

<script setup>
import CopyBlock from '../components/layout/CopyBlock.vue'
import SectionGrid from '../components/layout/SectionGrid.vue'
import StorySection from '../components/story/StorySection.vue'
import atlanticBluefin from '../visuals/tuna-images/atlantic-bluefin.png'
</script>

<template>
  <StorySection id="shipping-pricing" height="min-screen" width="wide" background="#e2e8f0">
    <SectionGrid :columns="12" gap="1rem">
      <div class="copy-col">
        <CopyBlock title="Tsukiji and Toyosu and Where Your Fish Comes From">
          <p>
            This is a tuna, yo 
          </p>
        </CopyBlock>
      </div>
      <div class="placeholder_image">
        <img :src="atlanticBluefin" alt="Atlantic Bluefin Tuna" width="400px" height="200px">
      </div>
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

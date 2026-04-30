<!-- Section which breaks down a tuna into parts of sushi -->
<!-- Need: introduction to tuna. SVG above, copy below. -->
<script setup>
import StorySection from '../components/story/StorySection.vue'
import SectionGrid from '../components/layout/SectionGrid.vue'
import CopyBlock from '../components/layout/CopyBlock.vue'
</script>

<template>
  <StorySection id="breakdown" height="min-screen" width="full">
    <SectionGrid :columns="12" gap="1.25rem" align="center">
      <div class="story-copy">
        <CopyBlock title="Limited Resources">
          <p>
            Sushi is fish.
          </p>
          <p>
            Tuna is the the current king of sushi fish. It grew in popularity in post-war Japan, and became the poster child for the global sushi boom.
            Tuna remains the most popular cut of sushi amonst Japanese sushigoers. This is despite how expensive it can be. Demand for tuna
            has turned the fish into the beef of the sea, able to be caught and sold at much higher margins than most marine life.
          </p>
          <p>
            Demand for tuna driven by sushi focuses on a few species in ascending desirability and price: Bigeye, Yellowfin, and the three Bluefin species
            (Pacific, Southern, and Atlantic).
          </p>
        </CopyBlock>
      </div>
    </SectionGrid>
  </StorySection>
</template>

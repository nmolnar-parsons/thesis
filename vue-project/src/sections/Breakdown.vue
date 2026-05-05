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
        <CopyBlock title="Bluefin Tuna was once almost fished to extinction.">
          <p>
            filler filler filler filler filler
          </p>
        </CopyBlock>
      </div>
    </SectionGrid>
  </StorySection>
</template>

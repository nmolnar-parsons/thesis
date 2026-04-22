<script setup>
import CopyBlock from '../components/layout/CopyBlock.vue'
import SectionGrid from '../components/layout/SectionGrid.vue'
import StorySection from '../components/story/StorySection.vue'
</script>

<template>
  <StorySection id="futures" height="min-screen" width="full">
    <SectionGrid :columns="12" gap="1.25rem" align="center">
      <div class="story-copy">
        <CopyBlock eyebrow="Section 05" title="Futures">
          <p>
            This closing section can frame scenarios, projections, or policy outcomes after the map sequence.
          </p>
        </CopyBlock>
      </div>
    </SectionGrid>
  </StorySection>
</template>

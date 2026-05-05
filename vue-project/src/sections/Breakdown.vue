<!-- Section which breaks down a tuna into parts of sushi -->
<script setup>
import StorySection from '../components/story/StorySection.vue'
import SectionGrid from '../components/layout/SectionGrid.vue'
import CopyBlock from '../components/layout/CopyBlock.vue'
import TunaRainVisual from '../visuals/TunaRainVisual.vue'
</script>

<template>
  <StorySection id="breakdown" height="min-screen" width="full" background="#041b46">
    <div class="breakdown-shell">
      <div class="breakdown-rain" aria-hidden="true">
        <TunaRainVisual />
      </div>
      <SectionGrid class="breakdown-foreground" :columns="12" gap="1.25rem" align="center">
        <div class="story-copy">
          <CopyBlock title="Bluefin Tuna was once almost fished to extinction.">
            <p>
              filler filler filler filler filler
            </p>
          </CopyBlock>
        </div>
      </SectionGrid>
    </div>
  </StorySection>
</template>

<style scoped>
.breakdown-shell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 2 * var(--story-section-padding-y));
}

.breakdown-rain {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.breakdown-foreground {
  position: relative;
  z-index: 1;
  width: 100%;
}

.story-copy {
  grid-column: 1 / -1;
  background: var(--color-step-card-bg);
  border: 1px solid var(--color-step-card-border);
  border-radius: var(--step-card-radius, 0.75rem);
  padding: var(--step-card-padding-y, 1rem) var(--step-card-padding-x, 1.2rem);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.18);
}

@media (min-width: 768px) {
  .story-copy {
    grid-column: 3 / span 8;
  }
}
</style>

<script setup>
import StorySection from '../components/story/StorySection.vue'
</script>

<template>
  <StorySection
    id="title"
    height="screen"
    width="full"
    background="#13265f"
  >
    <div class="title-wrap">
      <h1 class="title-heading">
        <span class="title-line">The Last Sushi</span>
        <span class="title-line">in the World</span>
      </h1>
      <div class="title-earth" aria-hidden="true" />
    </div>
  </StorySection>
</template>

<style scoped>
:deep(#title) {
  padding: 0;
  overflow: visible;
}

.title-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  box-sizing: border-box;
  min-height: 100vh;
  padding: clamp(1rem, 4vw, 2.5rem);
  text-align: left;
  color: #f8fafc;
  overflow: visible;
}

.title-earth {
  position: absolute;
  z-index: 0;
  /* Center-biased (lower-right): bigger graphic without pinning to viewport bottom edge */
  left: 50%;
  top: 56%;
  transform: translate(-6%, -50%);
  width: min(82vmin, 880px);
  height: auto;
  max-width: min(92vw, 880px);
  max-height: min(76vh, 880px);
  aspect-ratio: 1;
  background-image: url('../visuals/tuna-earth/blue-marble.png');
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
  pointer-events: none;
}

.title-heading {
  position: relative;
  z-index: 1;
  margin: 0;
  font-family: var(--font-title-bebas);
  font-weight: 350;
  font-size: clamp(3rem, 11vw, 8rem);
  line-height: 0.94;
  letter-spacing: 0.02em;
  max-width: 12ch;
  text-transform: none;
  text-shadow:
    0 2px 12px rgba(0, 0, 0, 0.5),
    0 4px 24px rgba(0, 0, 0, 0.35);
}

.title-line {
  display: block;
}

.title-heading .title-line + .title-line {
  margin-top: 0.02em;
}

@media (max-width: 560px) {
  .title-earth {
    transform: translate(-14%, -48%);
    max-height: min(68vh, 520px);
    width: min(88vmin, 520px);
  }
}
</style>

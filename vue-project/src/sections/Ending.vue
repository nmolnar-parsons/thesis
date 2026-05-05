<script setup>
import StorySection from '../components/story/StorySection.vue'
</script>

<template>
  <StorySection
    id="ending"
    height="screen"
    width="full"
    background="#13265f"
  >
    <div class="ending-wrap">
      <h1 class="ending-heading">
        <span class="ending-line"><span class="strike-last">The Last</span> Sushi</span>
        <span class="ending-line">in the World</span>
      </h1>
      <div class="ending-graphic" aria-hidden="true" />
    </div>
  </StorySection>
</template>

<style scoped>
.ending-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  box-sizing: border-box;
  min-height: 100vh;
  min-height: 100dvh;
  padding: clamp(1rem, 4vw, 2.5rem);
  text-align: left;
  color: #f8fafc;
  overflow: visible;
}

.ending-graphic {
  position: absolute;
  z-index: 0;
  left: 50%;
  top: 52%;
  transform: translate(-6%, -50%);
  width: min(64vmin, 640px);
  height: auto;
  max-width: min(82vw, 640px);
  max-height: min(58vh, 640px);
  aspect-ratio: 1;
  background-image: url('../visuals/tuna-earth/Sushi_Earth.png');
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
  pointer-events: none;
}

.ending-heading {
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

.strike-last {
  text-decoration: line-through;
  opacity: 0.72;
}

.ending-line {
  display: block;
}

.ending-heading .ending-line + .ending-line {
  margin-top: 0.02em;
}

@media (max-width: 560px) {
  .ending-graphic {
    top: 50%;
    transform: translate(-14%, -48%);
    max-height: min(50vh, 400px);
    width: min(72vmin, 400px);
  }
}
</style>

<style>
#ending.story-section.height-screen {
  padding: 0 !important;
  overflow: visible;
  height: auto;
  min-height: 100vh;
  min-height: 100dvh;
}
</style>

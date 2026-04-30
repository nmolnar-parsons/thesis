<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import StorySection from '../components/story/StorySection.vue'
import wildTunaImage from '../visuals/intro-placeholders/wild-tuna.png'
import toyosuTunaImage from '../visuals/intro-placeholders/toyosu-tuna.png'
import tunaNigiriImage from '../visuals/intro-placeholders/tuna-nigiri.jpg'

const imageSteps = [
  { src: wildTunaImage, alt: 'Wild tuna placeholder image' },
  { src: toyosuTunaImage, alt: 'Toyosu tuna placeholder image' },
  { src: tunaNigiriImage, alt: 'Tuna nigiri placeholder image' },
]

const activeImageIndex = ref(0)
const stepElements = ref([])
let stepObserver = null

const currentImage = computed(() => imageSteps[activeImageIndex.value] ?? imageSteps[0])

const setStepRef = (el, index) => {
  if (!el) return
  stepElements.value[index] = el
}

onMounted(() => {
  stepObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const index = Number(entry.target.getAttribute('data-step-index'))
        if (!Number.isNaN(index)) activeImageIndex.value = index
      }
    },
    {
      threshold: 0.55,
      rootMargin: '-10% 0px -20% 0px',
    },
  )

  stepElements.value.forEach((stepEl) => {
    if (stepEl) stepObserver.observe(stepEl)
  })
})

onBeforeUnmount(() => {
  if (stepObserver) {
    stepObserver.disconnect()
    stepObserver = null
  }
})
</script>

<template>
  <StorySection id="intro" height="min-screen" width="full" background="#041b46">
    <div class="intro-sequence">
      <div class="intro-sticky-layer">
        <div class="intro-image-shell">
          <img
            :key="currentImage.src"
            class="intro-image"
            :src="currentImage.src"
            :alt="currentImage.alt"
          />
        </div>
        <h1 class="intro-title">this is sushi.</h1>
      </div>

      <div class="intro-step-track" aria-hidden="true">
        <div
          v-for="(_, index) in imageSteps"
          :key="index"
          :ref="(el) => setStepRef(el, index)"
          class="intro-step"
          :data-step-index="index"
        />
      </div>
    </div>
  </StorySection>
</template>

<style scoped>
.intro-sequence {
  position: relative;
}

.intro-sticky-layer {
  position: sticky;
  top: 0;
  z-index: 2;
  height: 100vh;
  display: grid;
  grid-template-rows: 1fr auto;
}

.intro-title {
  margin: 0;
  padding: clamp(0.85rem, 2.5vw, 1.5rem) clamp(1rem, 3vw, 2rem);
  text-align: center;
  font-family: var(--font-copy-display);
  font-size: clamp(2rem, 6vw, 4.5rem);
  font-weight: 400;
  line-height: 1;
  text-transform: lowercase;
  background: rgba(0, 0, 0, 0.72);
  color: #fff;
}

.intro-image-shell {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.intro-image {
  width: auto;
  height: 100%;
  display: block;
  max-width: 100%;
  object-fit: contain;
}

.intro-step-track {
  position: relative;
  z-index: 1;
}

.intro-step {
  min-height: 100vh;
}

@media (max-width: 900px) {
  .intro-sticky-layer {
    height: 82vh;
  }

  .intro-step {
    min-height: 80vh;
  }
}
</style>

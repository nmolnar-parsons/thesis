<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import Intro from './sections/Intro.vue'
import Map from './sections/Map.vue'
import FishGrid from './sections/FishGrid.vue'
import ToyosuPrices from './sections/ToyosuPrices.vue'
import StackedBars from './sections/StackedBars.vue'
import Title from './sections/Title.vue'
import CountryProduction from './sections/CountryProduction.vue'
import DomesticImports from './sections/DomesticImports.vue'
import Ending from './sections/Ending.vue'

const minimalMode = ref(false)

function toggleMinimalMode() {
  minimalMode.value = !minimalMode.value
  console.info(`[story] minimalMode ${minimalMode.value ? 'enabled' : 'disabled'}`)
  return minimalMode.value
}

function advanceToNextSection() {
  if (!minimalMode.value) return

  const sections = Array.from(document.querySelectorAll('.story-page .story-section'))
  if (!sections.length) return

  const viewportAnchor = window.innerHeight * 0.35
  const currentIndex = sections.reduce((activeIndex, section, index) => {
    return section.getBoundingClientRect().top <= viewportAnchor ? index : activeIndex
  }, -1)
  const nextSection = sections[currentIndex + 1]

  if (nextSection) {
    nextSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

onMounted(() => {
  window.toggleMinimalMode = toggleMinimalMode
})

onUnmounted(() => {
  if (window.toggleMinimalMode === toggleMinimalMode) {
    delete window.toggleMinimalMode
  }
})
</script>

<template>
  <main class="story-page">
    <Intro />
    <FishGrid :minimal-mode="minimalMode" />
    <!-- <ToyosuPrices v-if="!minimalMode" /> -->
    <StackedBars :minimal-mode="minimalMode" />
    <Map :minimal-mode="minimalMode" />
    <CountryProduction :minimal-mode="minimalMode" />
    <DomesticImports :minimal-mode="minimalMode"  />
    <Ending />
    <button
      v-if="minimalMode"
      type="button"
      class="minimal-next-hitbox"
      aria-label="Advance to next section"
      @click="advanceToNextSection"
    />
  </main>
</template>

<style scoped>
.minimal-next-hitbox {
  position: fixed;
  left: 0.75rem;
  bottom: 0.75rem;
  width: clamp(3rem, 10vw, 4.5rem);
  height: clamp(3rem, 10vw, 4.5rem);
  border: 0;
  padding: 0;
  margin: 0;
  background: transparent;
  opacity: 0;
  cursor: pointer;
  z-index: 1000;
}
</style>

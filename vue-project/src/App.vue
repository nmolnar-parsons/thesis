<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
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
const isFullscreen = ref(false)

const fullscreenApiAvailable = computed(() => {
  const el = document.documentElement
  return typeof el.requestFullscreen === 'function' || typeof el.webkitRequestFullscreen === 'function'
})

function getFullscreenElement() {
  return document.fullscreenElement ?? document.webkitFullscreenElement ?? null
}

function syncFullscreenState() {
  isFullscreen.value = !!getFullscreenElement()
}

async function exitDocFullscreen() {
  const exit = document.exitFullscreen?.bind(document) ?? document.webkitExitFullscreen?.bind(document)
  if (!exit) return
  try {
    const result = exit()
    if (result && typeof result.then === 'function') await result
  } catch {
    /* user gesture / policy */
  }
}

async function requestDocFullscreen() {
  const el = document.documentElement
  const req = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el)
  if (!req) return
  try {
    const result = req()
    if (result && typeof result.then === 'function') await result
  } catch {
    /* user gesture / policy */
  }
}

async function toggleMinimalFullscreen() {
  if (getFullscreenElement()) {
    await exitDocFullscreen()
    return
  }
  await requestDocFullscreen()
}

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

function onFullscreenChange() {
  syncFullscreenState()
}

watch(minimalMode, (enabled) => {
  if (!enabled && getFullscreenElement()) {
    exitDocFullscreen()
  }
})

onMounted(() => {
  window.toggleMinimalMode = toggleMinimalMode
  document.addEventListener('fullscreenchange', onFullscreenChange)
  document.addEventListener('webkitfullscreenchange', onFullscreenChange)
  syncFullscreenState()
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
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
    <button
      v-if="minimalMode && fullscreenApiAvailable"
      type="button"
      class="minimal-fullscreen-hitbox"
      aria-label="Enter or exit fullscreen"
      :aria-pressed="isFullscreen"
      @click="toggleMinimalFullscreen"
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

.minimal-fullscreen-hitbox {
  position: fixed;
  right: 0.75rem;
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

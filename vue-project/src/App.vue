<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import Intro from './sections/Intro.vue'
import Map from './sections/Map.vue'
import Breakdown from './sections/Breakdown.vue'
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
    <Title />
    <Intro />
    <Breakdown :minimal-mode="minimalMode" />
    <ToyosuPrices v-if="!minimalMode" />
    <StackedBars :minimal-mode="minimalMode" />
    <Map :minimal-mode="minimalMode" />
    <CountryProduction :minimal-mode="minimalMode" />
    <DomesticImports v-if="!minimalMode" />
    <Ending />
  </main>
</template>

<script setup>
import Intro from './sections/Intro.vue'
import Map from './sections/Map.vue'
import Breakdown from './sections/Breakdown.vue'
import ToyosuPrices from './sections/ToyosuPrices.vue'
import StackedBars from './sections/StackedBars.vue'
import Title from './sections/Title.vue'
import CountryProduction from './sections/CountryProduction.vue'
import DomesticImports from './sections/DomesticImports.vue'
</script>

<template>
  <main class="story-page">
    <Title />
    <Intro />
    <Breakdown />
    <ToyosuPrices />
    <StackedBars />
    <Map />
    <CountryProduction />
    <DomesticImports />
  </main>
</template>

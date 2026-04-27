<script setup>
import SectionIntro from './sections/SectionIntro.vue'
import SectionMap from './sections/SectionMap.vue'
import SectionBreakdown from './sections/SectionBreakdown.vue'
import SectionToyosuPrices from './sections/SectionToyosuPrices.vue'
import SectionStackedBars from './sections/SectionStackedBars.vue'
import SectionTitle from './sections/SectionTitle.vue'
import SectionCountryProduction from './sections/SectionCountryProduction.vue'
import SectionFutures from './sections/SectionFutures.vue'
</script>

<template>
  <main class="story-page">
    <SectionTitle />
    <SectionIntro />
    <SectionBreakdown />
    <SectionToyosuPrices />
    <SectionStackedBars />
    <SectionMap />
    <SectionCountryProduction />
    <SectionFutures />
  </main>
</template>

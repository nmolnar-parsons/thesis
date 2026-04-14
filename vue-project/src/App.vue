<script setup>
import SectionIntro from './sections/SectionIntro.vue'
import SectionMap from './sections/SectionMap.vue'
import SectionBreakdown from './sections/SectionBreakdown.vue'
import SectionShippingPricing from './sections/SectionShippingPricing.vue'
import SectionHistoricalFishing from './sections/SectionHistoricalFishing.vue'
import SectionTitle from './sections/SectionTitle.vue'
import SectionFutures from './sections/SectionFutures.vue'
</script>

<template>
  <main class="story-page">
    <SectionTitle />
    <SectionIntro />
    <SectionBreakdown />
    <SectionShippingPricing />
    <SectionHistoricalFishing />
    <SectionMap />
    <SectionFutures />
  </main>
</template>

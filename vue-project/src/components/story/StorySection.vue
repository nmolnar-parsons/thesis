<script setup>
import { computed } from 'vue'

const props = defineProps({
  id: { type: String, default: '' },
  height: { type: String, default: 'min-screen' },
  width: { type: String, default: 'wide' },
  background: { type: String, default: 'var(--color-section-surface)' },
  visualPlacement: { type: String, default: 'fullbleed' },
})

const sectionClasses = computed(() => [
  'story-section',
  `height-${props.height}`,
  `width-${props.width}`,
  `visual-${props.visualPlacement}`,
])
</script>

<template>
  <section :id="id" :class="sectionClasses" :style="{ '--section-bg': background }">
    <slot />
  </section>
</template>

<style scoped>
.story-section {
  position: relative;
  padding: var(--story-section-padding-y) var(--story-section-padding-x);
  background: var(--section-bg);
}

.height-auto {
  min-height: auto;
}

.height-min-screen {
  min-height: 100vh;
}

.height-screen {
  height: 100vh;
}

.height-overscroll {
  min-height: 140vh;
}

.width-narrow {
  max-width: 760px;
  margin: 0 auto;
}

.width-reading {
  max-width: 900px;
  margin: 0 auto;
}

.width-wide {
  max-width: 1200px;
  margin: 0 auto;
}

.width-full {
  max-width: 100%;
}
</style>

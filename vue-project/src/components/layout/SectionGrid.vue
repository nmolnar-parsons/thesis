<script setup>
const props = defineProps({
  columns: { type: Number, default: 12 },
  gap: { type: String, default: '1rem' },
  align: { type: String, default: 'stretch' },
})
</script>

<template>
  <div
    class="section-grid"
    :style="{
      '--grid-cols': columns,
      '--grid-gap': gap,
      '--grid-align': align,
    }"
  >
    <slot />
  </div>
</template>

<style scoped>
.section-grid {
  display: grid;
  grid-template-columns: repeat(var(--grid-cols), minmax(0, 1fr));
  gap: var(--grid-gap);
  align-items: var(--grid-align);
}

@media (max-width: 900px) {
  .section-grid {
    grid-template-columns: 1fr;
  }
}
</style>

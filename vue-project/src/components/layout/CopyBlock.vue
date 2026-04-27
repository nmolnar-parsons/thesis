<script setup>
defineProps({
  eyebrow: { type: String, default: '' },
  title: { type: String, default: '' },
})
</script>

<template>
  <article class="copy-block">
    <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
    <h2 v-if="title">{{ title }}</h2>
    <slot />
  </article>
</template>

<style scoped>
/* .copy-block {
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 0.75rem;
  padding: 1rem 1.25rem;
} */

.eyebrow {
  margin: 0;
  color: var(--color-copy-eyebrow);
  font-size: var(--font-size-copy-eyebrow);
  font-family: var(--font-copy-display);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

h2 {
  margin: 0.4rem 0 0.65rem;
  font-size: var(--font-size-copy-title);
  color: var(--color-copy-title);
  font-family: var(--font-copy-display);
  font-weight: 400;
}

:deep(p) {
  margin: 0.5rem 0;
  color: var(--color-copy-body);
  font-family: var(--font-copy-display);
}
</style>

<script setup>
defineProps({
  anchor: { type: String, default: 'top-left' },
  maxWidth: { type: String, default: '340px' },
})
</script>

<template>
  <div class="overlay-copy" :class="`anchor-${anchor}`" :style="{ maxWidth }">
    <slot />
  </div>
</template>

<style scoped>
.overlay-copy {
  position: absolute;
  z-index: 3;
}

.anchor-top-left {
  top: 1rem;
  left: 1rem;
}

.anchor-top-right {
  top: 1rem;
  right: 1rem;
}

.anchor-center-left {
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
}

.anchor-center-right {
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
}

.anchor-bottom-left {
  left: 1rem;
  bottom: 1rem;
}

.anchor-bottom-right {
  right: 1rem;
  bottom: 1rem;
}
</style>

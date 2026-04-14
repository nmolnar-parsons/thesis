<script setup>
import StorySection from '../components/story/StorySection.vue'
</script>

<template>
  <StorySection id="title" height="screen" width="full" background="#e2e8f0">
    <div class="title-wrap">
      <h1>The Last Sushi in the World</h1>
    </div>
  </StorySection>
</template>

<style scoped>
.title-wrap {
  height: calc(100vh - 8rem);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #f8fafc;
}

.kicker {
  margin: 0;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.8;
}

h1 {
  margin: 0.65rem 0 0;
  font-size: clamp(2rem, 4vw, 4.2rem);
  max-width: 12ch;
}
</style>

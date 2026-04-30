<script setup>
import StorySection from '../components/story/StorySection.vue'
</script>

<template>
  <StorySection id="title" height="screen" width="full">
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
  justify-content: flex-start;
  padding-top: 12vh;
  text-align: center;
  color: #f8fafc;
  background-image: url('../visuals/tuna-earth/earth-nigiri.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
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
  text-shadow: 0 3px 14px rgba(0, 0, 0, 0.55);
}
</style>

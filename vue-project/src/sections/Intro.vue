<script setup>
import StorySection from '../components/story/StorySection.vue'
import SectionGrid from '../components/layout/SectionGrid.vue'
import CopyBlock from '../components/layout/CopyBlock.vue'
</script>

<template>
  <StorySection id="intro" height="min-screen" width="full">
    <SectionGrid :columns="12" gap="1.25rem" align="center">
      <div class="story-copy story-copy--top">
        <CopyBlock title="Sushi is everywhere.">
          <p>
            Sushi has penetrated every layer of cuisine in the United States. You can find it in most cities (even those
            very far from the ocean) and most price points. You can find it in grocery stores, gas stations, high-end restaurants,
            and probably off the back of some fishing boats. It has been changed, adapted, and bastardized to suit local food tastes and styles.
          </p>
          <p>
            Despite the rising price of fish, it remains a highly popular choice for Japanese, Americans, and many others around the world.
          </p>
        </CopyBlock>
      </div>

      <div class="story-copy story-copy--bottom">
        <CopyBlock title="">
          <p>
            By 2040, it is predicted that 90% of the ocean's marine life will be gone.
          </p>
          <p>
            When will we run out of sushi? When will the last sushi roll be made?
          </p>
        </CopyBlock>
      </div>
    </SectionGrid>
  </StorySection>
</template>

<style scoped>
.story-copy {
  position: relative;
  z-index: 1;
}
</style>

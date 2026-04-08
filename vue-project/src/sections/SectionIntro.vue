<script setup>
import StorySection from '../components/story/StorySection.vue'
import SectionGrid from '../components/layout/SectionGrid.vue'
import CopyBlock from '../components/layout/CopyBlock.vue'
import dainobuSushi from '../visuals/sushi-examples/dainobu-sushi.jpg'
import highEndSushi from '../visuals/sushi-examples/high-end-sushi.jpg'
import tekkaMaki from '../visuals/sushi-examples/tekka-maki.jpg'

const sushiImages = [
  {
    src: dainobuSushi,
    alt: 'NYC Grocery Sushi',
    caption: 'Cheaper stuff, where 6 rolls can cost $6,',
  },
  {
    src: tekkaMaki,
    alt: 'Tekka maki tuna rolls',
    caption: 'Medium-range, restaurant quality sushi, that you might find on a conveyor belt,',
  },
  {
    src: highEndSushi,
    alt: 'High-end sushi course plating',
    caption: 'Or high-end sushi that can cost as much as a flight to Japan itself.',
  },
]
</script>

<template>
  <StorySection id="intro" height="min-screen" width="full" background="#e2e8f0">
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

      <div class="intro-gallery">
        <figure v-for="image in sushiImages" :key="image.src" class="gallery-item">
          <img :src="image.src" :alt="image.alt" />
          <figcaption>{{ image.caption }}</figcaption>
        </figure>
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
.intro-gallery {
  grid-column: 3 / -3;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.85rem;
  margin: 0.5rem 0;
}

.gallery-item {
  margin: 0;
  background: #ffffff;
  /* border: 1px solid rgba(148, 163, 184, 0.45); */
  /* border-radius: 0.65rem; */
  overflow: hidden;
}

.gallery-item img {
  width: 100%;
  height: 200px;
  object-fit: cover;
  display: block;
}

.gallery-item figcaption {
  padding: 0.65rem 0.7rem 0.8rem;
  font-size: 0.87rem;
  color: #334155;
}

.intro-copy-bottom {
  margin-bottom: 0.5rem;
}

@media (max-width: 980px) {
  .intro-gallery {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

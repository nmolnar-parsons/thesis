<script setup>
import PinnedScrollSection from '../../components/story/PinnedScrollSection.vue'
import StorySection from '../../components/story/StorySection.vue'
import CopyBlock from '../../components/layout/CopyBlock.vue'
import FishGridVisual from './FishGridVisual.vue'

defineProps({
  minimalMode: {
    type: Boolean,
    default: false,
  },
})

const steps = [
  {
    id: 'fish-grid-single-fade',
    title: 'One fish',
    text: 'filler 1',
    visible: false,
  },
  {
    id: 'fish-grid-single-hold',
    title: 'This is a Bluefin Tuna.',
    text: '',
    visible: true,
  },
  {
    id: 'fish-grid-single-linger',
    title: '',
    text: 'At 550lbs and 13 feet of lenght on average, these fish are amongst the largest commerically harvested ocean-dwelling creatures on the planet.',
    visible: true,
  },
  {
    id: 'fish-grid-single-to-week',
    title: '',
    text: 'Bluefin tuna is the most prized fish for sushi, the once-niche Japanese delicacy that has conquered the restaurants of the world.',
    visible: true,
  },
  {
    id: 'fish-grid-week-hold',
    title: '',
    text: "In 2023, Tokyo's Toyosu Fish Market sold, on average, 156 bluefin tuna per week.",
    visible: true,
  },
  {
    id: 'fish-grid-week-linger',
    title: '',
    text: 'This is, roughly, 38 tonnes of fish.',
    visible: true,
  },
  {
    id: 'fish-grid-week-to-year',
    title: '',
    text: 'step',
    visible: false,
  },
  {
    id: 'fish-grid-year-hold',
    title: '',
    text: 'In the entirety of 2023, the same market sold 8,090 bluefin tuna.',
    visible: true,
  },
  {
    id: 'fish-grid-year-linger',
    title: 'Our demand for Bluefin has not slowed down. Are we running out?',
    text: '',
    visible: true,
  },
]
</script>

<template>
  <StorySection id="fish-grid" height="overscroll" width="full">
    <PinnedScrollSection :steps="steps" :scroll-offset="0.65">
      <template #graphic="graphicProps">
        <div class="fish-grid-graphic-wrap">
          <FishGridVisual
            :active-step="graphicProps.activeStep"
            :step-progress="graphicProps.stepProgress"
          />
        </div>
      </template>
      <template #step="{ step }">
        <CopyBlock v-if="!minimalMode && step.visible !== false" :title="step.title">
          <p>{{ step.text }}</p>
        </CopyBlock>
        <span v-else-if="minimalMode" class="fish-grid-step-slot" aria-hidden="true" />
      </template>
    </PinnedScrollSection>
  </StorySection>
</template>

<style scoped>
.fish-grid-graphic-wrap {
  position: relative;
  width: 100%;
  height: 100%;
}

#fish-grid :deep(.sticky-graphic) {
  background: #17203d;
}

.fish-grid-step-slot {
  display: block;
  width: 0;
  height: 0;
  overflow: hidden;
  visibility: hidden;
  pointer-events: none;
}
</style>

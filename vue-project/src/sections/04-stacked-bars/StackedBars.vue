<script setup>
import CopyBlock from '../../components/layout/CopyBlock.vue'
import SectionGrid from '../../components/layout/SectionGrid.vue'
import PinnedScrollSection from '../../components/story/PinnedScrollSection.vue'
import StorySection from '../../components/story/StorySection.vue'
import TunaStackedBarsVisual from './TunaStackedBarsVisual.vue'

defineProps({
  minimalMode: {
    type: Boolean,
    default: false,
  },
})

const steps = [
  {
    id: 'chart-intro',
    title: 'Here is the bar chart.',
    text: 'Each column is a year of global tuna catch. Scroll to watch the series build.',
    visible: false,
  },
  {
    id: 'hf1',
    title: '',
    text: "As sushi's popularity grew, so did the demand for bluefin tuna. In the 1980s, it became possible and profitable to ship Atlantic bluefin tuna to Japan.",
    visible: true,
  },
  {
    id: 'hf1a',
    title: '',
    text: 'This reliance on Japan was a double-edged sword: the decline of the Japanese economy towards the 1990s marked a decrease in demand for bluefin tuna and a resulting decline in catch.',
    visible: true,
  },
  {
    id: 'hf1b',
    title: '',
    text: 'Yet changes in sushi culture (conveyer belt sushi and the spread of sushi overseas) led to resurgent catch numbers. By 2007, over 60,000 tonnes of Atlantic bluefin tuna were caught yearly.',
    visible: true,
  },
  {
    id: 'hf2',
    title: '',
    text: 'Two years later, the global catch had fallen by 80%. Not for any change in demand — sushi remained popular - but a historic level of overfishing. The population was at risk of complete collapse. Strict management measures were put in place.',
    visible: true,
  },
  {
    id: 'hf2-linger',
    title: '',
    text: 'This is where the story of Bluefin tuna is stuck.',
    visible: true,
  },
  {
    id: 'hf3',
    title: '',
    text: "Yet slowly, the stock has recovered. Atlantic bluefin has moved from Endangered to Least Concern status, and quotas have increased. There is no immediate risk of a stock collapse, and so no immediate risk of a type of sushi wiped from existence.",
    visible: true,
  }
]
</script>

<template>
  <StorySection id="stacked-bars" height="overscroll" width="full">
    <SectionGrid v-if="!minimalMode" class="stacked-bars-lead-grid" :columns="12" gap="1.25rem" align="start">
      <div class="story-copy story-copy--top">
        <CopyBlock title="Bluefin Tuna was on the brink of extinction.">
          <p>
            The article is in progress, I swear it. I'm not happy with putting it here until it's ready so unfortunately
            you're going to have to deal with the Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et
          </p>
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et
            dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex
            ea commodo consequat.
          </p>
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et
            dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex
            ea commodo consequat.
          </p>
        </CopyBlock>
      </div>
    </SectionGrid>
    <div class="stacked-bars-scrolly">
      <PinnedScrollSection :steps="steps" :scroll-offset="0.72">
        <template #graphic="graphicProps">
          <TunaStackedBarsVisual :active-step="graphicProps.activeStep" />
        </template>
        <template #step="{ step }">
          <CopyBlock v-if="!minimalMode && step.visible !== false" :title="step.title">
            <p style="white-space: pre-line">{{ step.text }}</p>
          </CopyBlock>
          <span v-else-if="minimalMode" class="stacked-bars-step-slot" aria-hidden="true" />
        </template>
      </PinnedScrollSection>
    </div>
  </StorySection>
</template>

<style scoped>
.stacked-bars-lead-grid {
  width: 100%;
  padding-bottom: clamp(1rem, 4vh, 2.5rem);
}

.stacked-bars-scrolly {
  width: 100%;
}

.stacked-bars-lead {
  min-height: clamp(5rem, 26vh, 16rem);
  pointer-events: none;
}

.stacked-bars-step-slot {
  display: block;
  width: 0;
  height: 0;
  overflow: hidden;
  visibility: hidden;
  pointer-events: none;
}

#stacked-bars :deep(.sticky-graphic) {
  background: var(--color-section-surface);
  display: flex;
  align-items: center;
}

#stacked-bars :deep(.sticky-graphic > *) {
  width: 100%;
}
</style>

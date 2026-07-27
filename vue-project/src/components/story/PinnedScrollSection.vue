<script setup>
import { computed, onMounted, ref } from 'vue'
import { useScrollSteps } from '../../composables/useScrollSteps'

const emit = defineEmits(['step-enter', 'step-exit', 'step-progress'])
const sectionRef = ref(null)

const props = defineProps({
  steps: { type: Array, default: () => [] },
  scrollOffset: { type: Number, default: 0.55 },
})

const { activeStep, progress, setup } = useScrollSteps({
  offset: props.scrollOffset,
  onEnter: (payload) => emit('step-enter', payload),
  onExit: (payload) => emit('step-exit', payload),
  onProgress: (value) => emit('step-progress', value),
})

const graphicSlotProps = computed(() => ({
  activeStep: activeStep.value,
  stepProgress: progress.value,
}))

onMounted(() => {
  setup(sectionRef.value, '.scroll-step')
})
</script>

<template>
  <section ref="sectionRef" class="pinned-scroll-section">
    <div class="sticky-graphic">
      <slot name="graphic" v-bind="graphicSlotProps" />
    </div>
    <div class="step-column">
      <article
        v-for="(step, index) in steps"
        :key="step.id || index"
        class="scroll-step"
        :class="{ active: index === activeStep }"
      >
        <div v-show="step.visible !== false" class="step-content">
          <slot name="step" :step="step" :index="index" :active-step="activeStep">
            <div class="step-card">
              <h3>{{ step.title }}</h3>
              <p>{{ step.text }}</p>
            </div>
          </slot>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.pinned-scroll-section {
  position: relative;
}

.sticky-graphic {
  position: sticky;
  top: 0;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: var(--color-sticky-graphic-bg);
}

.step-column {
  position: relative;
  margin-top: -100vh;
  padding: 0;
  z-index: 2;
}

.scroll-step {
  /* Full viewport+ so the next copy enters only after the previous has left the top */
  min-height: 110vh;
  padding: var(--scroll-step-padding);
  display: flex;
  align-items: center;
  justify-content: center;
}

.step-card {
  width: var(--step-card-max-width);
  padding: var(--step-card-padding-y) var(--step-card-padding-x);
  border-radius: var(--step-card-radius);
  background: var(--color-step-card-bg);
  border: var(--color-step-card-border);
  opacity: 0.45;
  transition: opacity 220ms ease;
}

.scroll-step.active .step-card {
  opacity: 1;
}

.step-card h3 {
  margin: 0;
  font-family: var(--font-copy-title);
  font-size: var(--font-size-copy-title);
  font-weight: var(--font-weight-copy-title);
  color: var(--color-copy-title);
}

.step-card p {
  font-family: var(--font-copy);
  font-weight: var(--font-weight-copy);
  font-size: var(--font-size-copy);
  color: var(--color-copy-body);
}

@media (max-width: 900px) {
  .sticky-graphic {
    top: 0;
    height: 100vh;
    height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .sticky-graphic > * {
    width: 100%;
    max-height: 100%;
  }

  .step-column {
    margin-top: -100vh;
    margin-top: -100dvh;
  }

  .scroll-step {
    min-height: 100vh;
    min-height: 100dvh;
  }
}
</style>

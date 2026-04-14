import { onMounted, onUnmounted, ref } from 'vue'
import scrollama from 'scrollama'

export function useScrollSteps(options = {}) {
  const activeStep = ref(0)
  const progress = ref(0)
  const scroller = scrollama()

  const setup = (containerEl, stepSelector = '.scroll-step') => {
    if (!containerEl) return

    scroller
      .setup({
        step: `${stepSelector}`,
        parent: containerEl,
        container: containerEl,
        offset: options.offset ?? 0.55,
        progress: true,
      })
      .onStepEnter(({ index, element, direction }) => {
        activeStep.value = index
        if (options.onEnter) options.onEnter({ index, element, direction })
      })
      .onStepExit(({ index, element, direction }) => {
        if (options.onExit) options.onExit({ index, element, direction })
      })
      .onStepProgress(({ progress: p }) => {
        progress.value = p
        if (options.onProgress) options.onProgress(p)
      })
  }

  onMounted(() => {
    window.addEventListener('resize', scroller.resize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', scroller.resize)
    scroller.destroy()
  })

  return { activeStep, progress, setup }
}

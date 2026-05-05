<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import StorySection from '../components/story/StorySection.vue'
import bluefinStill from '../visuals/intro/bluefin-still.jpg'
import fishingBoatTuna from '../visuals/intro/fishing-boat-tuna.png'
import tsukijiAuction from '../visuals/intro/tsukiji-auction.png'
import tunaNigiri from '../visuals/intro/tuna-nigiri.jpg'

const columns = [
  {
    src: bluefinStill,
    alt: 'School of bluefin tuna swimming underwater',
  },
  {
    src: fishingBoatTuna,
    alt: 'Large tuna hanging from hooks at a commercial fishing dock',
  },
  {
    src: tsukijiAuction,
    alt: 'Rows of tuna laid out at a fish market auction hall',
  },
  {
    src: tunaNigiri,
    alt: 'Piece of tuna nigiri sushi on a dark lacquer plate',
  },
]

/** One column unroll occupies this fraction of scrub 0→1; next starts at (2/3)·phase of previous ⇒ total phase = 1. */
const COLUMN_PHASE = 1 / 3
const COL_START_FRAC = [0, 2 / 9, 4 / 9, 2 / 3]

const scrollerEl = ref(null)
/** Overall 0→1 while intro scroller travels through viewport; tail before unpin is dwell. */
const scrollRaw = ref(0)
const prefersReducedMotion = ref(false)

const MAX_BLUR_PX = 18

/** Column stagger completes when scrollRaw reaches this proportion. */
const COLUMNS_COMPLETE_AT_RAW = 0.66

/** Title opacity ramps with scroll; hits 1 at TITLE_FADE_END_RAW (before scrollRaw === 1). */
const TITLE_FADE_START_RAW = 0.48
const TITLE_FADE_END_RAW = 0.82

function clamp01(x) {
  return Math.min(1, Math.max(0, x))
}

function columnLocalProgress(i, p) {
  const start = COL_START_FRAC[i]
  return clamp01((p - start) / COLUMN_PHASE)
}

const columnDrive = computed(() =>
  prefersReducedMotion.value ? 1 : clamp01(scrollRaw.value / COLUMNS_COMPLETE_AT_RAW),
)

const columnProgress = computed(() =>
  columns.map((_, i) => columnLocalProgress(i, columnDrive.value)),
)

const titleOpacity = computed(() =>
  prefersReducedMotion.value
    ? 1
    : clamp01(
        (scrollRaw.value - TITLE_FADE_START_RAW) /
          (TITLE_FADE_END_RAW - TITLE_FADE_START_RAW),
      ),
)

const titleAriaHidden = computed(() =>
  prefersReducedMotion.value ? false : titleOpacity.value <= 0.02,
)

/** Blur sits in an overflow-hidden slab from the column top; slab height shrinks so edges are rectangular, not clip-path/filter feathering. */
function blurPaneStyle(lp) {
  if (prefersReducedMotion.value)
    return { display: 'none' }
  const remain = clamp01(lp)
  return { height: `${(1 - remain) * 100}%` }
}

function blurLayerFilterStyle() {
  if (prefersReducedMotion.value)
    return {}
  return { filter: `blur(${MAX_BLUR_PX}px)` }
}

function syncScrollRawFromViewport() {
  const root = scrollerEl.value
  if (!root) return
  if (prefersReducedMotion.value) {
    scrollRaw.value = 1
    return
  }
  const rootTop = root.getBoundingClientRect().top + window.scrollY
  const scrollRange = Math.max(root.offsetHeight - window.innerHeight, 1)
  scrollRaw.value = clamp01((window.scrollY - rootTop) / scrollRange)
}

let motionMq

function readReducedMotion() {
  const reduce = !!motionMq?.matches
  prefersReducedMotion.value = reduce
  scrollRaw.value = reduce ? 1 : scrollRaw.value
  syncScrollRawFromViewport()
}

let raf = 0
function onScroll() {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(syncScrollRawFromViewport)
}

onMounted(() => {
  motionMq = window.matchMedia('(prefers-reduced-motion: reduce)')
  readReducedMotion()
  motionMq.addEventListener('change', readReducedMotion)
  syncScrollRawFromViewport()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll, { passive: true })
})

onUnmounted(() => {
  cancelAnimationFrame(raf)
  motionMq?.removeEventListener('change', readReducedMotion)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
})
</script>

<template>
  <StorySection id="intro" height="auto" width="full" background="#041b46">
    <div ref="scrollerEl" class="intro-scroller">
      <div class="intro-shell">
        <div class="intro-grid">
          <div v-for="(col, index) in columns" :key="index" class="intro-col">
            <div class="intro-col-stack">
              <img class="intro-col-img intro-col-img--base" :src="col.src" :alt="col.alt" />
              <div class="intro-blur-pane" :style="blurPaneStyle(columnProgress[index])">
                <img
                  class="intro-col-img intro-col-img--blur-inner"
                  :src="col.src"
                  alt=""
                  aria-hidden="true"
                  :style="blurLayerFilterStyle()"
                />
              </div>
            </div>
          </div>
        </div>
        <h2
          class="intro-title"
          :style="{
            opacity: titleOpacity,
            visibility: titleOpacity > 0.02 ? 'visible' : 'hidden',
          }"
          :aria-hidden="titleAriaHidden"
        >
          this is sushi.
        </h2>
      </div>
    </div>
  </StorySection>
</template>

<style scoped>
:deep(#intro) {
  padding: 0;
}

.intro-scroller {
  position: relative;
  min-height: 320vh;
}

.intro-shell {
  position: sticky;
  top: 0;
  width: 100%;
  min-height: 100vh;
  height: min(100vh, 100dvh);
}

.intro-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  width: 100%;
  min-height: 100vh;
  height: min(100vh, 100dvh);
}

.intro-col {
  position: relative;
  min-height: 100vh;
  height: min(100vh, 100dvh);
  overflow: hidden;
  border-radius: 0;
}

.intro-col-stack {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 0;
  transform: translateZ(0);
  contain: paint;
  container-type: size;
  container-name: intro-stack;
}

.intro-col-img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  object-position: center;
  border-radius: 0;
  vertical-align: top;
}

.intro-blur-pane {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  overflow: hidden;
  z-index: 1;
  border-radius: 0;
  pointer-events: none;
}

.intro-col-img--blur-inner {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100cqh;
  max-height: none;
  box-sizing: border-box;
  object-fit: cover;
  object-position: center;
  border-radius: 0;
  will-change: filter;
}

@supports not (height: 1cqh) {
  .intro-col-img--blur-inner {
    height: min(100vh, 100dvh);
  }
}

.intro-title {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: clamp(1rem, 3vw, 2rem);
  text-align: center;
  pointer-events: none;
  font-family: var(--font-copy-display);
  font-size: clamp(2rem, 6vw, 4.5rem);
  font-weight: 400;
  line-height: 1;
  text-transform: lowercase;
  color: #fff;
  -webkit-text-stroke: 1px rgba(0, 0, 0, 0.75);
  text-shadow:
    0 0 2px #000,
    0 0 4px rgba(0, 0, 0, 0.8),
    0 4px 12px rgba(0, 0, 0, 0.6),
    0 8px 28px rgba(0, 0, 0, 0.45);
}

@media (max-width: 720px) {
  .intro-grid {
    grid-template-columns: 1fr;
  }

  .intro-col {
    min-height: 40vh;
    height: auto;
  }
}

@media (min-width: 721px) and (max-width: 900px) {
  .intro-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .intro-col {
    min-height: 50vh;
    height: auto;
  }
}
</style>

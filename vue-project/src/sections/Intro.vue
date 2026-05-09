<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import StorySection from '../components/story/StorySection.vue'
import bluefinStill from '../visuals/intro/bluefin-still.jpg'
import fishingBoatTuna from '../visuals/intro/fishing-boat-tuna.png'
import tsukijiAuction from '../visuals/intro/tsukiji-auction.png'
import tunaNigiriAlt from '../visuals/intro/tuna-nigiri-alt.jpg'

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
    src: tunaNigiriAlt,
    alt: 'Piece of tuna nigiri sushi on a dark lacquer plate',
  },
]

const scrollerEl = ref(null)
/** Overall 0→1 while intro scroller travels through viewport; tail before unpin is dwell. */
const scrollRaw = ref(0)
const prefersReducedMotion = ref(false)

/** Title opacity ramps with scroll; hits 1 at TITLE_FADE_END_RAW (before scrollRaw === 1). */
const TITLE_FADE_START_RAW = 0.48
const TITLE_FADE_END_RAW = 0.82

function clamp01(x) {
  return Math.min(1, Math.max(0, x))
}

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
  <div class="intro-outer">
    <StorySection id="intro" height="auto" width="full" background="#041b46">
      <div ref="scrollerEl" class="intro-scroller">
        <div class="intro-shell">
          <div class="intro-grid">
            <div v-for="(col, index) in columns" :key="index" class="intro-col">
              <div class="intro-col-stack">
                <img class="intro-col-img" :src="col.src" :alt="col.alt" />
              </div>
            </div>
          </div>
          <h1
            class="intro-title"
            :style="{
              opacity: titleOpacity,
              visibility: titleOpacity > 0.02 ? 'visible' : 'hidden',
            }"
            :aria-hidden="titleAriaHidden"
          >
            The Last Sushi <br>in the World
          </h1>
        </div>
      </div>
    </StorySection>
  </div>
</template>

<style scoped>
/* #intro is the StorySection root, so :deep(#intro) never matched; pad via wrapper. */
.intro-outer :deep(#intro.story-section) {
  padding-top: 0;
  padding-bottom: 0;
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
  font-family: var(--font-title);
  font-size: clamp(3rem, 11vw, 8rem);
  font-weight: 400;
  letter-spacing: -0.02em;
  line-height: 1;
  color: #ffffff;
  /* -webkit-text-stroke: 1px rgba(0, 0, 0, 0.95); */
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

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import atlantic from './tuna-images/atlantic-bluefin.png'
import pacific from './tuna-images/pacific-bluefin.png'
import southern from './tuna-images/southern-bluefin.png'

const IMAGES = [atlantic, pacific, southern]
/** Dense continuous rain — scroll does not affect timing. */
const POOL_SIZE = 300

const prefersReducedMotion = ref(false)
let motionMq

function hash01(i) {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

function readReducedMotion() {
  prefersReducedMotion.value = !!motionMq?.matches
}

onMounted(() => {
  motionMq = window.matchMedia('(prefers-reduced-motion: reduce)')
  readReducedMotion()
  motionMq.addEventListener('change', readReducedMotion)
})

onUnmounted(() => {
  motionMq?.removeEventListener('change', readReducedMotion)
})

const fishPool = Array.from({ length: POOL_SIZE }, (_, i) => {
  const leftPct = hash01(i * 3.17) * 100
  /** Tight delay spread so many loops overlap (heavier rain). */
  const delaySec = hash01(i * 7.91) * 5
  const src = IMAGES[Math.floor(hash01(i * 2.41) * IMAGES.length)]
  const sizeRem = 2.5 + hash01(i * 5.03) * 3.25
  const dur = 5 + hash01(i * 13.7) * 6
  return { id: i, leftPct, delaySec, src, sizeRem, dur }
})

function fishColumnStyle(fish) {
  if (prefersReducedMotion.value) {
    const y = 8 + hash01(fish.id * 11.2) * 72
    return {
      left: `${fish.leftPct}%`,
      top: `${y}%`,
      transform: 'translate(-50%, -50%)',
    }
  }
  return {
    left: `${fish.leftPct}%`,
    transform: 'translateX(-50%)',
  }
}

function fishWrapStyle(fish) {
  if (prefersReducedMotion.value) {
    return { animation: 'none' }
  }
  return {
    animationDuration: `${fish.dur.toFixed(2)}s`,
    animationDelay: `${fish.delaySec.toFixed(2)}s`,
  }
}

function fishImgStyle(fish) {
  return {
    width: `${fish.sizeRem}rem`,
  }
}
</script>

<template>
  <div
    class="tuna-rain"
    :class="{ 'tuna-rain--reduced': prefersReducedMotion }"
    aria-hidden="true"
  >
    <div class="tuna-rain__scrim" />
    <div class="tuna-rain__sprites">
      <div
        v-for="fish in fishPool"
        :key="fish.id"
        class="tuna-rain__fish-column"
        :style="fishColumnStyle(fish)"
      >
        <div class="tuna-rain__fish-wrap" :style="fishWrapStyle(fish)">
          <img
            class="tuna-rain__fish"
            :src="fish.src"
            alt=""
            :style="fishImgStyle(fish)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tuna-rain {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.tuna-rain__scrim {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(
    180deg,
    rgba(4, 27, 70, 0.42) 0%,
    rgba(4, 27, 70, 0.28) 45%,
    rgba(4, 27, 70, 0.4) 100%
  );
  pointer-events: none;
}

.tuna-rain__sprites {
  position: absolute;
  inset: 0;
  z-index: 0;
  opacity: 0.92;
}

.tuna-rain__fish-column {
  position: absolute;
  top: 0;
  width: 0;
  display: flex;
  justify-content: center;
}

.tuna-rain__fish-wrap {
  position: absolute;
  top: -12vh;
  left: 0;
  will-change: transform;
  animation-name: tuna-fall;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

.tuna-rain__fish {
  display: block;
  height: auto;
  object-fit: contain;
  transform: rotate(90deg);
  transform-origin: center center;
  opacity: 0.9;
  filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.35));
}

.tuna-rain--reduced .tuna-rain__sprites {
  opacity: 0.4;
}

.tuna-rain--reduced .tuna-rain__fish-wrap {
  position: relative;
  top: auto;
  left: auto;
}

.tuna-rain--reduced .tuna-rain__fish {
  opacity: 0.42;
}

@keyframes tuna-fall {
  0% {
    transform: translateY(-18vh);
  }
  100% {
    transform: translateY(118vh);
  }
}
</style>

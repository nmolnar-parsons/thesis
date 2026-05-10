const FALLBACK_DEFAULT_BLUE = '#13265f'
const FALLBACK_TUNA_FARMED = '#1b4d58'

/** Reads `--color-default-blue` from `story.css`; used where JS APIs need a literal color. */
export function readColorDefaultBlue() {
  if (typeof document === 'undefined') return FALLBACK_DEFAULT_BLUE
  const v = getComputedStyle(document.documentElement).getPropertyValue('--color-default-blue').trim()
  return v || FALLBACK_DEFAULT_BLUE
}

/** Reads `--color-tuna-farmed` from `story.css` (streamgraph MARINE layer, map farm points). */
export function readColorTunaFarmed() {
  if (typeof document === 'undefined') return FALLBACK_TUNA_FARMED
  const v = getComputedStyle(document.documentElement).getPropertyValue('--color-tuna-farmed').trim()
  return v || FALLBACK_TUNA_FARMED
}

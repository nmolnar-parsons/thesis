const FALLBACK_DEFAULT_BLUE = '#13265f'

/** Reads `--color-default-blue` from `story.css`; used where JS APIs need a literal color. */
export function readColorDefaultBlue() {
  if (typeof document === 'undefined') return FALLBACK_DEFAULT_BLUE
  const v = getComputedStyle(document.documentElement).getPropertyValue('--color-default-blue').trim()
  return v || FALLBACK_DEFAULT_BLUE
}

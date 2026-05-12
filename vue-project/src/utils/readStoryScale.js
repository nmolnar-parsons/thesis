export function readStoryScale(scopeEl) {
  if (typeof document === 'undefined' || typeof getComputedStyle === 'undefined') return 1

  const scope =
    typeof Element !== 'undefined' && scopeEl instanceof Element
      ? scopeEl
      : document.documentElement
  const raw =
    getComputedStyle(scope).getPropertyValue('--story-scale').trim() ||
    getComputedStyle(document.documentElement).getPropertyValue('--story-scale').trim()
  const scale = Number.parseFloat(raw)

  return Number.isFinite(scale) && scale > 0 ? scale : 1
}

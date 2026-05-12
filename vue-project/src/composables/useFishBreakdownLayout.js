/**
 * Shared layout for FishGridVisual canvas and FishGrid annotation overlay.
 * Keep padding and grid math identical to the visual’s draw path.
 */

export function parse2023Counts(csvText) {
  const lines = csvText.trim().split(/\r?\n/)
  let yearFishCount = 0
  const weeks = new Set()

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    const cols = line.split(',')
    if (cols.length < 10) continue
    const year = Number(cols[0])
    if (year !== 2023) continue
    const approxFish = Number(cols[8])
    const weekNumber = Number(cols[9])
    if (Number.isFinite(approxFish)) yearFishCount += approxFish
    if (Number.isFinite(weekNumber)) weeks.add(weekNumber)
  }

  const weekCount = Math.max(1, weeks.size)
  const weekFishCount = Math.ceil(yearFishCount / weekCount)
  return { weekFishCount, yearFishCount }
}

export function getGridLayout(count, boxWidth, boxHeight, left, top, baseFishWidth, baseFishHeight, baseGap) {
  const safeCount = Math.max(1, count)
  const usableW = Math.max(80, boxWidth)
  const usableH = Math.max(80, boxHeight)

  const initialCols = Math.max(1, Math.ceil(Math.sqrt((safeCount * usableW) / usableH)))
  const maxCols = Math.min(safeCount, Math.max(initialCols * 2, initialCols + 6))
  const minCols = Math.max(1, Math.floor(initialCols / 2))

  let best = null
  for (let cols = minCols; cols <= maxCols; cols++) {
    const rows = Math.ceil(safeCount / cols)
    const contentW = cols * baseFishWidth + Math.max(0, cols - 1) * baseGap
    const contentH = rows * baseFishHeight + Math.max(0, rows - 1) * baseGap
    const fitScale = Math.min(usableW / contentW, usableH / contentH)
    if (!Number.isFinite(fitScale) || fitScale <= 0) continue
    if (!best || fitScale > best.fitScale) {
      best = { cols, rows, fitScale }
    }
  }

  if (!best) {
    best = { cols: 1, rows: safeCount, fitScale: 1 }
  }

  const fishW = baseFishWidth * best.fitScale
  const fishH = baseFishHeight * best.fitScale
  const gap = baseGap * best.fitScale

  const positions = []
  for (let i = 0; i < safeCount; i++) {
    const row = Math.floor(i / best.cols)
    const col = i % best.cols
    const x = left + col * (fishW + gap)
    const y = top + row * (fishH + gap)
    positions.push({ x, y, w: fishW, h: fishH })
  }

  return {
    left,
    top,
    width: best.cols * fishW + Math.max(0, best.cols - 1) * gap,
    height: best.rows * fishH + Math.max(0, best.rows - 1) * gap,
    positions,
  }
}

/**
 * @param {number} width - CSS pixels (e.g. canvas clientWidth)
 * @param {number} height - CSS pixels
 * @param {number} fishAspect width/height of fish image
 * @param {{ weekFishCount: number, yearFishCount: number }} fishTotals
 */
export function computeFishBreakdownLayout(width, height, fishAspect, fishTotals) {
  const aspectRatio = fishAspect
  const edgePad = Math.max(36, width * 0.08)
  const bottomPad = Math.max(36, height * 0.08)
  const titlePad = Math.max(76, height * 0.16)
  const contentTop = titlePad
  const contentHeight = Math.max(60, height - contentTop - bottomPad)
  const contentWidth = Math.max(60, width - 2 * edgePad)

  const singleW = Math.min(contentWidth * 0.62, contentHeight * 0.8 * aspectRatio)
  const singleH = singleW / aspectRatio

  const singleCenterRect = {
    x: (width - singleW) / 2,
    y: contentTop + (contentHeight - singleH) / 2,
    w: singleW,
    h: singleH,
  }

  const gridLeft = edgePad
  const gridTop = contentTop
  const baseGap = Math.max(2, singleH * 0.04)
  const weekContentHeight = contentHeight * 0.72

  const weekLayout = getGridLayout(
    fishTotals.weekFishCount,
    contentWidth,
    weekContentHeight,
    gridLeft,
    gridTop,
    singleW,
    singleH,
    baseGap,
  )
  const yearLayout = getGridLayout(
    fishTotals.yearFishCount,
    contentWidth,
    contentHeight,
    gridLeft,
    gridTop,
    singleW,
    singleH,
    baseGap,
  )

  const weekTopLeft = weekLayout.positions[0] || { x: gridLeft, y: gridTop, w: singleW, h: singleH }
  const yearTopLeft = yearLayout.positions[0] || weekTopLeft

  return {
    width,
    height,
    edgePad,
    contentTop,
    contentWidth,
    contentHeight,
    singleCenterRect,
    weekLayout,
    yearLayout,
    weekTopLeft,
    yearTopLeft,
  }
}

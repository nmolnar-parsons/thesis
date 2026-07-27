export const BLUEFIN_YEAR_AXIS_TICKS = Object.freeze([
  1965,
  1970,
  1975,
  1980,
  1985,
  1990,
  1995,
  2000,
  2005,
  2010,
  2015,
  2020,
])

/** Every ~10 years — fewer colliding labels on narrow chart hosts. */
export const BLUEFIN_YEAR_AXIS_TICKS_COMPACT = Object.freeze([
  1965,
  1975,
  1985,
  1995,
  2005,
  2015,
  2020,
])

const COMPACT_YEAR_TICK_WIDTH = 640

export function yearAxisTicksForWidth(width) {
  return width < COMPACT_YEAR_TICK_WIDTH ? BLUEFIN_YEAR_AXIS_TICKS_COMPACT : BLUEFIN_YEAR_AXIS_TICKS
}

export function formatYearTick(d) {
  return Number(d).toString()
}

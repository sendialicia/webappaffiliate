/**
 * Shared placement for every Recharts tooltip: always below the cursor and to its right, so it
 * sits past the mark being read instead of on top of it. Vertically it never flips (it may run
 * below the chart, hence the z-index); horizontally it still flips at the chart's right edge so
 * it is not cut off.
 */
export const TOOLTIP_PLACEMENT = {
  allowEscapeViewBox: { x: false, y: true },
  offset: 16,
  wrapperStyle: { zIndex: 60, pointerEvents: "none" as const },
}

const FIT_PADDING = 0.92;

/** The rope spreads over a canvas a bit larger than the screen — more so for longer ropes. */
export function getCanvasSize(nodeCount: number, viewportMax: number): number {
  return viewportMax * (1.1 + nodeCount / 50);
}

/** Badge puzzles only scramble their interior nodes, not the outer
 * silhouette (see scrambleBadgeGraph), so they need a much bigger canvas
 * than a normal level's to actually deliver on the "many dots, giant
 * space" idea from early planning — tripling getCanvasSize's ratio gives
 * real room to pan into around the badge's drawing instead of a canvas
 * that's barely bigger than the shape itself. */
export function getBadgeCanvasSize(nodeCount: number, viewportMax: number): number {
  return viewportMax * 3 * (1.1 + nodeCount / 50);
}

/** Fraction of a badge canvas' side given over to margin on each edge —
 * the badge's drawing (see badges.ts's getBadgeSolvedGraph) is fit into
 * the remaining central square, so this controls how small an island the
 * drawing sits on relative to the empty space surrounding it. */
export const BADGE_CANVAS_MARGIN_FRACTION = 0.3;

/** Clamps a pan/zoom translate so the canvas can never be dragged past its own edge. */
export function clampTranslate(value: number, scale: number, canvasSize: number, viewportLength: number) {
  'worklet';
  const contentLength = canvasSize * scale;
  if (contentLength <= viewportLength) {
    return (viewportLength - contentLength) / 2;
  }
  const min = viewportLength - contentLength;
  return Math.min(Math.max(value, min), 0);
}

export function getFitScale(canvasSize: number, viewportMin: number): number {
  return (viewportMin / canvasSize) * FIT_PADDING;
}

/**
 * Camera that centers `canvasSize`'s middle in the viewport, zoomed to fit
 * `focusSize` (defaulting to the whole canvas) rather than the canvas
 * itself — a badge's drawing sits centered in a much bigger canvas (see
 * getBadgeCanvasSize), so focusing on just its own footprint is what makes
 * the puzzle open already zoomed into the drawing instead of showing it as
 * a speck in a sea of empty canvas.
 */
export function getFitCamera(canvasSize: number, width: number, height: number, focusSize: number = canvasSize) {
  const fitScale = getFitScale(focusSize, Math.min(width, height));
  return {
    scale: fitScale,
    translateX: width / 2 - fitScale * (canvasSize / 2),
    translateY: height / 2 - fitScale * (canvasSize / 2),
  };
}

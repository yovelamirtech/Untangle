const FIT_PADDING = 0.92;

/** How much extra safety margin (beyond the bare minimum) to leave when
 * zooming in so the canvas' own border stroke stays comfortably outside
 * the initial viewport in every direction, on top of just barely clearing
 * it — matches the "zoomed in enough to hide the board's edges, and a bit
 * more" brief. */
const BORDER_HIDE_SAFETY = 1.08;

/** How much extra zoom Badge Challenge's initial view gets beyond a normal
 * level's — the board edges should feel much further away than in a
 * normal level's more modest zoom-in. */
export const BADGE_ZOOM_TIGHTNESS = 1.7;

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

/**
 * The largest "focus" square — the area the initial camera zooms to fit
 * (see getFitCamera) — that still keeps the *full* canvas covering the
 * viewport in both dimensions once the camera fits to it, so the canvas'
 * own border stroke never appears at the initial zoom.
 *
 * Computed from the actual screen aspect ratio rather than a fixed
 * fraction: fitting only to the shorter dimension (as getFitScale does)
 * would otherwise letterbox a tall phone screen above/below a square
 * canvas, exposing the border there even though the shorter dimension was
 * covered. `tightness` > 1 shrinks the result further for extra zoom
 * (see BADGE_ZOOM_TIGHTNESS).
 */
export function getInitialFocusSize(
  canvasSize: number,
  width: number,
  height: number,
  tightness: number = 1
): number {
  const viewportMin = Math.min(width, height);
  const viewportMax = Math.max(width, height);
  const focusSize = (canvasSize * viewportMin * FIT_PADDING) / (viewportMax * BORDER_HIDE_SAFETY * tightness);
  return Math.min(focusSize, canvasSize * 0.95);
}

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

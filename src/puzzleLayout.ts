const FIT_PADDING = 0.92;

/** The rope spreads over a canvas a bit larger than the screen — more so for longer ropes. */
export function getCanvasSize(nodeCount: number, viewportMax: number): number {
  return viewportMax * (1.1 + nodeCount / 50);
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

export function getFitCamera(canvasSize: number, width: number, height: number) {
  const fitScale = getFitScale(canvasSize, Math.min(width, height));
  return {
    scale: fitScale,
    translateX: (width - canvasSize * fitScale) / 2,
    translateY: (height - canvasSize * fitScale) / 2,
  };
}

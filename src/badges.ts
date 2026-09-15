import { Edge, Graph, Node } from './puzzle';

export interface Badge {
  id: string;
  name: string;
  /** Shown on a not-yet-solved card as a clue, without giving the shape away. */
  hint: string;
  /** Closed-loop contour, hand-authored as a handful of vertices in a 0-100
   * design grid (x right, y down) — resampled to NODE_COUNT evenly-spaced
   * points at puzzle-build time, so the point count is independent of how
   * many vertices were used to sketch the outline. */
  contour: [number, number][];
}

/** How many nodes every badge puzzle has — a lot more than a normal level's
 * 5-30, since the solved shape needs to read as a recognizable silhouette. */
export const BADGE_NODE_COUNT = 70;

// Low-poly bird in profile: rounded back, head, beak notch, chest/belly,
// and a single leg (the far leg is hidden behind it, as in most bird icons).
const BIRD_CONTOUR: [number, number][] = [
  [5, 55],
  [16, 42],
  [22, 34],
  [32, 22],
  [46, 14],
  [58, 8],
  [70, 6],
  [80, 10],
  [88, 18],
  [98, 24],
  [100, 28],
  [94, 32],
  [84, 34],
  [76, 42],
  [70, 54],
  [62, 68],
  [54, 80],
  [52, 90],
  [60, 94],
  [46, 94],
  [44, 88],
  [32, 80],
  [18, 70],
  [8, 62],
];

// Low-poly fish in profile: mouth, dorsal fin, forked tail, pelvic fin.
const FISH_CONTOUR: [number, number][] = [
  [5, 50],
  [14, 38],
  [28, 32],
  [38, 14],
  [48, 30],
  [68, 34],
  [92, 16],
  [78, 50],
  [92, 84],
  [68, 66],
  [50, 74],
  [34, 78],
  [30, 88],
  [26, 72],
  [14, 62],
];

export const BADGES: Badge[] = [
  { id: 'bird', name: 'Bird', hint: 'A garden visitor with wings', contour: BIRD_CONTOUR },
  { id: 'fish', name: 'Fish', hint: 'Swims, doesn’t fly', contour: FISH_CONTOUR },
  // Toaster, Butterfly, RTX 5090, Face are planned next — no contour yet,
  // so getBadgeGraph() isn't called for them; the collection screen shows
  // them as "coming soon" instead of opening a puzzle.
  { id: 'toaster', name: 'Toaster', hint: 'Coming soon', contour: [] },
  { id: 'butterfly', name: 'Butterfly', hint: 'Coming soon', contour: [] },
  { id: 'rtx5090', name: 'RTX 5090', hint: 'Coming soon', contour: [] },
  { id: 'face', name: 'Face', hint: 'Coming soon', contour: [] },
];

export function getBadge(id: string): Badge | undefined {
  return BADGES.find((b) => b.id === id);
}

/** Total length of a closed polyline through `points`. */
function perimeter(points: [number, number][]): number {
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    total += Math.hypot(x2 - x1, y2 - y1);
  }
  return total;
}

/**
 * Walks a closed polyline by arc length and returns `count` evenly-spaced
 * points along it — lets a badge's shape be sketched with a handful of
 * vertices while every badge still gets the same node count.
 */
function resampleClosedPolyline(points: [number, number][], count: number): [number, number][] {
  const total = perimeter(points);
  const step = total / count;
  const result: [number, number][] = [];

  let segmentIndex = 0;
  let segmentStart = 0; // distance along the perimeter where the current segment begins
  let [x1, y1] = points[0];
  let [x2, y2] = points[1 % points.length];
  let segmentLength = Math.hypot(x2 - x1, y2 - y1);

  for (let i = 0; i < count; i++) {
    const target = i * step;
    while (segmentStart + segmentLength < target && segmentIndex < points.length - 1) {
      segmentIndex++;
      segmentStart += segmentLength;
      [x1, y1] = points[segmentIndex % points.length];
      [x2, y2] = points[(segmentIndex + 1) % points.length];
      segmentLength = Math.hypot(x2 - x1, y2 - y1) || 1e-6;
    }
    const t = segmentLength > 0 ? (target - segmentStart) / segmentLength : 0;
    result.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]);
  }

  return result;
}

/** Builds the badge's solved graph (ordered, non-crossing loop tracing its
 * silhouette), scaled and centered to fill `canvasSize` minus `margin`. */
export function getBadgeSolvedGraph(badge: Badge, canvasSize: number, margin: number): Graph {
  const resampled = resampleClosedPolyline(badge.contour, BADGE_NODE_COUNT);

  const xs = badge.contour.map(([x]) => x);
  const ys = badge.contour.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const shapeWidth = maxX - minX;
  const shapeHeight = maxY - minY;

  const available = canvasSize - 2 * margin;
  const fitScale = Math.min(available / shapeWidth, available / shapeHeight);
  const offsetX = margin + (available - shapeWidth * fitScale) / 2;
  const offsetY = margin + (available - shapeHeight * fitScale) / 2;

  const nodes: Node[] = resampled.map(([x, y], id) => ({
    id,
    x: offsetX + (x - minX) * fitScale,
    y: offsetY + (y - minY) * fitScale,
  }));

  const edges: Edge[] = nodes.map((n, i) => ({ a: n.id, b: nodes[(i + 1) % nodes.length].id }));

  return { nodes, edges };
}

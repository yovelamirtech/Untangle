import { segmentsIntersect } from './geometry';
import { Edge, Graph, Node } from './puzzle';

/** A full planar graph auto-vectorized from reference line art (every
 * facet edge, not just the silhouette) — see scripts/vectorize-badge.mjs.
 * Coordinates are in the same 0-100 design grid as `contour`; edges are
 * index pairs into `nodes`. Used as-is (no resampling), since unlike a
 * hand-sketched contour its point count already reflects the real shape. */
export interface BadgeGraph {
  nodes: [number, number][];
  edges: [number, number][];
}

export interface Badge {
  id: string;
  name: string;
  /** Shown on a not-yet-solved card as a clue, without giving the shape away. */
  hint: string;
  /** Closed-loop contour, hand-authored as a handful of vertices in a 0-100
   * design grid (x right, y down) — resampled to NODE_COUNT evenly-spaced
   * points at puzzle-build time, so the point count is independent of how
   * many vertices were used to sketch the outline. Ignored when `graph` is
   * set. */
  contour: [number, number][];
  /** When set, used instead of `contour` — the puzzle is this exact
   * vectorized wireframe rather than a silhouette-plus-triangulation. */
  graph?: BadgeGraph;
}

/** How many nodes a contour-based badge puzzle has — a lot more than a
 * normal level's 5-30, since the solved shape needs to read as a
 * recognizable silhouette. A graph-based badge uses its own node count
 * instead (see getBadgeNodeCount). */
export const BADGE_NODE_COUNT = 70;

/** The node count a given badge's puzzle will actually have — its
 * vectorized graph's own node count, or BADGE_NODE_COUNT for a
 * contour-based badge. Layout code (canvas size, min-crossings target)
 * should scale off this, not the BADGE_NODE_COUNT constant directly. */
export function getBadgeNodeCount(badge: Badge): number {
  return badge.graph ? badge.graph.nodes.length : BADGE_NODE_COUNT;
}

// Bird in flight, auto-traced from a reference silhouette (flood-filled
// from the image border to recover the true outline, then simplified) —
// not hand-guessed, so it matches the source image's proportions: a raised
// wing with two swept-back peaks, a pointed beak, and a tail hanging below
// and behind the body.
const BIRD_CONTOUR: [number, number][] = [
  [40.8, 2.5],
  [50.4, 45],
  [56.7, 41.3],
  [66.3, 40.4],
  [85.8, 51.3],
  [72.5, 54.2],
  [67.1, 58.8],
  [62.1, 70.8],
  [47.5, 80.8],
  [25.8, 82.5],
  [10.8, 100],
  [6.3, 89.6],
  [17.5, 72.9],
  [28.8, 62.5],
  [22.1, 54.2],
  [0, 39.2],
  [1.7, 0],
  [32.1, 28.3],
  [31.7, 22.1],
  [39.6, 1.7],
];

// Shark in profile, auto-traced the same way: a thin tail spike at left, a
// tall triangular dorsal fin on top, a pointed snout at the right, and two
// ventral fins along the belly.
const SHARK_CONTOUR: [number, number][] = [
  [99.8, 26.3],
  [91, 29.2],
  [77.1, 29.4],
  [66.7, 34.2],
  [59.3, 35.5],
  [67.2, 28.8],
  [52.8, 26.7],
  [48.3, 29],
  [44.7, 25.2],
  [38.9, 24],
  [32.1, 27],
  [32.8, 24.9],
  [29.2, 23.8],
  [25.8, 24.5],
  [22.7, 30.6],
  [18, 35.1],
  [18.4, 25.6],
  [4, 15.5],
  [0, 10.8],
  [23.4, 21.6],
  [31.2, 16.9],
  [32.6, 13.9],
  [36.9, 14.8],
  [59.8, 11.2],
  [62.5, 9.2],
  [62.5, 1.8],
  [63.4, 0],
  [65.8, 1.3],
  [74.4, 12.8],
  [100, 24],
];

// Toaster body, fully vectorized from the reference line art: every
// facet edge (not just the outer silhouette), extracted by
// scripts/vectorize-badge.mjs — skeletonize the thresholded stroke mask,
// find junctions by crossing number, then trace the skeleton between them.
// Floating text/labels (the reference art's 'STOP' and dial numbers) sit
// as islands never touching the wireframe, so they're dropped along with
// any other small stray marks; nothing here is hand-guessed.
const TOASTER_GRAPH: BadgeGraph = {
  nodes: [
  [36.1, 0],
  [30.6, 0.1],
  [36.1, 0.6],
  [29.2, 1.5],
  [40.3, 1.9],
  [20.9, 2.6],
  [24.5, 2.6],
  [39.6, 2.7],
  [40.2, 2.7],
  [16.8, 3.7],
  [49.6, 6.1],
  [13.7, 7.2],
  [7.4, 8.6],
  [10.9, 8.8],
  [6.7, 9],
  [9.7, 11.1],
  [9.7, 11.7],
  [11, 12],
  [12.8, 13.2],
  [1.8, 15.6],
  [74.8, 19.3],
  [75.3, 19.5],
  [75.9, 20.9],
  [4.6, 21.8],
  [0, 22.3],
  [77, 22.4],
  [4.1, 22.9],
  [78.6, 22.9],
  [4.1, 23.4],
  [74.1, 23.4],
  [5.2, 24.1],
  [82.1, 24.1],
  [4.4, 24.6],
  [84.8, 29.1],
  [86.2, 29.1],
  [84.9, 29.7],
  [29.3, 29.8],
  [45.1, 33.5],
  [47.8, 33.9],
  [62.2, 34.8],
  [64.4, 35],
  [72, 35.1],
  [72.5, 35.1],
  [70.6, 35.5],
  [71.1, 35.5],
  [77.2, 36.5],
  [89.2, 39.8],
  [76.2, 40.1],
  [77, 40.1],
  [72.9, 41.4],
  [89.5, 41.7],
  [80.3, 41.9],
  [71.2, 42.1],
  [53.8, 42.3],
  [53.6, 42.8],
  [89.4, 43],
  [53, 43.3],
  [81.9, 43.3],
  [69.3, 43.9],
  [81.8, 43.8],
  [82.3, 44.6],
  [75.2, 46.5],
  [40.8, 46.9],
  [44.3, 50.4],
  [80.9, 50.7],
  [67.3, 51],
  [70.9, 51.5],
  [72.7, 52.5],
  [76.8, 52.8],
  [74.8, 53],
  [75.7, 53],
  [0.9, 53.3],
  [47, 55.7],
  [57.4, 55.8],
  [47, 56.2],
  [47.1, 57.6],
  [1.7, 58.8],
  [76.6, 64],
  [81.2, 65.2],
  [72.5, 65.8],
  [73.2, 65.8],
  [80, 66.5],
  [70.8, 66.6],
  [80.4, 66.6],
  [80.9, 66.6],
  [13.2, 71.4],
  [67.6, 72],
  [67.6, 72.6],
  [20, 75.3],
  [88.9, 75.5],
  [88.2, 77.3],
  [79.6, 77.5],
  [26.1, 77.6],
  [24.8, 78.4],
  [25.4, 78.5],
  [63.9, 80.2],
  [81, 82.7],
  [85, 82.7],
  [30.5, 82.8],
  [83, 83.6],
  [80.2, 84.5],
  [74.1, 85.8],
  [80.5, 86.2],
  [60.8, 86.7],
  [74.9, 86.8],
  [70.7, 89.2],
  [57.4, 92.2],
  [46.9, 92.7],
  [57.6, 92.8],
  [48.1, 93.5],
  [57.6, 93.6],
  [43.1, 93.7],
  [56.7, 94],
  [52.9, 94.2],
  [60.7, 95.8],
  [48.4, 97.1],
  [52.4, 97.3],
  [57.1, 97.3],
  [53.5, 97.4],
  [52.4, 100],
  ],
  edges: [
  [1, 0],
  [5, 1],
  [0, 4],
  [1, 3],
  [3, 2],
  [2, 7],
  [3, 6],
  [4, 10],
  [6, 5],
  [9, 5],
  [17, 7],
  [6, 11],
  [8, 22],
  [9, 12],
  [9, 11],
  [18, 29],
  [10, 20],
  [11, 13],
  [12, 13],
  [12, 14],
  [14, 19],
  [12, 15],
  [13, 15],
  [14, 23],
  [16, 17],
  [16, 23],
  [17, 18],
  [18, 37],
  [19, 24],
  [19, 26],
  [21, 31],
  [21, 22],
  [22, 25],
  [24, 28],
  [23, 26],
  [25, 27],
  [29, 25],
  [24, 71],
  [25, 41],
  [27, 31],
  [27, 33],
  [38, 29],
  [31, 34],
  [30, 62],
  [32, 71],
  [32, 93],
  [33, 34],
  [33, 42],
  [34, 46],
  [36, 37],
  [35, 46],
  [35, 57],
  [38, 39],
  [40, 43],
  [44, 41],
  [42, 45],
  [53, 43],
  [44, 65],
  [45, 51],
  [52, 49],
  [45, 48],
  [49, 47],
  [46, 50],
  [48, 51],
  [47, 61],
  [60, 50],
  [51, 57],
  [50, 55],
  [52, 58],
  [53, 65],
  [54, 56],
  [54, 73],
  [55, 78],
  [63, 56],
  [55, 89],
  [56, 72],
  [58, 61],
  [61, 59],
  [59, 60],
  [59, 70],
  [58, 66],
  [58, 69],
  [60, 64],
  [61, 69],
  [62, 63],
  [62, 92],
  [64, 68],
  [63, 72],
  [65, 73],
  [64, 78],
  [65, 86],
  [66, 67],
  [66, 82],
  [67, 69],
  [67, 79],
  [70, 68],
  [68, 77],
  [71, 76],
  [74, 92],
  [73, 106],
  [74, 75],
  [75, 106],
  [75, 107],
  [76, 88],
  [76, 85],
  [77, 80],
  [77, 81],
  [78, 84],
  [80, 81],
  [79, 82],
  [82, 86],
  [83, 87],
  [84, 89],
  [85, 88],
  [85, 111],
  [87, 95],
  [101, 91],
  [88, 93],
  [89, 90],
  [91, 96],
  [90, 96],
  [90, 97],
  [92, 94],
  [94, 98],
  [99, 97],
  [98, 107],
  [96, 100],
  [97, 102],
  [98, 111],
  [99, 100],
  [99, 102],
  [100, 104],
  [101, 104],
  [102, 114],
  [103, 108],
  [104, 105],
  [105, 110],
  [105, 114],
  [107, 109],
  [109, 113],
  [111, 115],
  [112, 113],
  [112, 110],
  [109, 116],
  [112, 118],
  [114, 117],
  [115, 116],
  [118, 117],
  [115, 119],
  [117, 119],
  [116, 119],
  ],
};

// Butterfly, fully vectorized from the reference line art the same way as
// the toaster — symmetric wings each split into facets around a central
// body spike.
const BUTTERFLY_GRAPH: BadgeGraph = {
  nodes: [
    [100, 0],
    [0, 0.3],
    [1.1, 0.5],
    [98.9, 0.5],
    [31.5, 9.1],
    [68.5, 9.1],
    [5.3, 20.7],
    [94.6, 20.7],
    [30.3, 25.3],
    [69.7, 25.3],
    [30.9, 25.7],
    [69.1, 25.7],
    [16.8, 35.7],
    [17.9, 35.7],
    [82.1, 35.7],
    [83, 35.7],
    [46.7, 37.3],
    [53.1, 37.4],
    [46.8, 38],
    [53, 38.2],
    [44.2, 38.6],
    [55.6, 38.6],
    [46.9, 44.1],
    [52.9, 44.1],
    [8.2, 44.7],
    [91.8, 44.7],
    [7.5, 45.1],
    [8, 45.1],
    [91.9, 45.1],
    [50, 55.7],
    [29.1, 56],
    [70.7, 56],
    [43.6, 62.8],
    [56.2, 62.8],
    [14.8, 68.9],
    [85.1, 68.9],
  ],
  edges: [
    [1, 4], [5, 0], [2, 1], [0, 3], [2, 4], [5, 3], [0, 7], [1, 6],
    [3, 9], [2, 8], [4, 16], [17, 5], [6, 8], [7, 9], [6, 12], [7, 15],
    [10, 16], [17, 11], [10, 13], [11, 14], [16, 17], [13, 20], [21, 14],
    [12, 24], [15, 25], [18, 20], [18, 22], [19, 21], [19, 23], [24, 20],
    [21, 25], [22, 32], [22, 29], [23, 33], [23, 29], [27, 30], [28, 31],
    [26, 34], [30, 32], [33, 31], [30, 34], [31, 35], [33, 35], [32, 34],
  ],
};

export const BADGES: Badge[] = [
  { id: 'bird', name: 'Bird', hint: 'Wings spread, mid-flight', contour: BIRD_CONTOUR },
  { id: 'shark', name: 'Shark', hint: 'Fin above the water', contour: SHARK_CONTOUR },
  { id: 'toaster', name: 'Toaster', hint: 'Two slots, one dial', contour: [], graph: TOASTER_GRAPH },
  { id: 'butterfly', name: 'Butterfly', hint: 'Two wings, symmetric', contour: [], graph: BUTTERFLY_GRAPH },
  // RTX 5090 and Face are planned next — no contour yet, so
  // getBadgeGraph() isn't called for them; the collection screen shows
  // them as "coming soon" instead of opening a puzzle.
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

function crossZ(o: [number, number], a: [number, number], b: [number, number]): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

function signedArea(points: [number, number][]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

function pointInTriangle(p: [number, number], a: [number, number], b: [number, number], c: [number, number]): boolean {
  const d1 = crossZ(a, b, p);
  const d2 = crossZ(b, c, p);
  const d3 = crossZ(c, a, p);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

/**
 * Ear-clipping triangulation of a simple polygon (convex or concave),
 * returning vertex-index triples. Each step clips whichever valid ear has
 * the smallest triangle area, which spreads the cuts around the boundary
 * instead of fanning out from a single vertex — closer to the scattered
 * facets of a hand-drawn low-poly silhouette.
 */
function triangulatePolygon(points: [number, number][]): [number, number, number][] {
  const n = points.length;
  const indices = Array.from({ length: n }, (_, i) => i);
  const sign = Math.sign(signedArea(points)) || 1;
  const triangles: [number, number, number][] = [];

  let guard = 0;
  while (indices.length > 3 && guard < n * n) {
    guard++;
    let bestI = -1;
    let bestArea = Infinity;
    for (let i = 0; i < indices.length; i++) {
      const iPrev = indices[(i - 1 + indices.length) % indices.length];
      const iCur = indices[i];
      const iNext = indices[(i + 1) % indices.length];
      const a = points[iPrev];
      const b = points[iCur];
      const c = points[iNext];
      const cross = crossZ(a, b, c);
      if (cross !== 0 && Math.sign(cross) !== sign) continue; // reflex vertex, not a valid ear

      let hasPointInside = false;
      for (const idx of indices) {
        if (idx === iPrev || idx === iCur || idx === iNext) continue;
        if (pointInTriangle(points[idx], a, b, c)) {
          hasPointInside = true;
          break;
        }
      }
      if (hasPointInside) continue;

      const area = Math.abs(cross) / 2;
      if (area < bestArea) {
        bestArea = area;
        bestI = i;
      }
    }
    if (bestI === -1) break; // shouldn't happen for a simple polygon, but avoid an infinite loop

    const iPrev = indices[(bestI - 1 + indices.length) % indices.length];
    const iCur = indices[bestI];
    const iNext = indices[(bestI + 1) % indices.length];
    triangles.push([iPrev, iCur, iNext]);
    indices.splice(bestI, 1);
  }
  if (indices.length === 3) triangles.push([indices[0], indices[1], indices[2]]);

  return triangles;
}

/** Triangulates the contour and returns just the internal diagonals (edges
 * of the triangulation that aren't already part of the polygon boundary),
 * as index pairs into `contour`. */
function getInteriorDiagonals(contour: [number, number][]): [number, number][] {
  const n = contour.length;
  if (n < 4) return [];

  const triangles = triangulatePolygon(contour);
  const seen = new Set<string>();
  const diagonals: [number, number][] = [];

  for (const [t0, t1, t2] of triangles) {
    for (const [u, v] of [
      [t0, t1],
      [t1, t2],
      [t2, t0],
    ]) {
      const isBoundaryEdge = Math.abs(u - v) === 1 || Math.abs(u - v) === n - 1;
      if (isBoundaryEdge) continue;
      const key = u < v ? `${u}-${v}` : `${v}-${u}`;
      if (seen.has(key)) continue;
      seen.add(key);
      diagonals.push([u, v]);
    }
  }

  return diagonals;
}

/** Index into `resampled` whose point is closest to `target`. */
function nearestResampledIndex(resampled: [number, number][], target: [number, number]): number {
  let bestIndex = 0;
  let bestDistSq = Infinity;
  for (let i = 0; i < resampled.length; i++) {
    const dx = resampled[i][0] - target[0];
    const dy = resampled[i][1] - target[1];
    const distSq = dx * dx + dy * dy;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestIndex = i;
    }
  }
  return bestIndex;
}

/** Builds the badge's solved graph: the resampled outline loop plus a
 * handful of internal triangulation lines (echoing the low-poly reference
 * art), scaled and centered to fill `canvasSize` minus `margin`. */
function fitPoints(
  points: [number, number][],
  canvasSize: number,
  margin: number
): { nodes: Node[]; offsetX: number; offsetY: number; fitScale: number; minX: number; minY: number } {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
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

  const nodes: Node[] = points.map(([x, y], id) => ({
    id,
    x: offsetX + (x - minX) * fitScale,
    y: offsetY + (y - minY) * fitScale,
  }));

  return { nodes, offsetX, offsetY, fitScale, minX, minY };
}

export function getBadgeSolvedGraph(badge: Badge, canvasSize: number, margin: number): Graph {
  if (badge.graph) {
    const { nodes } = fitPoints(badge.graph.nodes, canvasSize, margin);
    const edges: Edge[] = badge.graph.edges.map(([a, b]) => ({ a, b }));
    return { nodes, edges };
  }

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

  // Snapping a diagonal's endpoints to the nearest resampled node can shift
  // it just enough to clip a perimeter edge near a tight concave notch, so
  // every candidate is checked against the edges accepted so far and
  // dropped (rather than risk an unsolvable, pre-crossed "solved" state).
  const diagonals = getInteriorDiagonals(badge.contour);
  const seenEdges = new Set(edges.map((e) => (e.a < e.b ? `${e.a}-${e.b}` : `${e.b}-${e.a}`)));
  for (const [u, v] of diagonals) {
    const a = nearestResampledIndex(resampled, badge.contour[u]);
    const b = nearestResampledIndex(resampled, badge.contour[v]);
    if (a === b) continue;
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seenEdges.has(key)) continue;

    const pA = nodes[a];
    const pB = nodes[b];
    const crossesExisting = edges.some((e) => {
      if (e.a === a || e.a === b || e.b === a || e.b === b) return false;
      return segmentsIntersect(pA, pB, nodes[e.a], nodes[e.b]);
    });
    if (crossesExisting) continue;

    seenEdges.add(key);
    edges.push({ a, b });
  }

  return { nodes, edges };
}

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
  [30.9, 0],
  [36.2, 0.2],
  [24.5, 2.4],
  [39.5, 2.6],
  [17.2, 3.5],
  [49, 5.8],
  [13.6, 7.1],
  [7.2, 8.6],
  [11, 8.7],
  [9.7, 11.3],
  [11, 12],
  [12.8, 13.1],
  [1.8, 15.4],
  [75.3, 19.5],
  [0, 22.2],
  [77.8, 22.5],
  [4.2, 22.8],
  [78.3, 22.6],
  [74.1, 23.1],
  [4.3, 23.9],
  [82.4, 24.1],
  [85, 29.2],
  [86.4, 29.2],
  [45.5, 33.7],
  [49.2, 34.1],
  [71.7, 35.3],
  [76.7, 40.1],
  [89.5, 40.3],
  [72.8, 41.2],
  [89.5, 42.2],
  [71.2, 42.2],
  [80.5, 42.2],
  [53.3, 42.9],
  [82.2, 43.1],
  [69.5, 43.6],
  [82.4, 44.5],
  [75.2, 46.4],
  [44.3, 50.4],
  [81.1, 50.6],
  [67.5, 50.9],
  [70.8, 51.3],
  [72.7, 52.2],
  [76.9, 52.8],
  [75.2, 53.1],
  [0.9, 55.2],
  [47, 55.7],
  [89.5, 55.3],
  [47, 56.8],
  [67.7, 57.7],
  [1.5, 58.5],
  [89.3, 58.5],
  [67.5, 61.9],
  [76.7, 63.9],
  [72.8, 65.8],
  [80.8, 66.4],
  [70.8, 66.5],
  [12, 70.5],
  [51.3, 71.4],
  [67.7, 72.4],
  [52.2, 74.4],
  [89, 75.5],
  [20.9, 75.9],
  [88.6, 76.8],
  [79.8, 77.3],
  [25.9, 77.8],
  [25.2, 78.5],
  [47, 79.3],
  [63.5, 81.1],
  [29, 81.8],
  [81.3, 82.7],
  [85.1, 82.7],
  [83.9, 83.2],
  [71.8, 84.6],
  [80.2, 84.6],
  [46.9, 85],
  [74.3, 85.9],
  [61.1, 86.1],
  [80.5, 86.1],
  [75.2, 86.6],
  [71.8, 88.7],
  [57.6, 92.7],
  [46.9, 92.7],
  [48, 93.2],
  [57.1, 93.9],
  [52.9, 94.1],
  [45, 94.9],
  [60.2, 96],
  [48.3, 97.1],
  [52.8, 97.3],
  [57.1, 97.3],
  [52.3, 100],
  ],
  edges: [
  [0, 1],
  [1, 3],
  [10, 3],
  [6, 2],
  [4, 7],
  [11, 18],
  [4, 6],
  [5, 13],
  [6, 8],
  [7, 8],
  [7, 12],
  [7, 9],
  [7, 16],
  [8, 9],
  [9, 16],
  [11, 23],
  [12, 14],
  [12, 16],
  [14, 16],
  [17, 20],
  [15, 25],
  [14, 44],
  [17, 21],
  [24, 18],
  [20, 22],
  [19, 44],
  [19, 65],
  [21, 25],
  [22, 27],
  [21, 33],
  [21, 27],
  [25, 32],
  [25, 39],
  [28, 30],
  [28, 26],
  [26, 31],
  [26, 36],
  [29, 35],
  [32, 39],
  [29, 54],
  [32, 37],
  [29, 46],
  [32, 45],
  [34, 36],
  [34, 40],
  [34, 43],
  [35, 42],
  [35, 38],
  [36, 43],
  [42, 38],
  [37, 45],
  [38, 54],
  [39, 48],
  [40, 55],
  [41, 43],
  [41, 53],
  [42, 52],
  [44, 49],
  [47, 64],
  [47, 57],
  [47, 66],
  [49, 61],
  [49, 56],
  [50, 60],
  [51, 58],
  [53, 52],
  [52, 54],
  [53, 54],
  [54, 58],
  [54, 60],
  [55, 58],
  [56, 61],
  [56, 85],
  [58, 67],
  [72, 63],
  [59, 80],
  [75, 63],
  [62, 69],
  [63, 69],
  [62, 70],
  [68, 81],
  [68, 85],
  [71, 73],
  [71, 77],
  [72, 75],
  [73, 78],
  [74, 81],
  [86, 77],
  [76, 80],
  [80, 79],
  [86, 79],
  [82, 84],
  [84, 83],
  [82, 88],
  [83, 88],
  [84, 88],
  [86, 89],
  [87, 88],
  [88, 89],
  [87, 90],
  [89, 90],
  [88, 90],
  ],
};

export const BADGES: Badge[] = [
  { id: 'bird', name: 'Bird', hint: 'Wings spread, mid-flight', contour: BIRD_CONTOUR },
  { id: 'shark', name: 'Shark', hint: 'Fin above the water', contour: SHARK_CONTOUR },
  { id: 'toaster', name: 'Toaster', hint: 'Two slots, one dial', contour: [], graph: TOASTER_GRAPH },
  // Butterfly, RTX 5090, Face are planned next — no contour yet, so
  // getBadgeGraph() isn't called for them; the collection screen shows
  // them as "coming soon" instead of opening a puzzle.
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

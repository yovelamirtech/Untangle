import { segmentsIntersect } from './geometry';
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

// Toaster body, auto-traced the same way. The reference art's toast slots,
// dial, and lettering are interior detail the flood-fill correctly folds
// into the solid silhouette — this system has no notion of a hole in a
// badge shape, so the smooth auto-traced box got two hand-added hints of
// those features instead: a small notch carved into the top edge for the
// toast slot, and a bump on the right edge for the dial housing.
const TOASTER_CONTOUR: [number, number][] = [
  [83.5, 86],
  [79.9, 86.2],
  [69.1, 92.3],
  [57.4, 96.9],
  [56.8, 98],
  [52, 100],
  [48.3, 97.6],
  [47.6, 96.5],
  [41.9, 93.3],
  [24.6, 81.3],
  [15.8, 74.2],
  [7.1, 66.1],
  [3.2, 62.3],
  [0.9, 57.8],
  [0.7, 56.5],
  [0, 22],
  [1.7, 15.3],
  [5.6, 9.8],
  [11.2, 6.1],
  [20.1, 2.6],
  [31.1, 0],
  [32.5, 6], // toast-slot notch, hand-added
  [34.5, 6], // toast-slot notch, hand-added
  [36, 0],
  [61.2, 11.7],
  [77.7, 20.6],
  [81.4, 23.2],
  [86.7, 29.9],
  [88.3, 34.5],
  [89.2, 40.1],
  [94, 52], // dial-housing bump, hand-added
  [94, 63], // dial-housing bump, hand-added
  [88.7, 76.1],
];

export const BADGES: Badge[] = [
  { id: 'bird', name: 'Bird', hint: 'Wings spread, mid-flight', contour: BIRD_CONTOUR },
  { id: 'shark', name: 'Shark', hint: 'Fin above the water', contour: SHARK_CONTOUR },
  { id: 'toaster', name: 'Toaster', hint: 'Two slots, one dial', contour: TOASTER_CONTOUR },
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

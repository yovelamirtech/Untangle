import { segmentsIntersect } from './geometry';
import { Edge, Graph, Node, traceOuterBoundaryIds } from './puzzle';
import { singleLineify } from './singleLine';

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
// body spike. The raw trace placed two junction pixels a couple of units
// apart at each antenna tip instead of one (a skeletonization artifact,
// not a real fork in the art); left alone, each spawned its own edge to a
// different far wingtip, and those two edges crossed each other right at
// the badge's own "solved" layout. Fixed by merging every pair of nodes
// within 2 units of each other (in this 0-100 grid) into one, which is
// where this data now already sits — see scripts/vectorize-badge.mjs's
// clusterPoints for the equivalent step in a fresh trace.
const BUTTERFLY_GRAPH: BadgeGraph = {
  nodes: [
    [99.5, 0.3],
    [0.6, 0.4],
    [31.5, 9.1],
    [68.5, 9.1],
    [5.3, 20.7],
    [94.6, 20.7],
    [30.6, 25.5],
    [69.4, 25.5],
    [17.4, 35.7],
    [82.6, 35.7],
    [46.8, 37.7],
    [53.1, 37.8],
    [44.2, 38.6],
    [55.6, 38.6],
    [46.9, 44.1],
    [52.9, 44.1],
    [7.9, 45],
    [91.9, 44.9],
    [50, 55.7],
    [29.1, 56],
    [70.7, 56],
    [43.6, 62.8],
    [56.2, 62.8],
    [14.8, 68.9],
    [85.1, 68.9],
  ],
  edges: [
    [1, 2], [3, 0], [0, 5], [1, 4], [0, 7], [1, 6], [2, 10], [11, 3],
    [4, 6], [5, 7], [4, 8], [5, 9], [6, 10], [11, 7], [6, 8], [7, 9],
    [10, 11], [8, 12], [13, 9], [8, 16], [9, 17], [10, 12], [10, 14],
    [11, 13], [11, 15], [16, 12], [13, 17], [14, 21], [14, 18], [15, 22],
    [15, 18], [16, 19], [17, 20], [16, 23], [19, 21], [22, 20], [19, 23],
    [20, 24], [22, 24], [21, 23],
  ],
};

// RTX 5090 graphics card, fully vectorized from the reference line art. Its
// three fan icons are drawn as closed outline shapes rather than single
// facet strokes (see scripts/vectorize-badge.mjs's fillSmallEnclosedRegions),
// so each blade traces as one curved line instead of both of its edges.
const RTX5090_GRAPH: BadgeGraph = {
  nodes: [
  [24.4, 0.1],
  [64.9, 0.3],
  [90.2, 3.1],
  [90.8, 3.4],
  [48, 5.1],
  [84.4, 5.1],
  [20.9, 5.2],
  [55.1, 5.7],
  [13.5, 6],
  [77.1, 6],
  [41.7, 8.1],
  [90.7, 8.1],
  [27.1, 8.2],
  [99.7, 8.6],
  [61.3, 10.4],
  [7.5, 10.6],
  [71.2, 10.6],
  [37.5, 11.7],
  [2.1, 12.6],
  [19.5, 14.1],
  [51.9, 14.1],
  [83.1, 14.1],
  [16.7, 14.2],
  [49.1, 14.2],
  [80.3, 14.2],
  [95.1, 14.2],
  [31.5, 14.3],
  [37.3, 14.3],
  [22, 15.2],
  [85.7, 15.2],
  [46.7, 15.3],
  [54, 15.3],
  [14.7, 15.5],
  [78.3, 15.6],
  [64.2, 16.6],
  [68.4, 16.8],
  [4.7, 16.9],
  [23.4, 17.2],
  [87, 17.2],
  [45.5, 17.4],
  [55.1, 17.8],
  [77.4, 18],
  [13.7, 18.1],
  [23.4, 20],
  [87, 20],
  [45.5, 20.3],
  [55.1, 20.6],
  [77.5, 20.8],
  [13.8, 20.9],
  [32.4, 21.3],
  [36.3, 21.3],
  [96.1, 21.3],
  [22.3, 22.4],
  [46.6, 22.5],
  [85.9, 22.5],
  [54, 22.6],
  [15.2, 22.9],
  [78.8, 22.9],
  [63.4, 23.7],
  [84, 23.7],
  [17.6, 23.8],
  [20.4, 23.8],
  [48.6, 23.8],
  [51.5, 23.8],
  [81.3, 23.8],
  [5.6, 23.9],
  [69.3, 24.1],
  [63.1, 26.5],
  [29.5, 27.5],
  [39.3, 27.5],
  [93.1, 27.5],
  [10.2, 29.9],
  [58.8, 29.9],
  [73.9, 29.9],
  [2.3, 31.7],
  [23.4, 32],
  [87.1, 32],
  [45.5, 32.2],
  [3.7, 32.4],
  [80, 32.9],
  [16.4, 33],
  [52.5, 33],
  [76.2, 34.6],
  [1.4, 34.8],
  [78, 34.8],
  [2.2, 36.6],
  [92.1, 37.5],
  [8.5, 37.8],
  [38.8, 38.1],
  [14.2, 38.6],
  [40, 38.6],
  [18.1, 39.1],
  [3.7, 43.9],
  [23.9, 0],
  [7, 0.1],
  [2.2, 4.9],
  [2.2, 12.2],
  [99.7, 8.1],
  [99.2, 5.5],
  [95, 0],
  [65.2, 0],
  [14.3, 4.9],
  [17.9, 4.2],
  [54.9, 5.4],
  [50.9, 4.2],
  [48.3, 5],
  [77.9, 4.9],
  [81.6, 4.2],
  [26.9, 7.9],
  [24.8, 5.6],
  [21.1, 4.9],
  [44.3, 5.5],
  [90.5, 7.8],
  [88, 5.4],
  [84.7, 4.9],
  [46.6, 15],
  [46.3, 10.2],
  [47.9, 5.4],
  [85.8, 14.8],
  [86.1, 10.1],
  [84.5, 5.4],
  [22.1, 14.8],
  [22.4, 9.9],
  [20.9, 5.6],
  [61.2, 10.1],
  [60.2, 8],
  [55.6, 5.7],
  [8.8, 8],
  [72.5, 8],
  [49.2, 13.9],
  [51.4, 9],
  [55, 6.1],
  [19.4, 13.8],
  [17.1, 8.8],
  [13.7, 6.3],
  [83.1, 13.7],
  [80.9, 9],
  [77.4, 6.4],
  [40, 8.6],
  [95.1, 13.8],
  [93.7, 9.9],
  [91.1, 8.2],
  [31.5, 13.9],
  [30, 9.9],
  [27.5, 8.3],
  [45.2, 17.3],
  [41.9, 12.8],
  [41.8, 8.6],
  [87.3, 17.1],
  [90.5, 12.7],
  [90.7, 8.6],
  [23.7, 17.1],
  [26.9, 12.8],
  [27.1, 8.7],
  [92.5, 37.5],
  [95.8, 37.8],
  [100, 33.8],
  [99.9, 8.9],
  [56.6, 10.6],
  [64.6, 16.3],
  [63.7, 13],
  [61.6, 10.5],
  [16.6, 13.9],
  [12.1, 10.8],
  [7.9, 10.6],
  [80.1, 13.9],
  [75.8, 10.8],
  [71.6, 10.6],
  [5.3, 12.8],
  [68.7, 13.4],
  [87.3, 19.9],
  [92.2, 17.9],
  [94.8, 14.3],
  [96.2, 21],
  [96.7, 17.6],
  [95.4, 14.3],
  [23.8, 20],
  [28.5, 18],
  [31.1, 14.4],
  [32.6, 21],
  [33.2, 18],
  [31.9, 14.4],
  [36.2, 21],
  [35.9, 16.6],
  [36.9, 14.4],
  [45.1, 20.3],
  [40.2, 17.9],
  [37.6, 14.4],
  [63.8, 16.5],
  [59.7, 15],
  [54.3, 15.2],
  [14.3, 15.5],
  [9.4, 15.2],
  [5, 16.8],
  [78, 15.5],
  [73, 15.2],
  [68.8, 16.7],
  [63.7, 23.6],
  [65, 19.9],
  [64.4, 16.9],
  [69, 23.9],
  [67.9, 22.6],
  [68.1, 17.1],
  [5.3, 23.8],
  [4.2, 22.4],
  [4.4, 17.2],
  [62.9, 23.5],
  [60.2, 19.9],
  [55.6, 17.9],
  [72, 20.5],
  [8.2, 20.6],
  [58.8, 29.5],
  [58.6, 25.2],
  [55.5, 20.7],
  [73.8, 29.6],
  [74.1, 25.5],
  [77.1, 20.9],
  [10.4, 25.6],
  [86.3, 22.5],
  [91.7, 22.9],
  [95.7, 21.3],
  [28.2, 22.9],
  [46.3, 22.8],
  [41.3, 23.1],
  [36.6, 21.5],
  [29.8, 27.4],
  [32.3, 24.2],
  [32.7, 21.7],
  [39, 27.4],
  [36.7, 24.5],
  [36.1, 21.7],
  [93.4, 27.3],
  [95.8, 24.5],
  [96.4, 21.7],
  [52.7, 32.7],
  [54.3, 28.2],
  [54, 23.1],
  [16.3, 32.6],
  [14.7, 28.3],
  [15.1, 23.2],
  [79.8, 32.5],
  [78.4, 28.5],
  [78.7, 23.2],
  [23.3, 31.6],
  [19.7, 28.9],
  [17.7, 24.2],
  [28.9, 27.4],
  [25, 27.3],
  [20.5, 24.2],
  [39.8, 27.6],
  [44.3, 27.3],
  [48.5, 24.2],
  [92.7, 27.4],
  [88.6, 27.3],
  [84.1, 24.2],
  [45.6, 31.9],
  [49.4, 28.8],
  [51.5, 24.3],
  [87, 31.6],
  [83.3, 28.8],
  [81.3, 24.3],
  [9.8, 29.9],
  [7.8, 29.1],
  [5.6, 24.4],
  [73.5, 29.9],
  [71.5, 29.3],
  [69.3, 24.5],
  [59.3, 29.8],
  [60.8, 29.5],
  [62.7, 26.7],
  [75.7, 34.6],
  [71.3, 33.8],
  [63.4, 26.9],
  [23.8, 32],
  [28.8, 29.7],
  [29.4, 28],
  [45.1, 32.2],
  [40.2, 29.8],
  [39.4, 28],
  [87.5, 32],
  [92.3, 29.8],
  [93.1, 28],
  [16, 33.3],
  [12.6, 32.4],
  [10.4, 30.2],
  [52.9, 33.4],
  [56, 32.5],
  [58.6, 30.2],
  [79.7, 33.3],
  [76.5, 32.5],
  [74, 30.2],
  [16.8, 33.2],
  [21.7, 33.5],
  [23.3, 32.3],
  [80.3, 33],
  [85.3, 33.5],
  [87, 32.3],
  [14.2, 38.1],
  [13.5, 37.1],
  [4.1, 32.4],
  [0, 35.6],
  [0.7, 32.5],
  [1.4, 32.6],
  [52.2, 33.2],
  [47.3, 33.5],
  [45.7, 32.5],
  [3.6, 44.3],
  [2.3, 45.1],
  [2.2, 37.1],
  [17.7, 39],
  [16.5, 37.8],
  [14.6, 38.6],
  [38.5, 37.8],
  [19.3, 37.8],
  [18.3, 38.8],
  [91.9, 37.8],
  [40.8, 37.8],
  [4, 43.8],
  [4.4, 39.3],
  [8.5, 39.2],
  [8.5, 38.2],
  ],
  edges: [
  [18, 93], [93, 94], [94, 95], [95, 96], [96, 0], [0, 1], [1, 97], [97, 98],
  [98, 99], [99, 100], [100, 13], [0, 17], [1, 2], [3, 13], [8, 101], [101, 102],
  [102, 6], [4, 103], [103, 104], [104, 105], [105, 7], [9, 106], [106, 107], [107, 5],
  [6, 108], [108, 109], [109, 110], [110, 12], [10, 111], [111, 4], [5, 112], [112, 113],
  [113, 114], [114, 11], [4, 115], [115, 116], [116, 117], [117, 30], [5, 118], [118, 119],
  [119, 120], [120, 29], [6, 121], [121, 122], [122, 123], [123, 28], [7, 124], [124, 125],
  [125, 126], [126, 14], [15, 127], [127, 8], [16, 128], [128, 9], [7, 129], [129, 130],
  [130, 131], [131, 23], [8, 132], [132, 133], [133, 134], [134, 19], [9, 135], [135, 136],
  [136, 137], [137, 21], [17, 138], [138, 10], [11, 139], [139, 140], [140, 141], [141, 25],
  [12, 142], [142, 143], [143, 144], [144, 26], [10, 145], [145, 146], [146, 147], [147, 39],
  [11, 148], [148, 149], [149, 150], [150, 38], [12, 151], [151, 152], [152, 153], [153, 37],
  [13, 154], [154, 155], [155, 156], [156, 157], [157, 86], [20, 158], [158, 14], [14, 159],
  [159, 160], [160, 161], [161, 34], [15, 162], [162, 163], [163, 164], [164, 22], [16, 165],
  [165, 166], [166, 167], [167, 24], [36, 168], [168, 15], [35, 169], [169, 16], [17, 27],
  [18, 74], [22, 19], [19, 28], [23, 20], [24, 21], [21, 29], [23, 30], [25, 170],
  [170, 171], [171, 172], [172, 44], [25, 173], [173, 174], [174, 175], [175, 51], [26, 176],
  [176, 177], [177, 178], [178, 43], [26, 179], [179, 180], [180, 181], [181, 49], [27, 182],
  [182, 183], [183, 184], [184, 50], [27, 185], [185, 186], [186, 187], [187, 45], [20, 31],
  [22, 32], [24, 33], [31, 188], [188, 189], [189, 190], [190, 34], [36, 191], [191, 192],
  [192, 193], [193, 32], [35, 194], [194, 195], [195, 196], [196, 33], [28, 37], [29, 38],
  [30, 39], [31, 40], [32, 42], [33, 41], [34, 197], [197, 198], [198, 199], [199, 58],
  [35, 200], [200, 201], [201, 202], [202, 66], [36, 203], [203, 204], [204, 205], [205, 65],
  [37, 43], [38, 44], [39, 45], [40, 206], [206, 207], [207, 208], [208, 58], [40, 46],
  [66, 209], [209, 41], [65, 210], [210, 42], [41, 47], [42, 48], [43, 52], [44, 54],
  [45, 53], [46, 211], [211, 212], [212, 213], [213, 72], [55, 46], [47, 214], [214, 215],
  [215, 216], [216, 73], [71, 217], [217, 48], [48, 56], [47, 57], [51, 218], [218, 219],
  [219, 220], [220, 54], [52, 221], [221, 49], [50, 222], [222, 223], [223, 224], [224, 53],
  [49, 225], [225, 226], [226, 227], [227, 68], [50, 228], [228, 229], [229, 230], [230, 69],
  [51, 231], [231, 232], [232, 233], [233, 70], [52, 61], [53, 62], [59, 54], [63, 55],
  [56, 60], [57, 64], [55, 234], [234, 235], [235, 236], [236, 81], [56, 237], [237, 238],
  [238, 239], [239, 80], [57, 240], [240, 241], [241, 242], [242, 79], [60, 61], [62, 63],
  [64, 59], [60, 243], [243, 244], [244, 245], [245, 75], [61, 246], [246, 247], [247, 248],
  [248, 68], [62, 249], [249, 250], [250, 251], [251, 69], [58, 67], [59, 252], [252, 253],
  [253, 254], [254, 70], [63, 255], [255, 256], [256, 257], [257, 77], [64, 258], [258, 259],
  [259, 260], [260, 76], [65, 261], [261, 262], [262, 263], [263, 71], [66, 264], [264, 265],
  [265, 266], [266, 73], [67, 267], [267, 268], [268, 269], [269, 72], [67, 270], [270, 271],
  [271, 272], [272, 82], [68, 273], [273, 274], [274, 275], [275, 75], [69, 276], [276, 277],
  [277, 278], [278, 77], [70, 279], [279, 280], [280, 281], [281, 76], [71, 282], [282, 283],
  [283, 284], [284, 80], [72, 285], [285, 286], [286, 287], [287, 81], [73, 288], [288, 289],
  [289, 290], [290, 79], [74, 78], [74, 85], [75, 291], [291, 292], [292, 293], [293, 80],
  [76, 294], [294, 295], [295, 296], [296, 79], [78, 297], [297, 298], [298, 299], [299, 89],
  [85, 300], [300, 301], [301, 302], [302, 83], [77, 303], [303, 304], [304, 305], [305, 81],
  [78, 87], [84, 86], [85, 306], [306, 307], [307, 308], [308, 92], [87, 89], [89, 309],
  [309, 310], [310, 311], [311, 91], [91, 312], [312, 313], [313, 314], [314, 88], [90, 315],
  [315, 316], [316, 86], [88, 90], [87, 317], [317, 318], [318, 319], [319, 320], [320, 92],
  ],
};

export const BADGES: Badge[] = [
  { id: 'bird', name: 'Bird', hint: 'Wings spread, mid-flight', contour: BIRD_CONTOUR },
  { id: 'shark', name: 'Shark', hint: 'Fin above the water', contour: SHARK_CONTOUR },
  { id: 'toaster', name: 'Toaster', hint: 'Two slots, one dial', contour: [], graph: TOASTER_GRAPH },
  { id: 'butterfly', name: 'Butterfly', hint: 'Two wings, symmetric', contour: [], graph: BUTTERFLY_GRAPH },
  // RTX5090_GRAPH's own "solved" layout has ~90 pairs of edges that cross
  // each other — not the near-duplicate-junction artifact butterfly had
  // (see BUTTERFLY_GRAPH's comment), but genuinely mis-traced edges (long
  // spurious chords cutting across real detail), which a puzzle can never
  // be dragged back out of. Pulled from the collection ("Coming soon",
  // like face) until it can be re-vectorized from its source image — not
  // in the repo, so scripts/vectorize-badge.mjs can't be re-run on it
  // here — rather than ship a badge nobody can ever solve.
  { id: 'rtx5090', name: 'RTX 5090', hint: 'Coming soon', contour: [] },
  // Face is planned next — no contour yet, so getBadgeGraph() isn't called
  // for it; the collection screen shows it as "coming soon" instead of
  // opening a puzzle.
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

/**
 * A badge's solved layout, plus which of its nodes are safe to jitter when
 * scrambling — its interior, as opposed to the outer silhouette that has
 * to stay put so the puzzle reads as the badge from the first frame (see
 * puzzle.ts's scrambleBadgeGraph). The returned graph is always a single
 * line (or a few, if the source art has genuinely disconnected pieces —
 * see singleLineify): the outer boundary is traced on the real branching
 * wireframe first, since a linearized path has no junctions left to trace
 * a boundary through, and then carried over onto the linearized graph via
 * each new node's original id.
 */
export function getBadgeSolvedGraph(badge: Badge, canvasSize: number, margin: number): { graph: Graph; interiorIds: Set<number> } {
  if (badge.graph) {
    const { nodes } = fitPoints(badge.graph.nodes, canvasSize, margin);
    const edges: Edge[] = badge.graph.edges.map(([a, b]) => ({ a, b }));
    const rawGraph: Graph = { nodes, edges };

    const boundaryIds = traceOuterBoundaryIds(rawGraph);
    const { graph, sourceIds } = singleLineify(rawGraph);
    const interiorIds = new Set(
      graph.nodes.map((n) => n.id).filter((id) => !boundaryIds.has(sourceIds[id]))
    );
    return { graph, interiorIds };
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

  // The whole outline is the "boundary" here — a hand-sketched contour has
  // no nodes that aren't on it, only a few diagonals cutting across the
  // middle, so there's no interior to report; scrambleBadgeGraph falls
  // back to its bounded whole-graph jitter for these. Still linearized
  // into a single line (or two, at a diagonal's endpoints) for the same
  // reason as a fully vectorized badge — see singleLineify.
  const { graph } = singleLineify({ nodes, edges });
  return { graph, interiorIds: new Set() };
}

#!/usr/bin/env node
// Vectorizes a low-poly reference drawing into a badge graph: every facet
// edge, not just the outer silhouette. Used to build the `graph` field of
// a Badge in src/badges.ts (see BADGES.toaster for an example).
//
// Usage: node scripts/vectorize-badge.mjs <path-to-reference-image>
//        VECTORIZE_DEBUG=1 node scripts/vectorize-badge.mjs <path> — also
//        logs any dropped ambiguous arcs (see traceEdges), useful when the
//        output looks less detailed than the reference in a dense area.
//        VECTORIZE_DEBUG_RAW=1 — also writes <name>_prepruned.json and
//        <name>_raw.json (pre-normalize node/edge dumps, before and after
//        curveSimplify) for overlaying on <name>_skel.png when the traced
//        topology itself looks wrong, not just under-detailed.
//        VECTORIZE_DARK_THRESHOLD, VECTORIZE_CLOSE_ITERATIONS — override
//        the ink-detection threshold and gap-closing strength per image;
//        a photo of a physical object can need both loosened well past
//        what a clean wireframe drawing needs (see rtx5090).
//        VECTORIZE_FILL_ENCLOSED_MAX_AREA_FRACTION (with a
//        VECTORIZE_FILL_ENCLOSED_MIN_AREA_FRACTION floor when needed) —
//        see fillSmallEnclosedRegions; turns a closed-outline element
//        (two strokes plus a tip and base) into a single centerline
//        instead of tracing both of its edges. rtx5090's fan blades:
//        VECTORIZE_DARK_THRESHOLD=190 VECTORIZE_CLOSE_ITERATIONS=2
//        VECTORIZE_FILL_ENCLOSED_MAX_AREA_FRACTION=0.0014 — found by
//        rendering _debug_mask.png (VECTORIZE_DEBUG_RAW=1) and reading
//        off the enclosed regions' pixel-area log (VECTORIZE_DEBUG=1) to
//        pick a cutoff between "a blade's own interior" and "the gap
//        between two neighboring blades" (larger, and must stay hollow).
//
// Pipeline: threshold the image to a stroke mask -> keep every connected
// component large enough to be real linework rather than just the single
// largest (drops floating text/labels that never touch the drawing, but
// keeps multiple same-scale disconnected pieces — e.g. rtx5090's outline
// plus three separate fan icons) -> skeletonize to 1px lines (Zhang-Suen
// thinning) -> trim short hairs (rasterization staircase artifacts) ->
// find junctions by crossing number -> trace the skeleton between
// junctions, following each arc's actual curve rather than a straight
// chord between its endpoints (curveSimplify; a no-op for already-straight
// low-poly facet edges) -> prune leftover spurs. Writes <name>_graph.json
// (ready to paste into badges.ts) plus <name>_skel.png and
// <name>_vectorized.png for visual sanity-checking before trusting the
// output.
import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { basename, extname } from 'path';

const WORK_SIZE = 1000;
// How far (in work-canvas px) a traced arc's pixel path may bow away from
// the straight line between its two node endpoints before curveSimplify
// inserts an intermediate node to follow it. A low-poly wireframe's facet
// edges (toaster, butterfly) are already straight, so this changes nothing
// for them; a curved single-line drawing (a portrait, a swept fan blade)
// gets extra nodes exactly where it bends enough to matter.
const CURVE_EPSILON = 6;
// Overridable per-image (VECTORIZE_CLUSTER_RADIUS): the butterfly badge's
// committed data turned out to have two junction pixels ~15px apart at
// each antenna tip that this default radius didn't merge — each spawned
// its own edge to a different far wingtip, and those two edges crossed
// right in the badge's own "solved" layout (fixed by hand in badges.ts;
// see BUTTERFLY_GRAPH's comment). Raising this only helps if the same
// artifact shows up in a fresh trace — it isn't raised by default because
// TRACE_NODE_RADIUS below depends on it staying small, to avoid erasing
// real short connecting segments between two genuinely close vertices.
const CLUSTER_RADIUS = Number(process.env.VECTORIZE_CLUSTER_RADIUS || 3);
// Deliberately smaller than CLUSTER_RADIUS: traceEdges erases a disc of
// this radius around each node to isolate the arcs between them. Erasing
// at the full cluster radius wiped out short-but-real connecting segments
// between two vertices that sit close together (the two discs overlapped
// and swallowed the whole segment), leaving disconnected-looking gaps in
// the output even though the source line art has no such gaps.
const TRACE_NODE_RADIUS = 3;
const SPUR_LENGTH = 18;
const HAIR_PRUNE_ITERATIONS = 7;
// Both overridable per-image: how dark a pixel must be to count as ink, and
// how many px of gap the morphological close bridges before picking the
// largest connected component. A photo of a physical object (e.g. a GPU
// render) can have lighter or more broken linework than a clean wireframe
// drawing, needing a looser threshold/more closing to read as one
// connected mesh instead of fragmenting into several same-size islands
// (see rtx5090, which needs both bumped).
const DARK_THRESHOLD = Number(process.env.VECTORIZE_DARK_THRESHOLD || 170);
const CLOSE_ITERATIONS = Number(process.env.VECTORIZE_CLOSE_ITERATIONS || 1);
// Opt-in: see fillSmallEnclosedRegions. 0 disables it (the default — most
// reference art, including every badge shipped so far, is single strokes
// with nothing to fill); a source drawing built from closed-outline
// elements (rtx5090's fan blades) needs it set to somewhat above that
// element's own enclosed area as a fraction of the whole image, but well
// below any region — like a fan's hub — that should stay hollow.
const FILL_ENCLOSED_MAX_AREA_FRACTION = Number(process.env.VECTORIZE_FILL_ENCLOSED_MAX_AREA_FRACTION || 0);
// Lower bound on the same knob: a thin gap *between* adjacent closed-
// outline elements (e.g. the sliver of background between two overlapping
// fan blades) is itself a small enclosed region, similar in size to the
// blade's own interior — without a floor to exclude it, filling it too
// fuses every blade into one solid ring with no blade detail left at all.
const FILL_ENCLOSED_MIN_AREA_FRACTION = Number(process.env.VECTORIZE_FILL_ENCLOSED_MIN_AREA_FRACTION || 0);

// Dilate a binary mask by 1px (8-connected). Two strokes that were meant
// to meet (e.g. a T-junction where one stroke's anti-aliased end falls
// just short of the other) can leave a 1px gap after hard thresholding;
// that gap breaks the skeleton into two pieces that never connect into a
// single traced edge. A 1px dilation closes gaps of that size without
// visibly fusing lines that are genuinely separate.
function dilate1px(mask, width, height) {
  const at = (x, y) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : mask[y * width + x]);
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) { out[y * width + x] = 1; continue; }
      let hit = false;
      for (let dy = -1; dy <= 1 && !hit; dy++)
        for (let dx = -1; dx <= 1 && !hit; dx++) if (at(x + dx, y + dy)) hit = true;
      out[y * width + x] = hit ? 1 : 0;
    }
  }
  return out;
}

function erode1px(mask, width, height) {
  const at = (x, y) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : mask[y * width + x]);
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      let allSet = true;
      for (let dy = -1; dy <= 1 && allSet; dy++)
        for (let dx = -1; dx <= 1 && allSet; dx++) if (!at(x + dx, y + dy)) allSet = false;
      out[y * width + x] = allSet ? 1 : 0;
    }
  }
  return out;
}

// Morphological closing: bridges a 1-2px gap (e.g. an anti-aliased stroke
// end that falls just short of the line it was meant to touch) while, by
// eroding back afterward, mostly avoiding the side effect of dilation
// alone — permanently fattening every line, which fuses nearby-but-
// separate features (decorative hatching, hairline-close parallel edges)
// into one blob.
function closeGaps(mask, width, height, iterations) {
  let out = mask;
  for (let i = 0; i < iterations; i++) out = dilate1px(out, width, height);
  for (let i = 0; i < iterations; i++) out = erode1px(out, width, height);
  return out;
}

// Fills any enclosed background region under `maxAreaFraction` of the image
// area solid. Some reference art draws a thin element (e.g. a fan blade) as
// a closed outline — two long strokes plus a tip and a base — rather than
// as a single stroke down its centerline; skeletonizing that outline as-is
// traces both of its edges as separate arcs, which is far denser and more
// tangled than the shape actually needs for this puzzle. Filling its thin
// enclosed interior first means skeletonize() instead finds that outline's
// medial axis — one line through the middle, the way a hand-sketched
// facet edge would have been drawn. A big enclosed area (a wide background
// gap, a hub's own interior) stays hollow, since it's what should still
// read as an outline.
function fillSmallEnclosedRegions(mask, width, height, maxAreaFraction, minAreaFraction) {
  const maxArea = width * height * maxAreaFraction;
  const minArea = width * height * minAreaFraction;
  const labels = new Int32Array(width * height).fill(-1);
  const out = mask.slice();
  let next = 0;
  const sizesLog = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i0 = y * width + x;
      if (mask[i0] || labels[i0] !== -1) continue;
      const label = next++;
      const stack = [i0];
      labels[i0] = label;
      const region = [i0];
      let touchesBorder = false;
      while (stack.length) {
        const idx = stack.pop();
        const cx = idx % width, cy = (idx / width) | 0;
        if (cx === 0 || cy === 0 || cx === width - 1 || cy === height - 1) touchesBorder = true;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const nidx = ny * width + nx;
          if (!mask[nidx] && labels[nidx] === -1) { labels[nidx] = label; stack.push(nidx); region.push(nidx); }
        }
      }
      if (!touchesBorder && region.length <= maxArea && region.length >= minArea) for (const idx of region) out[idx] = 1;
      if (process.env.VECTORIZE_DEBUG) sizesLog.push({ size: region.length, touchesBorder });
    }
  }
  if (process.env.VECTORIZE_DEBUG) {
    sizesLog.sort((a, b) => b.size - a.size);
    console.log(`fillSmallEnclosedRegions: maxArea=${maxArea.toFixed(0)}, top enclosed sizes:`, sizesLog.filter((s) => !s.touchesBorder).slice(0, 15).map((s) => s.size));
  }
  return out;
}

async function loadDarkMask(path) {
  // Work at native resolution: resizing before thresholding blends thin
  // (1-2px) strokes into gray, and the resulting jagged binary edge
  // produces spurious skeleton junctions everywhere. Threshold first, then
  // downsize the already-binary mask with nearest-neighbor (no blending).
  const { data, info } = await sharp(path).grayscale().raw().toBuffer({ resolveWithObject: true });
  const nativeW = info.width, nativeH = info.height;
  let nativeDark = new Uint8Array(nativeW * nativeH);
  for (let i = 0; i < nativeW * nativeH; i++) nativeDark[i] = data[i] < DARK_THRESHOLD ? 1 : 0;
  nativeDark = closeGaps(nativeDark, nativeW, nativeH, CLOSE_ITERATIONS);
  if (FILL_ENCLOSED_MAX_AREA_FRACTION > 0) {
    nativeDark = fillSmallEnclosedRegions(nativeDark, nativeW, nativeH, FILL_ENCLOSED_MAX_AREA_FRACTION, FILL_ENCLOSED_MIN_AREA_FRACTION);
  }
  if (process.env.VECTORIZE_DEBUG_RAW) {
    const buf = Buffer.alloc(nativeW * nativeH);
    for (let i = 0; i < nativeW * nativeH; i++) buf[i] = nativeDark[i] ? 0 : 255;
    await sharp(buf, { raw: { width: nativeW, height: nativeH, channels: 1 } }).png().toFile('_debug_mask.png');
  }

  const scale = Math.min(1, WORK_SIZE / Math.max(nativeW, nativeH));
  const width = Math.round(nativeW * scale);
  const height = Math.round(nativeH * scale);
  const dark = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = Math.min(nativeW - 1, Math.round(x / scale));
      const sy = Math.min(nativeH - 1, Math.round(y / scale));
      dark[y * width + x] = nativeDark[sy * nativeW + sx];
    }
  }

  // Keep every 8-connected component big enough to be real linework, not
  // just the single largest. Floating text/labels in the reference art
  // (e.g. dial numbers) sit as tiny islands relative to the actual
  // drawing, so a size-relative floor drops those same as before — but
  // some reference art (e.g. rtx5090: an outline plus three separate fan
  // icons that never touch it) is legitimately several same-scale islands
  // that must all survive, which a "keep only the single largest" rule
  // would wrongly reduce to one.
  const labels = new Int32Array(width * height).fill(-1);
  const sizes = [];
  let next = 0;
  for (let i = 0; i < width * height; i++) {
    if (!dark[i] || labels[i] !== -1) continue;
    const label = next++;
    const stack = [i];
    labels[i] = label;
    let size = 0;
    while (stack.length) {
      const idx = stack.pop();
      size++;
      const x = idx % width, y = (idx / width) | 0;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const nidx = ny * width + nx;
        if (dark[nidx] && labels[nidx] === -1) { labels[nidx] = label; stack.push(nidx); }
      }
    }
    sizes.push(size);
  }
  const largest = Math.max(0, ...sizes);
  const keepThreshold = largest * 0.1;
  const filtered = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) filtered[i] = sizes[labels[i]] >= keepThreshold ? 1 : 0;

  return { dark: filtered, width, height };
}

// Zhang-Suen thinning to a 1px skeleton.
function skeletonize(mask, width, height) {
  const at = (arr, x, y) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : arr[y * width + x]);
  let img = mask.slice();

  function neighbors(arr, x, y) {
    // P2..P9 clockwise from north.
    return [
      at(arr, x, y - 1), at(arr, x + 1, y - 1), at(arr, x + 1, y), at(arr, x + 1, y + 1),
      at(arr, x, y + 1), at(arr, x - 1, y + 1), at(arr, x - 1, y), at(arr, x - 1, y - 1),
    ];
  }

  let changed = true;
  let guard = 0;
  while (changed && guard++ < 200) {
    changed = false;
    for (const step of [0, 1]) {
      const toDelete = [];
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (!at(img, x, y)) continue;
          const n = neighbors(img, x, y);
          const B = n.reduce((a, b) => a + b, 0);
          if (B < 2 || B > 6) continue;
          let A = 0;
          for (let i = 0; i < 8; i++) if (n[i] === 0 && n[(i + 1) % 8] === 1) A++;
          if (A !== 1) continue;
          const [p2, p3, p4, p5, p6, p7, p8, p9] = n;
          if (step === 0) {
            if (p2 * p4 * p6 !== 0) continue;
            if (p4 * p6 * p8 !== 0) continue;
          } else {
            if (p2 * p4 * p8 !== 0) continue;
            if (p2 * p6 * p8 !== 0) continue;
          }
          toDelete.push(y * width + x);
        }
      }
      if (toDelete.length) {
        changed = true;
        for (const idx of toDelete) img[idx] = 0;
      }
    }
  }
  return img;
}

// Crossing number: the number of separate foreground arcs touching this
// pixel in its 8-neighbor ring. This — not a raw neighbor count — is the
// correct junction test: a single-pixel diagonal "staircase" step on an
// otherwise straight line can have neighbor-sum 3 (e.g. N, NW, W all set)
// while still being one contiguous incoming arc (crossing number 1, i.e. a
// plain pass-through/endpoint-like point), not a real 3-way junction.
function crossingNumber(skel, width, height, x, y) {
  const at = (nx, ny) => (nx < 0 || ny < 0 || nx >= width || ny >= height ? 0 : skel[ny * width + nx]);
  const ring = [
    at(x, y - 1), at(x + 1, y - 1), at(x + 1, y), at(x + 1, y + 1),
    at(x, y + 1), at(x - 1, y + 1), at(x - 1, y), at(x - 1, y - 1),
  ];
  let cn = 0;
  for (let i = 0; i < 8; i++) if (ring[i] !== ring[(i + 1) % 8]) cn++;
  return cn / 2;
}

// Trims short hairs from the skeleton before junction detection. A jagged
// (JPEG/resize) staircase along an otherwise-straight line reads as a false
// junction at almost every bend if left in, which floods the graph with
// thousands of spurious nodes; eroding true endpoints for a few iterations
// removes those without touching the real mesh lines, which are far longer
// than `iterations`.
function pruneSkeletonHairs(skel, width, height, iterations) {
  const at = (arr, x, y) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : arr[y * width + x]);
  let img = skel.slice();
  for (let iter = 0; iter < iterations; iter++) {
    const toRemove = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!img[y * width + x]) continue;
        let c = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            c += at(img, x + dx, y + dy);
          }
        if (c <= 1) toRemove.push(y * width + x);
      }
    }
    if (!toRemove.length) break;
    for (const idx of toRemove) img[idx] = 0;
  }
  return img;
}

function findJunctionsAndEndpoints(skel, width, height) {
  const points = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!skel[y * width + x]) continue;
      const cn = crossingNumber(skel, width, height, x, y);
      if (cn === 1 || cn >= 3) points.push([x, y]);
    }
  }
  return points;
}

// Cluster raw junction/endpoint pixels that sit within `radius` of each
// other into single graph nodes (a junction often thins to a small blob).
// Returns both each cluster's center and its `spread` (max distance from
// center to any raw point folded into it). A vertex where many facet
// lines converge skeletonizes to a many-pixel blob, not a point, and
// chains together (single-linkage) into one wide cluster; `spread` lets
// traceEdges erase exactly as much as that specific blob needs instead of
// a one-size-fits-all radius (see traceEdges).
function clusterPoints(points, radius) {
  const clusters = [];
  const used = new Array(points.length).fill(false);
  for (let i = 0; i < points.length; i++) {
    if (used[i]) continue;
    const group = [points[i]];
    used[i] = true;
    for (let j = i + 1; j < points.length; j++) {
      if (used[j]) continue;
      const dx = points[j][0] - points[i][0];
      const dy = points[j][1] - points[i][1];
      if (Math.hypot(dx, dy) <= radius) {
        group.push(points[j]);
        used[j] = true;
      }
    }
    const cx = group.reduce((a, p) => a + p[0], 0) / group.length;
    const cy = group.reduce((a, p) => a + p[1], 0) / group.length;
    const spread = Math.max(...group.map((p) => Math.hypot(p[0] - cx, p[1] - cy)));
    clusters.push({ point: [cx, cy], spread });
  }
  return { points: clusters.map((c) => c.point), spreads: clusters.map((c) => c.spread) };
}

// Erase a disc of `nodeRadius` around each node center from the skeleton,
// then connected-component-label what's left: every remaining component is
// a simple arc (degree 2 throughout, since junctions were just erased)
// belonging to exactly one edge. Reading off which node zone(s) each
// component touches is far more robust than walking the skeleton pixel by
// pixel and guessing which neighbor continues the same line at a junction.
function traceEdges(skel, width, height, nodes, nodeRadius, spreads) {
  const idx = (x, y) => y * width + x;
  const nodeZone = new Int32Array(width * height).fill(-1);
  for (let ni = 0; ni < nodes.length; ni++) {
    const [cx, cy] = nodes[ni];
    // A vertex where many lines converge left a many-pixel blob pre-
    // clustering (reflected in a large `spread`), not a point — erase
    // exactly that much of it, no more, so its distinct arms actually
    // separate into their own traceable components instead of a stub of
    // the blob bridging two arms into one (which later gets dropped as
    // "touches >2 nodes, ambiguous").
    const effectiveRadius = Math.max(nodeRadius, Math.min((spreads?.[ni] ?? 0) + 1, nodeRadius * 3));
    const r = Math.ceil(effectiveRadius);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = Math.round(cx) + dx, y = Math.round(cy) + dy;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        if (Math.hypot(dx, dy) <= effectiveRadius) nodeZone[idx(x, y)] = ni;
      }
    }
  }

  const remaining = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) remaining[i] = skel[i] && nodeZone[i] === -1 ? 1 : 0;

  const visited = new Uint8Array(width * height);
  const edges = [];
  const ambiguous = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i0 = idx(x, y);
      if (!remaining[i0] || visited[i0]) continue;

      const path = [];
      const touchedNodes = new Set();
      const stack = [i0];
      visited[i0] = 1;
      while (stack.length) {
        const cur = stack.pop();
        const cx = cur % width, cy = (cur / width) | 0;
        path.push([cx, cy]);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const nidx = idx(nx, ny);
            if (nodeZone[nidx] !== -1) touchedNodes.add(nodeZone[nidx]);
            if (remaining[nidx] && !visited[nidx]) { visited[nidx] = 1; stack.push(nidx); }
          }
        }
      }

      const distinct = [...touchedNodes];
      if (distinct.length === 2) edges.push({ a: distinct[0], b: distinct[1], path });
      // 0 or 1 touched nodes: isolated fleck or dangling spur — drop.
      // >2: an arc brushing more than two zones (rare, but real — usually
      // a dense-mesh area where two unrelated arcs happened to run pixel-
      // adjacent for a stretch); drop rather than guess, but record it so
      // --debug can report how much detail this cost.
      if (distinct.length > 2) ambiguous.push({ nodes: distinct, pixels: path.length, sample: path[0] });
    }
  }
  return { edges, ambiguous };
}

// traceEdges' flood fill collects an arc's pixels in visitation order, not
// along-the-curve order, so a straight chord between its endpoints is all
// that can be drawn from it directly. Finds the arc's two farthest-apart
// pixels (its "diameter" in the 8-connected adjacency graph — for a thin,
// mostly-unbranched skeleton segment these are its two ends) via two BFS
// passes, then returns the pixel path between them in walking order.
function orderPathPixels(pixels) {
  const n = pixels.length;
  if (n <= 2) return pixels;
  const indexOf = new Map();
  pixels.forEach(([x, y], i) => indexOf.set(`${x},${y}`, i));
  const adj = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    const [x, y] = pixels[i];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const j = indexOf.get(`${x + dx},${y + dy}`);
        if (j !== undefined) adj[i].push(j);
      }
    }
  }
  function bfs(start) {
    const dist = new Array(n).fill(-1);
    const parent = new Array(n).fill(-1);
    dist[start] = 0;
    const queue = [start];
    for (let qi = 0; qi < queue.length; qi++) {
      const u = queue[qi];
      for (const v of adj[u]) if (dist[v] === -1) { dist[v] = dist[u] + 1; parent[v] = u; queue.push(v); }
    }
    let far = start;
    for (let i = 0; i < n; i++) if (dist[i] > dist[far]) far = i;
    return { far, parent };
  }
  const r1 = bfs(0);
  const r2 = bfs(r1.far);
  const ordered = [];
  for (let cur = r2.far; cur !== -1; cur = r2.parent[cur]) ordered.push(pixels[cur]);
  ordered.reverse();
  return ordered;
}

// Ramer-Douglas-Peucker: reduces an ordered point path to the minimal
// subset of points such that no dropped point strayed more than `epsilon`
// from the straight segment that replaced it.
function rdpSimplify(points, epsilon) {
  if (points.length < 3) return points;
  const [x1, y1] = points[0];
  const [x2, y2] = points[points.length - 1];
  const dx = x2 - x1, dy = y2 - y1;
  const segLen = Math.hypot(dx, dy);
  let maxDist = -1, splitIndex = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const dist = segLen === 0 ? Math.hypot(x - x1, y - y1) : Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / segLen;
    if (dist > maxDist) { maxDist = dist; splitIndex = i; }
  }
  if (maxDist <= epsilon) return [points[0], points[points.length - 1]];
  const left = rdpSimplify(points.slice(0, splitIndex + 1), epsilon);
  const right = rdpSimplify(points.slice(splitIndex), epsilon);
  return left.slice(0, -1).concat(right);
}

// Replaces each pruned edge with a chain through however many intermediate
// nodes its traced pixel path needs (per rdpSimplify) to actually follow
// the source art's curve, instead of a single straight chord that cuts
// across it. A no-op for already-straight edges (RDP collapses those to
// just the two endpoints, same as today), so low-poly wireframes are
// unaffected.
function curveSimplify(nodes, edges, epsilon) {
  const outNodes = nodes.slice();
  const outEdges = [];
  for (const e of edges) {
    let ordered = orderPathPixels(e.path ?? []);
    // orderPathPixels only knows the arc's own pixels, not which of its two
    // ends belongs to node a vs b — half the time it comes back reversed,
    // and prepending/appending nodes[e.a]/nodes[e.b] without checking turns
    // the path into a jump-and-double-back shape (A, then a long hop to the
    // far end near B, back along the arc to the end near A, then another
    // hop to B) that RDP then "simplifies" into a spurious zigzag cutting
    // across the real art, instead of the actual curve.
    if (ordered.length > 0) {
      const [fx, fy] = ordered[0];
      const [lx, ly] = ordered[ordered.length - 1];
      const [ax, ay] = nodes[e.a];
      const [bx, by] = nodes[e.b];
      const distToA = Math.hypot(fx - ax, fy - ay);
      const distToB = Math.hypot(lx - bx, ly - by);
      const distToAIfReversed = Math.hypot(lx - ax, ly - ay);
      const distToBIfReversed = Math.hypot(fx - bx, fy - by);
      if (distToAIfReversed + distToBIfReversed < distToA + distToB) ordered = ordered.slice().reverse();
    }
    const full = [nodes[e.a], ...ordered, nodes[e.b]];
    const simplified = rdpSimplify(full, epsilon);
    let prevIndex = e.a;
    for (let i = 1; i < simplified.length - 1; i++) {
      const newIndex = outNodes.length;
      outNodes.push(simplified[i]);
      outEdges.push({ a: prevIndex, b: newIndex });
      prevIndex = newIndex;
    }
    outEdges.push({ a: prevIndex, b: e.b });
  }
  return { nodes: outNodes, edges: outEdges };
}

function edgeLength(path) {
  let len = 0;
  for (let i = 1; i < path.length; i++) len += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  return len;
}

// Thinning leaves tiny spurious branches near real corners/junctions. A
// proper closed wireframe has no true dangling endpoints (every segment
// joins two >=3-degree vertices), so any degree-1 node reached by a short
// edge is almost certainly such an artifact — fold it into the junction it
// dangles from and drop the edge, repeating until stable.
function pruneSpurs(nodes, edges, shortLen) {
  let curNodes = nodes.slice();
  let curEdges = edges.map((e) => ({ ...e }));
  let changed = true;
  while (changed) {
    changed = false;
    const degree = new Array(curNodes.length).fill(0);
    for (const e of curEdges) { degree[e.a]++; degree[e.b]++; }
    const nextEdges = [];
    for (const e of curEdges) {
      const len = edgeLength(e.path);
      const aLeaf = degree[e.a] === 1;
      const bLeaf = degree[e.b] === 1;
      if ((aLeaf || bLeaf) && len < shortLen) { changed = true; continue; } // drop spur
      nextEdges.push(e);
    }
    curEdges = nextEdges;
  }
  // Drop now-isolated nodes and remap indices.
  const keep = new Set();
  for (const e of curEdges) { keep.add(e.a); keep.add(e.b); }
  const remap = new Map();
  const outNodes = [];
  for (let i = 0; i < curNodes.length; i++) {
    if (!keep.has(i)) continue;
    remap.set(i, outNodes.length);
    outNodes.push(curNodes[i]);
  }
  const outEdges = curEdges.map((e) => ({ ...e, a: remap.get(e.a), b: remap.get(e.b) }));
  return { nodes: outNodes, edges: outEdges };
}

async function renderGraph(nodes, edges, width, height, outPath) {
  const lines = edges
    .map((e) => {
      const [ax, ay] = nodes[e.a];
      const [bx, by] = nodes[e.b];
      return `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="#8A5A2E" stroke-width="1.2"/>`;
    })
    .join('');
  const dots = nodes.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#c0392b"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#fff"/>${lines}${dots}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(outPath);
}

function normalize(nodes) {
  const xs = nodes.map(([x]) => x);
  const ys = nodes.map(([, y]) => y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = 100 / Math.max(maxX - minX, maxY - minY);
  return nodes.map(([x, y]) => [
    Math.round((x - minX) * scale * 10) / 10,
    Math.round((y - minY) * scale * 10) / 10,
  ]);
}

async function vectorize(imagePath, outName) {
  const { dark, width, height } = await loadDarkMask(imagePath);
  let skel = skeletonize(dark, width, height);
  skel = pruneSkeletonHairs(skel, width, height, HAIR_PRUNE_ITERATIONS);

  const skelPng = Buffer.alloc(width * height);
  for (let i = 0; i < width * height; i++) skelPng[i] = skel[i] ? 0 : 255;
  await sharp(skelPng, { raw: { width, height, channels: 1 } }).png().toFile(`${outName}_skel.png`);

  const rawPoints = findJunctionsAndEndpoints(skel, width, height);
  const clustered = clusterPoints(rawPoints, CLUSTER_RADIUS);
  let nodes = clustered.points;
  const spreads = clustered.spreads;
  console.log(`${outName}: raw junction/endpoint pixels: ${rawPoints.length}, clustered nodes: ${nodes.length}`);

  const { edges: rawEdges, ambiguous } = traceEdges(skel, width, height, nodes, TRACE_NODE_RADIUS, spreads);
  if (ambiguous.length && process.env.VECTORIZE_DEBUG) {
    console.log(`${outName}: dropped ${ambiguous.length} ambiguous arc(s) touching >2 nodes:`, JSON.stringify(ambiguous.slice(0, 10)));
  }
  const seen = new Set();
  let edges = [];
  for (const e of rawEdges) {
    const key = e.a < e.b ? `${e.a}-${e.b}` : `${e.b}-${e.a}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push(e);
  }
  console.log(`${outName}: unique edges before pruning: ${edges.length}`);

  const pruned = pruneSpurs(nodes, edges, SPUR_LENGTH);
  nodes = pruned.nodes;
  edges = pruned.edges;
  console.log(`${outName}: after spur pruning: nodes ${nodes.length}, edges ${edges.length}`);
  if (process.env.VECTORIZE_DEBUG_RAW) {
    writeFileSync(`${outName}_prepruned.json`, JSON.stringify({ nodes, edges: edges.map((e) => [e.a, e.b]) }, null, 2));
  }

  const curved = curveSimplify(nodes, edges, CURVE_EPSILON);
  nodes = curved.nodes;
  edges = curved.edges;
  console.log(`${outName}: after curve simplification: nodes ${nodes.length}, edges ${edges.length}`);

  await renderGraph(nodes, edges, width, height, `${outName}_vectorized.png`);
  if (process.env.VECTORIZE_DEBUG_RAW) {
    writeFileSync(`${outName}_raw.json`, JSON.stringify({ nodes, edges: edges.map((e) => [e.a, e.b]) }, null, 2));
  }

  const normalized = normalize(nodes);
  const graph = { nodes: normalized, edges: edges.map((e) => [e.a, e.b]) };
  writeFileSync(`${outName}_graph.json`, JSON.stringify(graph, null, 2));
  console.log(`Wrote ${outName}_graph.json, ${outName}_skel.png, ${outName}_vectorized.png`);
  console.log('Check the *_vectorized.png against the reference before pasting the graph into badges.ts.');

  return graph;
}

const imagePath = process.argv[2];
if (!imagePath) {
  console.error('Usage: node scripts/vectorize-badge.mjs <path-to-reference-image>');
  process.exit(1);
}
const outName = basename(imagePath, extname(imagePath));
await vectorize(imagePath, outName);

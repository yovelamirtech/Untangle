#!/usr/bin/env node
// Vectorizes a low-poly reference drawing into a badge graph: every facet
// edge, not just the outer silhouette. Used to build the `graph` field of
// a Badge in src/badges.ts (see BADGES.toaster for an example).
//
// Usage: node scripts/vectorize-badge.mjs <path-to-reference-image>
//        VECTORIZE_DEBUG=1 node scripts/vectorize-badge.mjs <path> — also
//        logs any dropped ambiguous arcs (see traceEdges), useful when the
//        output looks less detailed than the reference in a dense area.
//
// Pipeline: threshold the image to a stroke mask -> keep only the largest
// connected component (drops floating text/labels that never touch the
// wireframe) -> skeletonize to 1px lines (Zhang-Suen thinning) -> trim
// short hairs (rasterization staircase artifacts) -> find junctions by
// crossing number -> trace the skeleton between junctions -> prune
// leftover spurs. Writes <name>_graph.json (ready to paste into
// badges.ts) plus <name>_skel.png and <name>_vectorized.png for visual
// sanity-checking before trusting the output.
import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { basename, extname } from 'path';

const WORK_SIZE = 1000;
const CLUSTER_RADIUS = 3;
// Deliberately smaller than CLUSTER_RADIUS: traceEdges erases a disc of
// this radius around each node to isolate the arcs between them. Erasing
// at the full cluster radius wiped out short-but-real connecting segments
// between two vertices that sit close together (the two discs overlapped
// and swallowed the whole segment), leaving disconnected-looking gaps in
// the output even though the source line art has no such gaps.
const TRACE_NODE_RADIUS = 3;
const SPUR_LENGTH = 18;
const HAIR_PRUNE_ITERATIONS = 7;
const DARK_THRESHOLD = 170;

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
function closeGaps(mask, width, height) {
  return erode1px(dilate1px(mask, width, height), width, height);
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
  nativeDark = closeGaps(nativeDark, nativeW, nativeH);

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

  // Keep only the largest 8-connected component. Floating text/labels in
  // the reference art (e.g. dial numbers) sit as separate islands that
  // never touch the wireframe, so this drops them along with any other
  // small stray marks while keeping the whole connected mesh (outline +
  // interior facet lines + anything touching them).
  const labels = new Int32Array(width * height).fill(-1);
  let bestLabel = -1, bestSize = 0, next = 0;
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
    if (size > bestSize) { bestSize = size; bestLabel = label; }
  }
  const filtered = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) filtered[i] = labels[i] === bestLabel ? 1 : 0;

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

  await renderGraph(nodes, edges, width, height, `${outName}_vectorized.png`);

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

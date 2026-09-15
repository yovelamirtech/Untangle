#!/usr/bin/env node
// Vectorizes a low-poly reference drawing into a badge graph: every facet
// edge, not just the outer silhouette. Used to build the `graph` field of
// a Badge in src/badges.ts (see BADGES.toaster for an example).
//
// Usage: node scripts/vectorize-badge.mjs <path-to-reference-image>
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

const WORK_SIZE = 700;
const CLUSTER_RADIUS = 6;
const SPUR_LENGTH = 18;
const HAIR_PRUNE_ITERATIONS = 7;
const DARK_THRESHOLD = 170;

async function loadDarkMask(path) {
  // Work at native resolution: resizing before thresholding blends thin
  // (1-2px) strokes into gray, and the resulting jagged binary edge
  // produces spurious skeleton junctions everywhere. Threshold first, then
  // downsize the already-binary mask with nearest-neighbor (no blending).
  const { data, info } = await sharp(path).grayscale().raw().toBuffer({ resolveWithObject: true });
  const nativeW = info.width, nativeH = info.height;
  const nativeDark = new Uint8Array(nativeW * nativeH);
  for (let i = 0; i < nativeW * nativeH; i++) nativeDark[i] = data[i] < DARK_THRESHOLD ? 1 : 0;

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
    clusters.push([cx, cy]);
  }
  return clusters;
}

// Erase a disc of `nodeRadius` around each node center from the skeleton,
// then connected-component-label what's left: every remaining component is
// a simple arc (degree 2 throughout, since junctions were just erased)
// belonging to exactly one edge. Reading off which node zone(s) each
// component touches is far more robust than walking the skeleton pixel by
// pixel and guessing which neighbor continues the same line at a junction.
function traceEdges(skel, width, height, nodes, nodeRadius) {
  const idx = (x, y) => y * width + x;
  const nodeZone = new Int32Array(width * height).fill(-1);
  for (let ni = 0; ni < nodes.length; ni++) {
    const [cx, cy] = nodes[ni];
    const r = Math.ceil(nodeRadius);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = Math.round(cx) + dx, y = Math.round(cy) + dy;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        if (Math.hypot(dx, dy) <= nodeRadius) nodeZone[idx(x, y)] = ni;
      }
    }
  }

  const remaining = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) remaining[i] = skel[i] && nodeZone[i] === -1 ? 1 : 0;

  const visited = new Uint8Array(width * height);
  const edges = [];
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
      // >2: an arc brushing more than two zones (rare); drop rather than guess.
    }
  }
  return edges;
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
  let nodes = clusterPoints(rawPoints, CLUSTER_RADIUS);
  console.log(`${outName}: raw junction/endpoint pixels: ${rawPoints.length}, clustered nodes: ${nodes.length}`);

  const rawEdges = traceEdges(skel, width, height, nodes, CLUSTER_RADIUS);
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

export interface Point {
  x: number;
  y: number;
}

function orientation(a: Point, b: Point, c: Point): number {
  const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (Math.abs(cross) < 1e-9) return 0;
  return cross > 0 ? 1 : -1;
}

function onSegment(a: Point, b: Point, p: Point): boolean {
  return (
    Math.min(a.x, b.x) - 1e-9 <= p.x &&
    p.x <= Math.max(a.x, b.x) + 1e-9 &&
    Math.min(a.y, b.y) - 1e-9 <= p.y &&
    p.y <= Math.max(a.y, b.y) + 1e-9
  );
}

/**
 * Whether segments (p1,p2) and (p3,p4) cross. Segments that only touch at a
 * shared endpoint are not considered crossing.
 */
export function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d1 = orientation(p3, p4, p1);
  const d2 = orientation(p3, p4, p2);
  const d3 = orientation(p1, p2, p3);
  const d4 = orientation(p1, p2, p4);

  if (d1 !== d2 && d3 !== d4 && d1 !== 0 && d2 !== 0 && d3 !== 0 && d4 !== 0) {
    return true;
  }

  // Colinear overlap cases (excluding a shared endpoint touching the other segment).
  if (d1 === 0 && onSegment(p3, p4, p1) && !pointsEqual(p1, p3) && !pointsEqual(p1, p4)) return true;
  if (d2 === 0 && onSegment(p3, p4, p2) && !pointsEqual(p2, p3) && !pointsEqual(p2, p4)) return true;
  if (d3 === 0 && onSegment(p1, p2, p3) && !pointsEqual(p3, p1) && !pointsEqual(p3, p2)) return true;
  if (d4 === 0 && onSegment(p1, p2, p4) && !pointsEqual(p4, p1) && !pointsEqual(p4, p2)) return true;

  return false;
}

function pointsEqual(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;
}

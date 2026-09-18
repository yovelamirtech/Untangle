import { segmentsIntersect } from '../geometry';

describe('segmentsIntersect', () => {
  it('detects a simple X crossing', () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 })).toBe(true);
  });

  it('reports no crossing for parallel segments', () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 })).toBe(false);
  });

  it('does not count a shared endpoint as a crossing', () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 10, y: 10 }, { x: 20, y: 0 })).toBe(false);
  });

  it('does not count two segments that merely touch endpoint-to-endpoint at distinct points', () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 5, y: 5 }, { x: 10, y: 0 })).toBe(false);
  });

  it('detects a T-junction where one endpoint lands on the other segment', () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 10 })).toBe(true);
  });

  it('detects colinear overlapping segments', () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 }, { x: 15, y: 0 })).toBe(true);
  });

  it('reports no crossing for colinear, non-overlapping segments', () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }, { x: 15, y: 0 })).toBe(false);
  });

  it('reports no crossing for disjoint segments', () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 5, y: 5 }, { x: 6, y: 6 })).toBe(false);
  });
});

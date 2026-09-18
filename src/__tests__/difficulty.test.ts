import { getDifficultyForLevel, getMinCrossingsForLevel } from '../difficulty';

describe('getDifficultyForLevel', () => {
  it('starts at 9 nodes on level 1', () => {
    expect(getDifficultyForLevel(1).nodeCount).toBe(9);
  });

  it('adds one node every 2 levels', () => {
    expect(getDifficultyForLevel(2).nodeCount).toBe(9);
    expect(getDifficultyForLevel(3).nodeCount).toBe(10);
    expect(getDifficultyForLevel(5).nodeCount).toBe(11);
  });

  it('never exceeds the 30-node cap, however high the level', () => {
    expect(getDifficultyForLevel(10000).nodeCount).toBe(30);
  });

  it('node count is non-decreasing as level increases', () => {
    let previous = getDifficultyForLevel(1).nodeCount;
    for (let level = 2; level <= 200; level++) {
      const current = getDifficultyForLevel(level).nodeCount;
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });
});

describe('getMinCrossingsForLevel', () => {
  it('is never below the floor of 3, even for tiny node counts', () => {
    expect(getMinCrossingsForLevel(1)).toBe(3);
    expect(getMinCrossingsForLevel(0)).toBe(3);
  });

  it('scales roughly as half the node count within the floor/ceiling', () => {
    expect(getMinCrossingsForLevel(9)).toBe(5); // round(4.5) = 5 (round-half-up)
    expect(getMinCrossingsForLevel(20)).toBe(10);
  });

  it('is capped at 40 for very large node counts (e.g. graph-based badges)', () => {
    expect(getMinCrossingsForLevel(321)).toBe(40);
  });
});

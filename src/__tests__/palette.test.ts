import { ENDPOINT_ACCENT, getPaletteForLevel } from '../palette';

describe('getPaletteForLevel', () => {
  it('cycles palettes by level (level 1 and level 13, 12 apart, match)', () => {
    const first = getPaletteForLevel(1);
    const wrapped = getPaletteForLevel(13);
    expect(wrapped.background).toBe(first.background);
    expect(wrapped.rope).toBe(first.rope);
    expect(wrapped.node).toBe(first.node);
  });

  it('gives adjacent levels different palettes', () => {
    const level1 = getPaletteForLevel(1);
    const level2 = getPaletteForLevel(2);
    expect(level1.background).not.toBe(level2.background);
  });

  it('always uses the shared endpoint accent, regardless of level', () => {
    expect(getPaletteForLevel(1).endpoint).toBe(ENDPOINT_ACCENT);
    expect(getPaletteForLevel(7).endpoint).toBe(ENDPOINT_ACCENT);
  });

  it('returns valid, well-formed hex colors', () => {
    const hexColor = /^#[0-9A-Fa-f]{6}$/;
    const hexColorWithAlpha = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;
    for (let level = 1; level <= 12; level++) {
      const palette = getPaletteForLevel(level);
      expect(palette.background).toMatch(hexColor);
      expect(palette.rope).toMatch(hexColor);
      expect(palette.node).toMatch(hexColor);
      expect(palette.border).toMatch(hexColorWithAlpha);
    }
  });
});

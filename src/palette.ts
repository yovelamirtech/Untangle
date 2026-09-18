export interface LevelPalette {
  background: string;
  rope: string;
  node: string;
  border: string;
  /** Fill for the rope's two loose ends — reuses the palette's own rope
   * color (already on screen as the edges) rather than introducing a new
   * one, so the start/end nodes read as distinct beads without clashing. */
  endpoint: string;
}

/**
 * Hand-picked pastel palettes (each background/rope/node trio drawn from
 * one calm hue family) rather than procedurally generated ones — math-driven
 * hue offsets occasionally landed on combinations that clashed instead of
 * feeling cohesive. Cycled by level so nearby levels still look distinct.
 */
const PALETTES: Omit<LevelPalette, 'border' | 'endpoint'>[] = [
  { background: '#F3EEFC', rope: '#C9B6EC', node: '#9B7FD1' }, // lavender bloom
  { background: '#FFF1E8', rope: '#FFC9A8', node: '#F2934F' }, // peach sorbet
  { background: '#FBEEF7', rope: '#EFB6DE', node: '#C765AC' }, // berry frost
  { background: '#FFF0F3', rope: '#FFC2D1', node: '#E8688A' }, // rose petal
  { background: '#EAF4FF', rope: '#A9D3FF', node: '#4E93D9' }, // sky cotton
  { background: '#FFFBEA', rope: '#FFE8A3', node: '#E8B93F' }, // butter lemon
  { background: '#EAF2FB', rope: '#A8C6E8', node: '#4F7FAE' }, // denim mist
  { background: '#F7EEFB', rope: '#E0BFF0', node: '#AE5FCC' }, // lilac mist
  { background: '#FFF4E8', rope: '#FFD8A8', node: '#E89A3F' }, // apricot
  { background: '#F3FBEA', rope: '#D0EDA8', node: '#B5972F' }, // honeydew (muted, kept just barely green)
  { background: '#EEF0FF', rope: '#C2C6F5', node: '#6F74C9' }, // periwinkle
  { background: '#FFF2EE', rope: '#FFC1B6', node: '#E86F55' }, // coral blush
];

function darken(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const toHex = (v: number) =>
    Math.round(v * (1 - amount))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function getPaletteForLevel(level: number): LevelPalette {
  const { background, rope, node } = PALETTES[(level - 1) % PALETTES.length];
  const darkRope = darken(rope, 0.18);
  return { background, rope: darkRope, node, border: `${rope}99`, endpoint: darkRope };
}

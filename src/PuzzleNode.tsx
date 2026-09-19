import { memo } from 'react';
import { Circle, RadialGradient, Shadow, vec } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';

interface Props {
  radius: number;
  fill: string;
  nodeX: SharedValue<number>;
  nodeY: SharedValue<number>;
  pulse: SharedValue<number>;
  scale: SharedValue<number>;
  /** Adds a drop shadow for a bit of depth. Off by default for Badge
   * Challenge, whose puzzles can have hundreds of nodes — an extra image
   * filter per node there isn't worth the draw cost. */
  withShadow?: boolean;
}

function lighten(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const toHex = (v: number) =>
    Math.round(v + (255 - v) * amount)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

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

function PuzzleNode({ radius, fill, nodeX, nodeY, pulse, scale, withShadow = false }: Props) {
  // Keep dots readable at any zoom level: grow their canvas-space radius as
  // the camera zooms out, capped so they don't balloon at extreme zoom-out.
  // Recomputed live every frame — cheap here since Skia batches the whole
  // scene into one GPU draw call instead of updating many native views.
  const r = useDerivedValue(() => {
    const desiredCanvasRadius = 7 / scale.value;
    const screenRadius = Math.min(Math.max(radius, desiredCanvasRadius), radius * 4);
    return screenRadius + pulse.value * 4;
  }, [radius, scale, pulse]);

  // A radial gradient whose bright spot sits up and to the left of center
  // fakes a single overhead light source, turning a flat dot into a glossy
  // bead with real volume — same trick as a CSS "sphere" gradient.
  const highlightCenter = useDerivedValue(
    () => vec(nodeX.value - r.value * 0.35, nodeY.value - r.value * 0.35),
    [nodeX, nodeY, r]
  );
  const gradientRadius = useDerivedValue(() => r.value * 1.7, [r]);

  const highlight = lighten(fill, 0.55);
  const shade = darken(fill, 0.32);

  return (
    <Circle cx={nodeX} cy={nodeY} r={r}>
      <RadialGradient c={highlightCenter} r={gradientRadius} colors={[highlight, fill, shade]} positions={[0, 0.5, 1]} />
      {withShadow && (
        <>
          {/* Soft, wide ambient shadow for a "lifted off the board" sense of height... */}
          <Shadow dx={0} dy={3} blur={5} color="rgba(0,0,0,0.16)" />
          {/* ...plus a tight contact shadow so the bead still reads as touching the board. */}
          <Shadow dx={0} dy={1} blur={1.5} color="rgba(0,0,0,0.28)" />
        </>
      )}
    </Circle>
  );
}

export default memo(PuzzleNode);

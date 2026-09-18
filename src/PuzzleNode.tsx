import { memo } from 'react';
import { Circle, Shadow } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';

interface Props {
  radius: number;
  fill: string;
  nodeX: SharedValue<number>;
  nodeY: SharedValue<number>;
  pulse: SharedValue<number>;
  scale: SharedValue<number>;
  /** Adds a small drop shadow for a bit of depth. Off by default for Badge
   * Challenge, whose puzzles can have hundreds of nodes — an extra image
   * filter per node there isn't worth the draw cost. */
  withShadow?: boolean;
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

  return (
    <Circle cx={nodeX} cy={nodeY} r={r} color={fill}>
      {withShadow && <Shadow dx={0} dy={1.5} blur={2.5} color="rgba(0,0,0,0.22)" />}
    </Circle>
  );
}

export default memo(PuzzleNode);

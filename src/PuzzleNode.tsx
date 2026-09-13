import { memo } from 'react';
import { Circle } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';

interface Props {
  radius: number;
  fill: string;
  nodeX: SharedValue<number>;
  nodeY: SharedValue<number>;
  pulse: SharedValue<number>;
  scale: SharedValue<number>;
}

function PuzzleNode({ radius, fill, nodeX, nodeY, pulse, scale }: Props) {
  // Keep dots readable at any zoom level: grow their canvas-space radius as
  // the camera zooms out, capped so they don't balloon at extreme zoom-out.
  // Recomputed live every frame — cheap here since Skia batches the whole
  // scene into one GPU draw call instead of updating many native views.
  const r = useDerivedValue(() => {
    const desiredCanvasRadius = 7 / scale.value;
    const screenRadius = Math.min(Math.max(radius, desiredCanvasRadius), radius * 4);
    return screenRadius + pulse.value * 4;
  }, [radius, scale, pulse]);

  return <Circle cx={nodeX} cy={nodeY} r={r} color={fill} />;
}

export default memo(PuzzleNode);

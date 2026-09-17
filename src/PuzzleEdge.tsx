import { memo } from 'react';
import { Line, vec } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';

interface Props {
  fromX: SharedValue<number>;
  fromY: SharedValue<number>;
  toX: SharedValue<number>;
  toY: SharedValue<number>;
  pulse: SharedValue<number>;
  lineWidth: SharedValue<number>;
  color: string;
}

function PuzzleEdge({ fromX, fromY, toX, toY, pulse, lineWidth, color }: Props) {
  const p1 = useDerivedValue(() => vec(fromX.value, fromY.value), [fromX, fromY]);
  const p2 = useDerivedValue(() => vec(toX.value, toY.value), [toX, toY]);
  const strokeWidth = useDerivedValue(() => lineWidth.value + pulse.value * 3, [lineWidth, pulse]);

  return <Line p1={p1} p2={p2} color={color} style="stroke" strokeWidth={strokeWidth} strokeCap="round" />;
}

export default memo(PuzzleEdge);

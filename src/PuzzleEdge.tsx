import { memo } from 'react';
import { Line, Shadow, vec } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';

import { useDevGraphicsFlags } from './devGraphicsFlags';

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

  // __DEV__-only override for testing the effect on/off on a real device;
  // defaults to on and is irrelevant outside the dev panel.
  const { edgeGlow } = useDevGraphicsFlags();

  return (
    <Line p1={p1} p2={p2} color={color} style="stroke" strokeWidth={strokeWidth} strokeCap="round">
      {/* Neon-style glow: a soft, color-matched halo with no offset, layered
          under the rope's own stroke rather than replacing it. */}
      {edgeGlow && <Shadow dx={0} dy={0} blur={6} color={`${color}99`} />}
    </Line>
  );
}

export default memo(PuzzleEdge);

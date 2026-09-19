import { memo } from 'react';
import { Blur, Circle } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';

interface Props {
  baseX: number;
  baseY: number;
  radius: number;
  /** How far this orb travels per unit of tilt — a bigger value reads as "closer". */
  depth: number;
  color: string;
  opacity: number;
  tiltX: SharedValue<number>;
  tiltY: SharedValue<number>;
}

function ParallaxOrb({ baseX, baseY, radius, depth, color, opacity, tiltX, tiltY }: Props) {
  const cx = useDerivedValue(() => baseX + tiltX.value * depth, [tiltX, baseX, depth]);
  const cy = useDerivedValue(() => baseY + tiltY.value * depth, [tiltY, baseY, depth]);

  return (
    <Circle cx={cx} cy={cy} r={radius} color={color} opacity={opacity}>
      <Blur blur={radius * 0.45} />
    </Circle>
  );
}

export default memo(ParallaxOrb);

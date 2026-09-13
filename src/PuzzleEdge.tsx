import Animated, { SharedValue, useAnimatedProps } from 'react-native-reanimated';
import { Line } from 'react-native-svg';

import { Node } from './puzzle';

const AnimatedLine = Animated.createAnimatedComponent(Line);

interface Props {
  fromId: number;
  toId: number;
  positions: SharedValue<Node[]>;
  pulse: SharedValue<number>;
  color: string;
}

export default function PuzzleEdge({ fromId, toId, positions, pulse, color }: Props) {
  const animatedProps = useAnimatedProps(() => {
    const from = positions.value.find((p) => p.id === fromId)!;
    const to = positions.value.find((p) => p.id === toId)!;
    return { x1: from.x, y1: from.y, x2: to.x, y2: to.y, strokeWidth: 2 + pulse.value * 3 };
  });

  return <AnimatedLine animatedProps={animatedProps} stroke={color} />;
}

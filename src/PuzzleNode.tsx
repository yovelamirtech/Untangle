import Animated, { SharedValue, useAnimatedProps } from 'react-native-reanimated';
import { Circle } from 'react-native-svg';

import { Node } from './puzzle';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  id: number;
  radius: number;
  fill: string;
  positions: SharedValue<Node[]>;
  pulse: SharedValue<number>;
}

export default function PuzzleNode({ id, radius, fill, positions, pulse }: Props) {
  const animatedProps = useAnimatedProps(() => {
    const node = positions.value.find((p) => p.id === id)!;
    return { cx: node.x, cy: node.y, r: radius + pulse.value * 4 };
  });

  return <AnimatedCircle animatedProps={animatedProps} fill={fill} />;
}

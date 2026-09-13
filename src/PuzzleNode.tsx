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
  cameraScale: SharedValue<number>;
}

export default function PuzzleNode({ id, radius, fill, positions, pulse, cameraScale }: Props) {
  const animatedProps = useAnimatedProps(() => {
    const node = positions.value.find((p) => p.id === id)!;
    // Keep dots readable at any zoom level: grow their canvas-space radius
    // as the camera zooms out, capped so they don't balloon at extreme
    // zoom-out. At high zoom the natural (uncapped) radius already wins.
    const desiredCanvasRadius = 5 / cameraScale.value;
    const screenRadius = Math.min(Math.max(radius, desiredCanvasRadius), radius * 4);
    return { cx: node.x, cy: node.y, r: screenRadius + pulse.value * 4 };
  });

  return <AnimatedCircle animatedProps={animatedProps} fill={fill} />;
}

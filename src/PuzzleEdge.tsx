import Animated, { SharedValue, useAnimatedProps } from 'react-native-reanimated';
import { Line } from 'react-native-svg';

import { Node } from './puzzle';

const AnimatedLine = Animated.createAnimatedComponent(Line);

interface Props {
  fromId: number;
  toId: number;
  positions: SharedValue<Node[]>;
  pulse: SharedValue<number>;
  cameraScale: SharedValue<number>;
  color: string;
}

export default function PuzzleEdge({ fromId, toId, positions, pulse, cameraScale, color }: Props) {
  const animatedProps = useAnimatedProps(() => {
    const from = positions.value.find((p) => p.id === fromId)!;
    const to = positions.value.find((p) => p.id === toId)!;
    const baseWidth = 2 + pulse.value * 3;
    // Grow line thickness as the camera zooms out so the rope stays
    // legible from a distance, capped to avoid absurdly thick lines.
    const desiredCanvasWidth = 1.6 / cameraScale.value;
    const strokeWidth = Math.min(Math.max(baseWidth, desiredCanvasWidth), baseWidth * 5);
    return { x1: from.x, y1: from.y, x2: to.x, y2: to.y, strokeWidth };
  });

  return <AnimatedLine animatedProps={animatedProps} stroke={color} />;
}

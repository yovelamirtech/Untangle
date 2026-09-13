import Animated, { SharedValue, useAnimatedProps } from 'react-native-reanimated';
import { Line } from 'react-native-svg';

const AnimatedLine = Animated.createAnimatedComponent(Line);

interface Props {
  fromValue: SharedValue<{ x: number; y: number }>;
  toValue: SharedValue<{ x: number; y: number }>;
  pulse: SharedValue<number>;
  settledScale: SharedValue<number>;
  color: string;
}

export default function PuzzleEdge({ fromValue, toValue, pulse, settledScale, color }: Props) {
  const animatedProps = useAnimatedProps(() => {
    const baseWidth = 2 + pulse.value * 3;
    // Grow line thickness as the camera zooms out so the rope stays
    // legible from a distance, capped to avoid absurdly thick lines.
    // Based on settledScale (updated only when a gesture ends) rather than
    // the live zoom value, so an active pinch doesn't force every line to
    // recompute every frame.
    const desiredCanvasWidth = 1.6 / settledScale.value;
    const strokeWidth = Math.min(Math.max(baseWidth, desiredCanvasWidth), baseWidth * 5);
    return { x1: fromValue.value.x, y1: fromValue.value.y, x2: toValue.value.x, y2: toValue.value.y, strokeWidth };
  });

  return <AnimatedLine animatedProps={animatedProps} stroke={color} />;
}

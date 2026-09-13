import Animated, { SharedValue, useAnimatedProps } from 'react-native-reanimated';
import { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  radius: number;
  fill: string;
  nodeValue: SharedValue<{ x: number; y: number }>;
  pulse: SharedValue<number>;
  settledScale: SharedValue<number>;
}

export default function PuzzleNode({ radius, fill, nodeValue, pulse, settledScale }: Props) {
  const animatedProps = useAnimatedProps(() => {
    // Keep dots readable at any zoom level: grow their canvas-space radius
    // as the camera zooms out, capped so they don't balloon at extreme
    // zoom-out. Based on settledScale (updated only when a gesture ends),
    // not the live zoom value, so an active pinch doesn't force every dot
    // to recompute every frame.
    const desiredCanvasRadius = 5 / settledScale.value;
    const screenRadius = Math.min(Math.max(radius, desiredCanvasRadius), radius * 4);
    return { cx: nodeValue.value.x, cy: nodeValue.value.y, r: screenRadius + pulse.value * 4 };
  });

  return <AnimatedCircle animatedProps={animatedProps} fill={fill} />;
}

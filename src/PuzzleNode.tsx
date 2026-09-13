import { memo } from 'react';
import Animated, { SharedValue, useAnimatedProps } from 'react-native-reanimated';
import { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  radius: number;
  fill: string;
  nodeX: SharedValue<number>;
  nodeY: SharedValue<number>;
  pulse: SharedValue<number>;
  settledScale: SharedValue<number>;
}

function PuzzleNode({ radius, fill, nodeX, nodeY, pulse, settledScale }: Props) {
  const animatedProps = useAnimatedProps(() => {
    // Keep dots readable at any zoom level: grow their canvas-space radius
    // as the camera zooms out, capped so they don't balloon at extreme
    // zoom-out. Based on settledScale (updated only when a gesture ends),
    // not the live zoom value, so an active pinch doesn't force every dot
    // to recompute every frame.
    const desiredCanvasRadius = 7 / settledScale.value;
    const screenRadius = Math.min(Math.max(radius, desiredCanvasRadius), radius * 4);
    return { cx: nodeX.value, cy: nodeY.value, r: screenRadius + pulse.value * 4 };
  });

  return <AnimatedCircle animatedProps={animatedProps} fill={fill} />;
}

// Each instance's props (shared value references) are stable across
// re-renders unless the level changes, so skip re-rendering ~100 of these
// every time an unrelated React state update (e.g. the crossing count)
// causes the parent to re-render.
export default memo(PuzzleNode);

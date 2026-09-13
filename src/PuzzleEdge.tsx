import { memo } from 'react';
import Animated, { SharedValue, useAnimatedProps } from 'react-native-reanimated';
import { Line } from 'react-native-svg';

const AnimatedLine = Animated.createAnimatedComponent(Line);

const STROKE_WIDTH = 3;

interface Props {
  fromX: SharedValue<number>;
  fromY: SharedValue<number>;
  toX: SharedValue<number>;
  toY: SharedValue<number>;
  pulse: SharedValue<number>;
  color: string;
}

function PuzzleEdge({ fromX, fromY, toX, toY, pulse, color }: Props) {
  const animatedProps = useAnimatedProps(() => ({
    x1: fromX.value,
    y1: fromY.value,
    x2: toX.value,
    y2: toY.value,
    strokeWidth: STROKE_WIDTH + pulse.value * 3,
  }));

  // vectorEffect="non-scaling-stroke" keeps the line's on-screen thickness
  // constant as the camera zooms, handled natively by the SVG renderer —
  // no per-frame JS/UI-thread work needed regardless of zoom level.
  return (
    <AnimatedLine animatedProps={animatedProps} stroke={color} vectorEffect="non-scaling-stroke" />
  );
}

// Each instance's props (shared value references) are stable across
// re-renders unless the level changes, so skip re-rendering ~100 of these
// every time an unrelated React state update (e.g. the crossing count)
// causes the parent to re-render.
export default memo(PuzzleEdge);

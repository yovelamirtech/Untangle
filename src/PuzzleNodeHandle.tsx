import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, SharedValue, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { Node } from './puzzle';

interface Props {
  id: number;
  size: number;
  positions: SharedValue<Node[]>;
  cameraScale: SharedValue<number>;
  onDrag: () => void;
}

export default function PuzzleNodeHandle({ id, size, positions, cameraScale, onDrag }: Props) {
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const gesture = Gesture.Pan()
    .onStart(() => {
      const node = positions.value.find((p) => p.id === id)!;
      startX.value = node.x;
      startY.value = node.y;
    })
    .onUpdate((event) => {
      // Screen-space drag distance must be converted to canvas-space so the
      // node tracks the finger correctly regardless of the current zoom.
      const newX = startX.value + event.translationX / cameraScale.value;
      const newY = startY.value + event.translationY / cameraScale.value;
      positions.value = positions.value.map((p) => (p.id === id ? { id, x: newX, y: newY } : p));
      runOnJS(onDrag)();
    });

  const style = useAnimatedStyle(() => {
    const node = positions.value.find((p) => p.id === id)!;
    // Keep the tap target a constant on-screen size: the parent canvas is
    // visually scaled by cameraScale, so pre-shrink/grow inversely here.
    const screenSize = size / cameraScale.value;
    return {
      position: 'absolute' as const,
      left: node.x - screenSize / 2,
      top: node.y - screenSize / 2,
      width: screenSize,
      height: screenSize,
      borderRadius: screenSize / 2,
    };
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={style} />
    </GestureDetector>
  );
}

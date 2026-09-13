import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, SharedValue, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { Node } from './puzzle';

interface Props {
  id: number;
  size: number;
  positions: SharedValue<Node[]>;
  onDrag: () => void;
}

export default function PuzzleNodeHandle({ id, size, positions, onDrag }: Props) {
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const gesture = Gesture.Pan()
    .onStart(() => {
      const node = positions.value.find((p) => p.id === id)!;
      startX.value = node.x;
      startY.value = node.y;
    })
    .onUpdate((event) => {
      const newX = startX.value + event.translationX;
      const newY = startY.value + event.translationY;
      positions.value = positions.value.map((p) => (p.id === id ? { id, x: newX, y: newY } : p));
      runOnJS(onDrag)();
    });

  const style = useAnimatedStyle(() => {
    const node = positions.value.find((p) => p.id === id)!;
    return {
      position: 'absolute' as const,
      left: node.x - size / 2,
      top: node.y - size / 2,
      width: size,
      height: size,
      borderRadius: size / 2,
    };
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={style} />
    </GestureDetector>
  );
}

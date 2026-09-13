import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { getDifficultyForLevel } from './difficulty';
import PuzzleEdge from './PuzzleEdge';
import PuzzleNode from './PuzzleNode';
import PuzzleNodeHandle from './PuzzleNodeHandle';
import { countCrossings, generateSolvedGraph, Graph, Node, scrambleGraphAtLeast } from './puzzle';

const NODE_RADIUS = 6;
const HANDLE_SIZE = 32;
const ADVANCE_DELAY_MS = 1000;
const CANVAS_MARGIN = 60;
const FIT_PADDING = 0.92;

const COLORS = {
  background: '#EDE6FB',
  rope: '#B8A9E8',
  ropeSolved: '#7FD9B9',
  node: '#F6A8B8',
  nodeSolved: '#7FD9B9',
  subtitle: '#948AB3',
  subtitleSolved: '#3F9B79',
  overlayBg: 'rgba(255,255,255,0.6)',
};

/** The rope spreads over a canvas much larger than the screen — more so for longer ropes. */
function getCanvasSize(nodeCount: number, viewportMax: number): number {
  return viewportMax * (1.5 + nodeCount / 40);
}

function getFitScale(canvasSize: number, viewportMin: number): number {
  return (viewportMin / canvasSize) * FIT_PADDING;
}

function buildPuzzle(canvasSize: number, level: number): Graph {
  const { nodeCount } = getDifficultyForLevel(level);
  const solved = generateSolvedGraph(
    nodeCount,
    { x: canvasSize / 2, y: canvasSize / 2 },
    canvasSize / 2 - CANVAS_MARGIN
  );
  const minCrossings = solved.edges.length;
  return scrambleGraphAtLeast(solved, canvasSize, canvasSize, CANVAS_MARGIN, minCrossings);
}

export default function PuzzleScreen() {
  const { width, height } = useWindowDimensions();
  // On web, useWindowDimensions can report 0 on the very first render before
  // layout is measured. Since canvas size/graph are seeded once via a
  // useState initializer, mounting the game before real dimensions arrive
  // would freeze it at a size of 0 forever.
  if (!width || !height) return null;
  return <PuzzleGame width={width} height={height} />;
}

function PuzzleGame({ width, height }: { width: number; height: number }) {
  const viewportMax = Math.max(width, height);
  const viewportMin = Math.min(width, height);

  const [level, setLevel] = useState(1);
  const [canvasSize, setCanvasSize] = useState(() =>
    getCanvasSize(getDifficultyForLevel(1).nodeCount, viewportMax)
  );
  const [graph, setGraph] = useState<Graph>(() => buildPuzzle(canvasSize, 1));
  const [crossings, setCrossings] = useState(() => countCrossings(graph));

  const positions = useSharedValue<Node[]>(graph.nodes);
  const pulse = useSharedValue(0);
  const crossingsRef = useRef(crossings);
  const graphRef = useRef(graph);

  const fitScale = useMemo(() => getFitScale(canvasSize, viewportMin), [canvasSize, viewportMin]);
  const minScale = fitScale * 0.4;
  const maxScale = fitScale * 5;

  const scale = useSharedValue(fitScale);
  const savedScale = useSharedValue(fitScale);
  const translateX = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const resetCamera = useCallback(() => {
    scale.value = withTiming(fitScale);
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedScale.value = fitScale;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, [fitScale, scale, savedScale, translateX, savedTranslateX, translateY, savedTranslateY]);

  const advanceLevel = useCallback(() => {
    if (crossingsRef.current !== 0) return;
    const nextLevel = level + 1;
    const nextNodeCount = getDifficultyForLevel(nextLevel).nodeCount;
    const nextCanvasSize = getCanvasSize(nextNodeCount, viewportMax);
    const nextGraph = buildPuzzle(nextCanvasSize, nextLevel);
    const nextFitScale = getFitScale(nextCanvasSize, viewportMin);

    setLevel(nextLevel);
    setCanvasSize(nextCanvasSize);
    setGraph(nextGraph);
    graphRef.current = nextGraph;
    positions.value = nextGraph.nodes;
    const nextCrossings = countCrossings(nextGraph);
    setCrossings(nextCrossings);
    crossingsRef.current = nextCrossings;
    pulse.value = 0;

    scale.value = nextFitScale;
    savedScale.value = nextFitScale;
    translateX.value = 0;
    savedTranslateX.value = 0;
    translateY.value = 0;
    savedTranslateY.value = 0;
  }, [
    level,
    viewportMax,
    viewportMin,
    positions,
    pulse,
    scale,
    savedScale,
    translateX,
    savedTranslateX,
    translateY,
    savedTranslateY,
  ]);

  const handleDrag = useCallback(() => {
    const newCrossings = countCrossings({ nodes: positions.value, edges: graphRef.current.edges });
    const wasSolved = crossingsRef.current === 0;
    crossingsRef.current = newCrossings;
    setCrossings(newCrossings);

    if (newCrossings === 0 && !wasSolved) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      pulse.value = withSequence(
        withTiming(1, { duration: 200 }),
        withTiming(0.3, { duration: 250 }),
        withTiming(1, { duration: 200 }),
        withTiming(0, { duration: 250 })
      );
      setTimeout(advanceLevel, ADVANCE_DELAY_MS);
    }
  }, [advanceLevel, positions, pulse]);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      const next = savedScale.value * event.scale;
      scale.value = Math.min(Math.max(next, minScale), maxScale);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const cameraGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  const canvasStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }],
  }));

  const solved = crossings === 0;

  return (
    <View style={styles.container}>
      <GestureDetector gesture={cameraGesture}>
        <Animated.View style={StyleSheet.absoluteFill} />
      </GestureDetector>

      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.canvasWrapper,
          {
            width: canvasSize,
            height: canvasSize,
            left: (width - canvasSize) / 2,
            top: (height - canvasSize) / 2,
          },
          canvasStyle,
        ]}
      >
        <Svg width={canvasSize} height={canvasSize} style={StyleSheet.absoluteFill}>
          {graph.edges.map((edge, i) => (
            <PuzzleEdge
              key={i}
              fromId={edge.a}
              toId={edge.b}
              positions={positions}
              pulse={pulse}
              color={solved ? COLORS.ropeSolved : COLORS.rope}
            />
          ))}
          {graph.nodes.map((node) => (
            <PuzzleNode
              key={node.id}
              id={node.id}
              radius={NODE_RADIUS}
              fill={solved ? COLORS.nodeSolved : COLORS.node}
              positions={positions}
              pulse={pulse}
            />
          ))}
        </Svg>
        {graph.nodes.map((node) => (
          <PuzzleNodeHandle
            key={node.id}
            id={node.id}
            size={HANDLE_SIZE}
            positions={positions}
            cameraScale={scale}
            onDrag={handleDrag}
          />
        ))}
      </Animated.View>

      <View style={styles.overlay} pointerEvents="box-none">
        <Text style={[styles.subtitle, solved && styles.subtitleSolved]}>
          {solved ? 'Solved!' : `${crossings} crossing${crossings === 1 ? '' : 's'}`}
        </Text>
        <Pressable style={styles.fitButton} onPress={resetCamera}>
          <Text style={styles.fitButtonText}>Fit</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    overflow: 'hidden',
  },
  canvasWrapper: {
    position: 'absolute',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 20,
  },
  subtitle: {
    color: COLORS.subtitle,
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: COLORS.overlayBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  subtitleSolved: {
    color: COLORS.subtitleSolved,
  },
  fitButton: {
    backgroundColor: COLORS.overlayBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  fitButtonText: {
    color: COLORS.subtitle,
    fontSize: 13,
    fontWeight: '600',
  },
});

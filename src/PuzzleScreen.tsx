import * as Haptics from 'expo-haptics';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { getDifficultyForLevel } from './difficulty';
import PuzzleEdge from './PuzzleEdge';
import PuzzleNode from './PuzzleNode';
import { countCrossings, generateSolvedGraph, Graph, Node, scrambleGraphAtLeast } from './puzzle';

const NODE_RADIUS = 6;
const HIT_RADIUS_SCREEN = 28;
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

function getFitCamera(canvasSize: number, width: number, height: number) {
  const fitScale = getFitScale(canvasSize, Math.min(width, height));
  return {
    scale: fitScale,
    translateX: (width - canvasSize * fitScale) / 2,
    translateY: (height - canvasSize * fitScale) / 2,
  };
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

  const initialCamera = getFitCamera(canvasSize, width, height);
  const scale = useSharedValue(initialCamera.scale);
  const savedScale = useSharedValue(initialCamera.scale);
  const translateX = useSharedValue(initialCamera.translateX);
  const savedTranslateX = useSharedValue(initialCamera.translateX);
  const translateY = useSharedValue(initialCamera.translateY);
  const savedTranslateY = useSharedValue(initialCamera.translateY);
  const minScale = initialCamera.scale * 0.4;
  const maxScale = initialCamera.scale * 5;

  // -1 while panning the camera; a node id while dragging that node.
  const draggedNodeId = useSharedValue(-1);
  const nodeStartX = useSharedValue(0);
  const nodeStartY = useSharedValue(0);
  const pinchFocalCanvasX = useSharedValue(0);
  const pinchFocalCanvasY = useSharedValue(0);

  const resetCamera = useCallback(() => {
    const target = getFitCamera(canvasSize, width, height);
    scale.value = withTiming(target.scale);
    translateX.value = withTiming(target.translateX);
    translateY.value = withTiming(target.translateY);
    savedScale.value = target.scale;
    savedTranslateX.value = target.translateX;
    savedTranslateY.value = target.translateY;
  }, [canvasSize, width, height, scale, savedScale, translateX, savedTranslateX, translateY, savedTranslateY]);

  const advanceLevel = useCallback(() => {
    if (crossingsRef.current !== 0) return;
    const nextLevel = level + 1;
    const nextNodeCount = getDifficultyForLevel(nextLevel).nodeCount;
    const nextCanvasSize = getCanvasSize(nextNodeCount, viewportMax);
    const nextGraph = buildPuzzle(nextCanvasSize, nextLevel);
    const nextCamera = getFitCamera(nextCanvasSize, width, height);

    setLevel(nextLevel);
    setCanvasSize(nextCanvasSize);
    setGraph(nextGraph);
    graphRef.current = nextGraph;
    positions.value = nextGraph.nodes;
    const nextCrossings = countCrossings(nextGraph);
    setCrossings(nextCrossings);
    crossingsRef.current = nextCrossings;
    pulse.value = 0;

    scale.value = nextCamera.scale;
    savedScale.value = nextCamera.scale;
    translateX.value = nextCamera.translateX;
    savedTranslateX.value = nextCamera.translateX;
    translateY.value = nextCamera.translateY;
    savedTranslateY.value = nextCamera.translateY;
  }, [
    level,
    viewportMax,
    width,
    height,
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

  // A single gesture handles both node-dragging and camera-panning: it hit-
  // tests against every node in canvas space when the touch starts, so
  // there's no ambiguity between nested/sibling gesture recognizers.
  const dragOrPanGesture = Gesture.Pan()
    .maxPointers(1)
    .onStart((event) => {
      const canvasX = (event.absoluteX - translateX.value) / scale.value;
      const canvasY = (event.absoluteY - translateY.value) / scale.value;
      const hitRadius = HIT_RADIUS_SCREEN / scale.value;

      let closestId = -1;
      let closestDistSq = hitRadius * hitRadius;
      for (const node of positions.value) {
        const dx = node.x - canvasX;
        const dy = node.y - canvasY;
        const distSq = dx * dx + dy * dy;
        if (distSq <= closestDistSq) {
          closestDistSq = distSq;
          closestId = node.id;
        }
      }

      draggedNodeId.value = closestId;
      if (closestId !== -1) {
        const node = positions.value.find((p) => p.id === closestId)!;
        nodeStartX.value = node.x;
        nodeStartY.value = node.y;
      }
    })
    .onUpdate((event) => {
      if (draggedNodeId.value !== -1) {
        const id = draggedNodeId.value;
        const newX = nodeStartX.value + event.translationX / scale.value;
        const newY = nodeStartY.value + event.translationY / scale.value;
        positions.value = positions.value.map((p) => (p.id === id ? { id, x: newX, y: newY } : p));
        runOnJS(handleDrag)();
      } else {
        translateX.value = savedTranslateX.value + event.translationX;
        translateY.value = savedTranslateY.value + event.translationY;
      }
    })
    .onEnd(() => {
      if (draggedNodeId.value === -1) {
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      }
      draggedNodeId.value = -1;
    });

  const pinchGesture = Gesture.Pinch()
    .onStart((event) => {
      pinchFocalCanvasX.value = (event.focalX - translateX.value) / scale.value;
      pinchFocalCanvasY.value = (event.focalY - translateY.value) / scale.value;
    })
    .onUpdate((event) => {
      const nextScale = Math.min(Math.max(savedScale.value * event.scale, minScale), maxScale);
      scale.value = nextScale;
      translateX.value = event.focalX - pinchFocalCanvasX.value * nextScale;
      translateY.value = event.focalY - pinchFocalCanvasY.value * nextScale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const cameraGesture = Gesture.Simultaneous(dragOrPanGesture, pinchGesture);

  const canvasStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }],
  }));

  const solved = crossings === 0;

  return (
    <View style={styles.container}>
      <GestureDetector gesture={cameraGesture}>
        <Animated.View style={StyleSheet.absoluteFill}>
          <Animated.View
            style={[styles.canvas, { width: canvasSize, height: canvasSize }, canvasStyle]}
          >
            <Svg width={canvasSize} height={canvasSize} style={StyleSheet.absoluteFill}>
              {graph.edges.map((edge, i) => (
                <PuzzleEdge
                  key={i}
                  fromId={edge.a}
                  toId={edge.b}
                  positions={positions}
                  pulse={pulse}
                  cameraScale={scale}
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
                  cameraScale={scale}
                />
              ))}
            </Svg>
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      <View style={styles.overlay}>
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
  canvas: {
    position: 'absolute',
    left: 0,
    top: 0,
    transformOrigin: '0 0',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    pointerEvents: 'box-none',
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

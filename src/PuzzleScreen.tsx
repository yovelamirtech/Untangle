import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  makeMutable,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';

import { getDifficultyForLevel } from './difficulty';
import PuzzleEdge from './PuzzleEdge';
import PuzzleNode from './PuzzleNode';
import { countCrossings, generateSolvedGraph, Graph, scrambleGraphAtLeast } from './puzzle';

const NODE_RADIUS = 8;
const HIT_RADIUS_SCREEN = 50;
const ADVANCE_DELAY_MS = 1000;
const CANVAS_MARGIN = 60;
const FIT_PADDING = 0.92;
const DRAG_THROTTLE_UPDATES = 3;
const DRAG_BOUNDS_PADDING = 24;

const COLORS = {
  background: '#2B2140',
  rope: '#B8A9E8',
  ropeSolved: '#7FD9B9',
  node: '#F6A8B8',
  nodeSolved: '#7FD9B9',
  subtitle: '#E4DBFA',
  subtitleSolved: '#8FE9C9',
  overlayBg: 'rgba(0,0,0,0.35)',
  border: 'rgba(184,169,232,0.5)',
};

interface NodeValue {
  id: number;
  x: SharedValue<number>;
  y: SharedValue<number>;
}

/** The rope spreads over a canvas much larger than the screen — more so for longer ropes. */
function getCanvasSize(nodeCount: number, viewportMax: number): number {
  return viewportMax * (2.5 + nodeCount / 20);
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

  // Each node gets its own independent x/y shared values (plain numbers,
  // which Reanimated updates more cheaply than object-valued shared
  // values): moving one node (or zooming, which reads a separate
  // settledScale) only invalidates the handful of SVG elements that
  // actually depend on it, instead of every node/edge in the whole rope
  // re-evaluating on every frame.
  const nodeValues = useMemo<NodeValue[]>(
    () => graph.nodes.map((n) => ({ id: n.id, x: makeMutable(n.x), y: makeMutable(n.y) })),
    [graph]
  );
  const nodeValueById = useCallback((id: number) => nodeValues.find((n) => n.id === id)!, [nodeValues]);

  const pulse = useSharedValue(0);
  const crossingsRef = useRef(crossings);
  const graphRef = useRef(graph);

  const initialCamera = getFitCamera(canvasSize, width, height);
  const scale = useSharedValue(initialCamera.scale);
  const settledScale = useSharedValue(initialCamera.scale);
  const savedScale = useSharedValue(initialCamera.scale);
  const translateX = useSharedValue(initialCamera.translateX);
  const translateY = useSharedValue(initialCamera.translateY);
  const minScale = initialCamera.scale * 0.4;
  const maxScale = initialCamera.scale * 5;

  // -1 while panning the camera; a node id while dragging that node.
  const draggedNodeId = useSharedValue(-1);
  const lastX = useSharedValue(0);
  const lastY = useSharedValue(0);
  const dragUpdateCount = useSharedValue(0);
  const pinchFocalCanvasX = useSharedValue(0);
  const pinchFocalCanvasY = useSharedValue(0);

  const resetCamera = useCallback(() => {
    const target = getFitCamera(canvasSize, width, height);
    scale.value = withTiming(target.scale);
    translateX.value = withTiming(target.translateX);
    translateY.value = withTiming(target.translateY);
    savedScale.value = target.scale;
    settledScale.value = target.scale;
  }, [canvasSize, width, height, scale, savedScale, settledScale, translateX, translateY]);

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
    const nextCrossings = countCrossings(nextGraph);
    setCrossings(nextCrossings);
    crossingsRef.current = nextCrossings;
    pulse.value = 0;

    scale.value = nextCamera.scale;
    savedScale.value = nextCamera.scale;
    settledScale.value = nextCamera.scale;
    translateX.value = nextCamera.translateX;
    translateY.value = nextCamera.translateY;
  }, [level, viewportMax, width, height, pulse, scale, savedScale, settledScale, translateX, translateY]);

  const recomputeCrossings = useCallback(() => {
    const currentNodes = nodeValues.map((n) => ({ id: n.id, x: n.x.value, y: n.y.value }));
    const newCrossings = countCrossings({ nodes: currentNodes, edges: graphRef.current.edges });
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
  }, [advanceLevel, nodeValues, pulse]);

  // A single gesture handles both node-dragging and camera-panning: it hit-
  // tests against every node in canvas space when the touch starts, so
  // there's no ambiguity between nested/sibling gesture recognizers. It
  // tracks its own frame-to-frame screen delta (rather than relying on the
  // gesture's accumulated translation) so handing off between pinch and pan
  // as fingers lift doesn't cause a jump.
  const dragOrPanGesture = Gesture.Pan()
    .maxPointers(1)
    .onStart((event) => {
      lastX.value = event.absoluteX;
      lastY.value = event.absoluteY;
      dragUpdateCount.value = 0;

      const canvasX = (event.absoluteX - translateX.value) / scale.value;
      const canvasY = (event.absoluteY - translateY.value) / scale.value;
      const hitRadius = HIT_RADIUS_SCREEN / scale.value;

      let closestId = -1;
      let closestDistSq = hitRadius * hitRadius;
      for (const node of nodeValues) {
        const dx = node.x.value - canvasX;
        const dy = node.y.value - canvasY;
        const distSq = dx * dx + dy * dy;
        if (distSq <= closestDistSq) {
          closestDistSq = distSq;
          closestId = node.id;
        }
      }
      draggedNodeId.value = closestId;
    })
    .onUpdate((event) => {
      const dxScreen = event.absoluteX - lastX.value;
      const dyScreen = event.absoluteY - lastY.value;
      lastX.value = event.absoluteX;
      lastY.value = event.absoluteY;

      if (draggedNodeId.value !== -1) {
        const node = nodeValues.find((n) => n.id === draggedNodeId.value);
        if (node) {
          const rawX = node.x.value + dxScreen / scale.value;
          const rawY = node.y.value + dyScreen / scale.value;
          // Keep dragged nodes within the canvas — otherwise they can be
          // dragged past its edge and vanish (clipped by the SVG bounds).
          node.x.value = Math.min(Math.max(rawX, DRAG_BOUNDS_PADDING), canvasSize - DRAG_BOUNDS_PADDING);
          node.y.value = Math.min(Math.max(rawY, DRAG_BOUNDS_PADDING), canvasSize - DRAG_BOUNDS_PADDING);
        }
        dragUpdateCount.value += 1;
        if (dragUpdateCount.value % DRAG_THROTTLE_UPDATES === 0) {
          runOnJS(recomputeCrossings)();
        }
      } else {
        translateX.value += dxScreen;
        translateY.value += dyScreen;
      }
    })
    .onEnd(() => {
      if (draggedNodeId.value !== -1) {
        runOnJS(recomputeCrossings)();
      }
      draggedNodeId.value = -1;
    });

  const pinchGesture = Gesture.Pinch()
    .onStart((event) => {
      pinchFocalCanvasX.value = (event.focalX - translateX.value) / scale.value;
      pinchFocalCanvasY.value = (event.focalY - translateY.value) / scale.value;
    })
    .onUpdate((event) => {
      // The focal point can briefly become unreliable right as a finger
      // lifts (pointer count dropping from 2), which would otherwise show
      // up as the camera jumping toward whichever finger is left. Only
      // trust it while exactly 2 fingers are actually down.
      if (event.numberOfPointers !== 2) return;
      const nextScale = Math.min(Math.max(savedScale.value * event.scale, minScale), maxScale);
      scale.value = nextScale;
      translateX.value = event.focalX - pinchFocalCanvasX.value * nextScale;
      translateY.value = event.focalY - pinchFocalCanvasY.value * nextScale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      settledScale.value = scale.value;
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
              <Rect
                x={0}
                y={0}
                width={canvasSize}
                height={canvasSize}
                fill="none"
                stroke={COLORS.border}
                strokeWidth={3}
                vectorEffect="non-scaling-stroke"
              />
              {graph.edges.map((edge, i) => {
                const from = nodeValueById(edge.a);
                const to = nodeValueById(edge.b);
                return (
                  <PuzzleEdge
                    key={i}
                    fromX={from.x}
                    fromY={from.y}
                    toX={to.x}
                    toY={to.y}
                    pulse={pulse}
                    color={solved ? COLORS.ropeSolved : COLORS.rope}
                  />
                );
              })}
              {graph.nodes.map((node) => {
                const nv = nodeValueById(node.id);
                return (
                  <PuzzleNode
                    key={node.id}
                    radius={NODE_RADIUS}
                    fill={solved ? COLORS.nodeSolved : COLORS.node}
                    nodeX={nv.x}
                    nodeY={nv.y}
                    pulse={pulse}
                    settledScale={settledScale}
                  />
                );
              })}
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

import { Canvas, Group, Rect } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { makeMutable, runOnJS, SharedValue, useDerivedValue, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { getBadge, getBadgeNodeCount, getBadgeSolvedGraph } from './badges';
import { getSavedNodePositions, saveBadgeInProgress, saveBadgeSolved } from './badgeProgress';
import { getMinCrossingsForLevel } from './difficulty';
import PuzzleEdge from './PuzzleEdge';
import PuzzleNode from './PuzzleNode';
import { countCrossings, Graph, Node, scrambleBadgeGraph } from './puzzle';
import { clampTranslate, getCanvasSize, getFitCamera } from './puzzleLayout';
import { fireSolveHapticIfEnabled } from './SettingsScreen';

const NODE_RADIUS = 5;
const HIT_RADIUS_SCREEN = 32;
const ADVANCE_DELAY_MS = 1200;
const CANVAS_MARGIN = 60;
const DRAG_THROTTLE_UPDATES = 3;
const DRAG_BOUNDS_PADDING = 24;

const COLORS = {
  background: '#1B1530',
  border: 'rgba(228,219,250,0.25)',
  rope: 'rgba(228,219,250,0.55)',
  node: '#C2C6F5',
  ropeSolved: '#7FD9B9',
  nodeSolved: '#4FBFA0',
  subtitle: '#E4DBFA',
  subtitleSolved: '#7FD9B9',
  overlayBg: 'rgba(0,0,0,0.35)',
};

interface NodeValue {
  id: number;
  x: SharedValue<number>;
  y: SharedValue<number>;
}

function applySavedPositions(graph: Graph, saved: Node[] | undefined): Graph {
  if (!saved) return graph;
  const byId = new Map(saved.map((n) => [n.id, n]));
  return { edges: graph.edges, nodes: graph.nodes.map((n) => byId.get(n.id) ?? n) };
}

interface BadgePuzzleScreenProps {
  badgeId: string;
  onBack: () => void;
  onSolved: () => void;
}

export default function BadgePuzzleScreen({ badgeId, onBack, onSolved }: BadgePuzzleScreenProps) {
  const { width, height } = useWindowDimensions();
  const badge = getBadge(badgeId);
  const [initialGraph, setInitialGraph] = useState<Graph | null>(null);

  useEffect(() => {
    if (!badge || !width || !height) return;
    const viewportMax = Math.max(width, height);
    const nodeCount = getBadgeNodeCount(badge);
    const canvasSize = getCanvasSize(nodeCount, viewportMax);
    const { graph: solved, interiorIds } = getBadgeSolvedGraph(badge, canvasSize, CANVAS_MARGIN);
    const minCrossings = getMinCrossingsForLevel(nodeCount);
    const maxCrossings = minCrossings * 2;

    getSavedNodePositions(badgeId).then((saved) => {
      const graph = saved
        ? applySavedPositions(solved, saved)
        : scrambleBadgeGraph(solved, canvasSize, canvasSize, CANVAS_MARGIN, minCrossings, maxCrossings, interiorIds);
      setInitialGraph(graph);
    });
    // Only re-run if the badge or viewport actually changes — not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [badgeId, width, height]);

  if (!badge) return null;
  if (!width || !height || !initialGraph) return null;

  return (
    <BadgeGame
      badgeId={badgeId}
      badgeName={badge.name}
      width={width}
      height={height}
      initialGraph={initialGraph}
      onBack={onBack}
      onSolved={onSolved}
    />
  );
}

function BadgeGame({
  badgeId,
  badgeName,
  width,
  height,
  initialGraph,
  onBack,
  onSolved,
}: {
  badgeId: string;
  badgeName: string;
  width: number;
  height: number;
  initialGraph: Graph;
  onBack: () => void;
  onSolved: () => void;
}) {
  const viewportMax = Math.max(width, height);
  const canvasSize = useMemo(
    () => getCanvasSize(initialGraph.nodes.length, viewportMax),
    [viewportMax, initialGraph.nodes.length]
  );

  const [graph] = useState(initialGraph);
  const [crossings, setCrossings] = useState(() => countCrossings(graph));

  const nodeValues = useMemo<NodeValue[]>(
    () => graph.nodes.map((n) => ({ id: n.id, x: makeMutable(n.x), y: makeMutable(n.y) })),
    [graph]
  );
  const nodeValueById = useCallback((id: number) => nodeValues.find((n) => n.id === id)!, [nodeValues]);

  const pulse = useSharedValue(0);
  const crossingsRef = useRef(crossings);
  const solvedRef = useRef(crossings === 0);

  const initialCamera = getFitCamera(canvasSize, width, height);
  const scale = useSharedValue(initialCamera.scale);
  const savedScale = useSharedValue(initialCamera.scale);
  const translateX = useSharedValue(initialCamera.translateX);
  const translateY = useSharedValue(initialCamera.translateY);
  const minScale = initialCamera.scale * 0.4;
  const maxScale = initialCamera.scale * 5;

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
  }, [canvasSize, width, height, scale, savedScale, translateX, translateY]);

  const persistPositions = useCallback(() => {
    if (solvedRef.current) return;
    const positions = nodeValues.map((n) => ({ id: n.id, x: n.x.value, y: n.y.value }));
    saveBadgeInProgress(badgeId, positions);
  }, [badgeId, nodeValues]);

  const recomputeCrossings = useCallback(() => {
    const currentNodes = nodeValues.map((n) => ({ id: n.id, x: n.x.value, y: n.y.value }));
    const newCrossings = countCrossings({ nodes: currentNodes, edges: graph.edges });
    const wasSolved = crossingsRef.current === 0;
    crossingsRef.current = newCrossings;
    setCrossings(newCrossings);

    if (newCrossings === 0 && !wasSolved) {
      solvedRef.current = true;
      fireSolveHapticIfEnabled();
      saveBadgeSolved(badgeId);
      pulse.value = withSequence(
        withTiming(1, { duration: 200 }),
        withTiming(0.3, { duration: 250 }),
        withTiming(1, { duration: 200 }),
        withTiming(0, { duration: 250 })
      );
      setTimeout(onSolved, ADVANCE_DELAY_MS);
    } else {
      persistPositions();
    }
  }, [badgeId, graph.edges, nodeValues, onSolved, persistPositions, pulse]);

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
          node.x.value = Math.min(Math.max(rawX, DRAG_BOUNDS_PADDING), canvasSize - DRAG_BOUNDS_PADDING);
          node.y.value = Math.min(Math.max(rawY, DRAG_BOUNDS_PADDING), canvasSize - DRAG_BOUNDS_PADDING);
        }
        dragUpdateCount.value += 1;
        if (dragUpdateCount.value % DRAG_THROTTLE_UPDATES === 0) {
          runOnJS(recomputeCrossings)();
        }
      } else {
        translateX.value = clampTranslate(translateX.value + dxScreen, scale.value, canvasSize, width);
        translateY.value = clampTranslate(translateY.value + dyScreen, scale.value, canvasSize, height);
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
      if (event.numberOfPointers !== 2) return;
      const nextScale = Math.min(Math.max(savedScale.value * event.scale, minScale), maxScale);
      scale.value = nextScale;
      translateX.value = clampTranslate(
        event.focalX - pinchFocalCanvasX.value * nextScale,
        nextScale,
        canvasSize,
        width
      );
      translateY.value = clampTranslate(
        event.focalY - pinchFocalCanvasY.value * nextScale,
        nextScale,
        canvasSize,
        height
      );
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const cameraGesture = Gesture.Simultaneous(dragOrPanGesture, pinchGesture);

  const groupTransform = useDerivedValue(
    () => [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }],
    [translateX, translateY, scale]
  );

  const lineWidth = useDerivedValue(() => Math.min(Math.max(2, 1.6 / scale.value), 10), [scale]);

  const solved = crossings === 0;

  return (
    <View style={styles.container}>
      <GestureDetector gesture={cameraGesture}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Group transform={groupTransform}>
            <Rect x={0} y={0} width={canvasSize} height={canvasSize} color={COLORS.border} style="stroke" strokeWidth={3} />
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
                  lineWidth={lineWidth}
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
                  scale={scale}
                />
              );
            })}
          </Group>
        </Canvas>
      </GestureDetector>

      <View style={styles.overlay}>
        <View style={styles.leftGroup}>
          <Pressable style={styles.pillButton} onPress={onBack} hitSlop={12}>
            <Text style={styles.pillButtonText}>{'‹'} Back</Text>
          </Pressable>
          <Text style={[styles.subtitle, solved && styles.subtitleSolved]}>
            {solved ? `${badgeName} — Solved!` : `${badgeName} · ${crossings} crossing${crossings === 1 ? '' : 's'}`}
          </Text>
        </View>
        <Pressable style={styles.pillButton} onPress={resetCamera}>
          <Text style={styles.pillButtonText}>Fit</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: COLORS.background,
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
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  pillButton: {
    backgroundColor: COLORS.overlayBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  pillButtonText: {
    color: COLORS.subtitle,
    fontSize: 13,
    fontWeight: '600',
  },
  subtitle: {
    color: COLORS.subtitle,
    fontSize: 13,
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
});

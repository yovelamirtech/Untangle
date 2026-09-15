import { Ionicons } from '@expo/vector-icons';
import { Canvas, Group, Rect } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  makeMutable,
  runOnJS,
  SharedValue,
  useDerivedValue,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { showInterstitialIfReady } from './ads';
import { getDifficultyForLevel, getMinCrossingsForLevel } from './difficulty';
import { getPaletteForLevel } from './palette';
import PuzzleEdge from './PuzzleEdge';
import PuzzleNode from './PuzzleNode';
import { countCrossings, generateSolvedGraph, Graph, scrambleGraphAtLeast } from './puzzle';
import { fireSolveHapticIfEnabled } from './SettingsScreen';
import { getZoneIndexForLevel, LEVELS_PER_ZONE, ZONES } from './zones';

/** Quick-jump targets for the level picker: level 1 plus both sides of every zone boundary. */
const QUICK_LEVELS = ZONES.flatMap((_, i) => {
  if (i === 0) return [1];
  const boundary = i * LEVELS_PER_ZONE + 1;
  return [boundary - 1, boundary];
});

const NODE_RADIUS = 8;
const HIT_RADIUS_SCREEN = 38;
const ADVANCE_DELAY_MS = 1000;
const CANVAS_MARGIN = 60;
const FIT_PADDING = 0.92;
const DRAG_THROTTLE_UPDATES = 3;
const DRAG_BOUNDS_PADDING = 24;

const COLORS = {
  ropeSolved: '#7FD9B9',
  nodeSolved: '#4FBFA0',
  subtitle: '#3A2E4D',
  subtitleSolved: '#1F5C4A',
  overlayBg: 'rgba(255,255,255,0.55)',
};

interface NodeValue {
  id: number;
  x: SharedValue<number>;
  y: SharedValue<number>;
}

/** The rope spreads over a canvas a bit larger than the screen — more so for longer ropes. */
function getCanvasSize(nodeCount: number, viewportMax: number): number {
  return viewportMax * (1.1 + nodeCount / 50);
}

/** Clamps a pan/zoom translate so the canvas can never be dragged past its own edge. */
function clampTranslate(value: number, scale: number, canvasSize: number, viewportLength: number) {
  'worklet';
  const contentLength = canvasSize * scale;
  if (contentLength <= viewportLength) {
    return (viewportLength - contentLength) / 2;
  }
  const min = viewportLength - contentLength;
  return Math.min(Math.max(value, min), 0);
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
  const minCrossings = getMinCrossingsForLevel(nodeCount);
  return scrambleGraphAtLeast(solved, canvasSize, canvasSize, CANVAS_MARGIN, minCrossings, 20);
}

interface PuzzleScreenProps {
  initialLevel: number;
  onLevelChange: (level: number) => void;
  onOpenJourney: () => void;
  onOpenSettings: () => void;
}

export default function PuzzleScreen({ initialLevel, onLevelChange, onOpenJourney, onOpenSettings }: PuzzleScreenProps) {
  const { width, height } = useWindowDimensions();
  // On web, useWindowDimensions can report 0 on the very first render before
  // layout is measured. Since canvas size/graph are seeded once via a
  // useState initializer, mounting the game before real dimensions arrive
  // would freeze it at a size of 0 forever.
  if (!width || !height) return null;
  return (
    <PuzzleGame
      width={width}
      height={height}
      initialLevel={initialLevel}
      onLevelChange={onLevelChange}
      onOpenJourney={onOpenJourney}
      onOpenSettings={onOpenSettings}
    />
  );
}

function PuzzleGame({
  width,
  height,
  initialLevel,
  onLevelChange,
  onOpenJourney,
  onOpenSettings,
}: { width: number; height: number } & PuzzleScreenProps) {
  const viewportMax = Math.max(width, height);

  const [level, setLevel] = useState(initialLevel);
  const [canvasSize, setCanvasSize] = useState(() =>
    getCanvasSize(getDifficultyForLevel(initialLevel).nodeCount, viewportMax)
  );
  const [graph, setGraph] = useState<Graph>(() => buildPuzzle(canvasSize, initialLevel));
  const [crossings, setCrossings] = useState(() => countCrossings(graph));
  const [levelPickerVisible, setLevelPickerVisible] = useState(false);
  const [levelInput, setLevelInput] = useState('');

  useEffect(() => {
    onLevelChange(level);
  }, [level, onLevelChange]);

  // Each node gets its own independent x/y shared value, read directly by
  // its Skia Circle/Line — Skia batches the whole scene into one GPU draw
  // call, so this stays cheap regardless of how many nodes are on screen.
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
  }, [canvasSize, width, height, scale, savedScale, translateX, translateY]);

  const goToLevel = useCallback(
    (targetLevel: number) => {
      const nextLevel = Math.max(1, Math.floor(targetLevel));
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
      translateX.value = nextCamera.translateX;
      translateY.value = nextCamera.translateY;

      // Only between levels, never mid-drag — and only at a zone boundary,
      // not on every level.
      if (getZoneIndexForLevel(nextLevel) !== getZoneIndexForLevel(level)) {
        showInterstitialIfReady();
      }
    },
    [level, viewportMax, width, height, pulse, scale, savedScale, translateX, translateY]
  );

  const advanceLevel = useCallback(() => {
    if (crossingsRef.current !== 0) return;
    goToLevel(level + 1);
  }, [level, goToLevel]);

  const recomputeCrossings = useCallback(() => {
    const currentNodes = nodeValues.map((n) => ({ id: n.id, x: n.x.value, y: n.y.value }));
    const newCrossings = countCrossings({ nodes: currentNodes, edges: graphRef.current.edges });
    const wasSolved = crossingsRef.current === 0;
    crossingsRef.current = newCrossings;
    setCrossings(newCrossings);

    if (newCrossings === 0 && !wasSolved) {
      fireSolveHapticIfEnabled();
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
      // The focal point can briefly become unreliable right as a finger
      // lifts (pointer count dropping from 2), which would otherwise show
      // up as the camera jumping toward whichever finger is left. Only
      // trust it while exactly 2 fingers are actually down.
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

  // A single shared derived value for line thickness, reused by every edge:
  // stays a constant on-screen width regardless of zoom (computed live,
  // every frame — cheap under Skia since the whole scene is one draw call).
  const lineWidth = useDerivedValue(
    () => Math.min(Math.max(3, 2.2 / scale.value), 15),
    [scale]
  );

  const solved = crossings === 0;
  const palette = getPaletteForLevel(level);

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <GestureDetector gesture={cameraGesture}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Group transform={groupTransform}>
            <Rect
              x={0}
              y={0}
              width={canvasSize}
              height={canvasSize}
              color={palette.border}
              style="stroke"
              strokeWidth={3}
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
                  lineWidth={lineWidth}
                  color={solved ? COLORS.ropeSolved : palette.rope}
                />
              );
            })}
            {graph.nodes.map((node) => {
              const nv = nodeValueById(node.id);
              return (
                <PuzzleNode
                  key={node.id}
                  radius={NODE_RADIUS}
                  fill={solved ? COLORS.nodeSolved : palette.node}
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
          <Pressable style={styles.settingsButton} onPress={onOpenSettings} hitSlop={12}>
            <Ionicons name="settings-outline" size={20} color={COLORS.subtitle} />
          </Pressable>
          <Text style={[styles.subtitle, solved && styles.subtitleSolved]}>
            {solved ? 'Solved!' : `${crossings} crossing${crossings === 1 ? '' : 's'}`}
          </Text>
        </View>
        <View style={styles.buttonRow}>
          <Pressable style={styles.fitButton} onPress={onOpenJourney}>
            <Text style={styles.fitButtonText}>Journey</Text>
          </Pressable>
          <Pressable style={styles.fitButton} onPress={resetCamera}>
            <Text style={styles.fitButtonText}>Fit</Text>
          </Pressable>
          <Pressable
            style={styles.fitButton}
            onPress={() => {
              setLevelInput(String(level));
              setLevelPickerVisible(true);
            }}
          >
            <Text style={styles.fitButtonText}>Lvl {level}</Text>
          </Pressable>
        </View>
      </View>

      <Modal
          visible={levelPickerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setLevelPickerVisible(false)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setLevelPickerVisible(false)}>
            <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>Jump to level</Text>
              <TextInput
                style={styles.modalInput}
                value={levelInput}
                onChangeText={setLevelInput}
                keyboardType="number-pad"
                autoFocus
                selectTextOnFocus
                onSubmitEditing={() => {
                  const n = parseInt(levelInput, 10);
                  if (!Number.isNaN(n) && n >= 1) goToLevel(n);
                  setLevelPickerVisible(false);
                }}
              />
              <View style={styles.quickRow}>
                {QUICK_LEVELS.map((lvl) => (
                  <Pressable
                    key={lvl}
                    style={styles.quickButton}
                    onPress={() => {
                      goToLevel(lvl);
                      setLevelPickerVisible(false);
                    }}
                  >
                    <Text style={styles.quickButtonText}>{lvl}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                style={styles.modalGoButton}
                onPress={() => {
                  const n = parseInt(levelInput, 10);
                  if (!Number.isNaN(n) && n >= 1) goToLevel(n);
                  setLevelPickerVisible(false);
                }}
              >
                <Text style={styles.modalGoButtonText}>Go</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
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
  },
  settingsButton: {
    backgroundColor: COLORS.overlayBg,
    padding: 6,
    borderRadius: 12,
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
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    width: 280,
    backgroundColor: '#241B38',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    color: '#E4DBFA',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalInput: {
    backgroundColor: 'rgba(228,219,250,0.12)',
    color: '#E4DBFA',
    fontSize: 18,
    fontWeight: '600',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  quickButton: {
    backgroundColor: 'rgba(228,219,250,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  quickButtonText: {
    color: '#E4DBFA',
    fontSize: 13,
    fontWeight: '600',
  },
  modalGoButton: {
    backgroundColor: '#F6A8B8',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalGoButtonText: {
    color: '#241B38',
    fontSize: 15,
    fontWeight: '700',
  },
});

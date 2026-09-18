import { Ionicons } from '@expo/vector-icons';
import { Canvas, Circle, Group, Rect } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  makeMutable,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { getBadge, getBadgeNodeCount, getBadgeSolvedGraph } from './badges';
import { getSavedNodePositions, saveBadgeInProgress, saveBadgeSolved } from './badgeProgress';
import { getMinCrossingsForLevel } from './difficulty';
import PuzzleEdge from './PuzzleEdge';
import PuzzleNode from './PuzzleNode';
import { ENDPOINT_ACCENT } from './palette';
import { countCrossings, getEndpointIds, Graph, Node, scrambleBadgeGraph } from './puzzle';
import { BADGE_ZOOM_TIGHTNESS, clampTranslate, getBadgeCanvasSize, getFitCamera, getInitialFocusSize } from './puzzleLayout';
import { fireSolveHapticIfEnabled } from './SettingsScreen';

const NODE_RADIUS = 5;
const HIT_RADIUS_SCREEN = 32;
// Longer than a normal level's — there's a bigger celebration to enjoy
// (confetti burst + banner) before returning to the collection screen.
const ADVANCE_DELAY_MS = 2000;
const DRAG_THROTTLE_UPDATES = 3;
const DRAG_BOUNDS_PADDING = 24;
const CONFETTI_COUNT = 28;
const CONFETTI_COLORS = ['#F6A8B8', '#7FD9B9', '#E4DBFA'];

const COLORS = {
  background: '#1B1530',
  border: 'rgba(228,219,250,0.25)',
  rope: 'rgba(228,219,250,0.55)',
  node: '#C2C6F5',
  // The rope's two loose ends (or each disconnected piece's, for a badge
  // vectorized as several separate lines) — same fixed bright accent as a
  // normal level's endpoints (see palette.ts), so it reads consistently
  // across the whole game.
  endpoint: ENDPOINT_ACCENT,
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

interface ConfettiSpec {
  angle: number;
  distance: number;
  color: string;
}

/** One confetti dot in a solve celebration's burst: flies outward from the
 * screen's center along its own fixed angle/distance as `burst` runs 0->1,
 * arcing up a little and fading out near the end. Screen-space (not inside
 * the pan/zoom Group), so it always bursts from the middle of the view
 * regardless of where the camera happens to be. */
function ConfettiDot({
  spec,
  burst,
  centerX,
  centerY,
}: {
  spec: ConfettiSpec;
  burst: SharedValue<number>;
  centerX: number;
  centerY: number;
}) {
  const cx = useDerivedValue(
    () => centerX + Math.cos(spec.angle) * spec.distance * burst.value,
    [burst]
  );
  const cy = useDerivedValue(
    () => centerY + Math.sin(spec.angle) * spec.distance * burst.value - 70 * burst.value * (1 - burst.value),
    [burst]
  );
  const r = useDerivedValue(() => 4.5 * (1 - burst.value * 0.3), [burst]);
  const opacity = useDerivedValue(() => 1 - Math.max(0, burst.value - 0.55) / 0.45, [burst]);

  return <Circle cx={cx} cy={cy} r={r} color={spec.color} opacity={opacity} />;
}

/** The badge-solve celebration: a confetti burst (Skia, screen-space) plus a
 * bouncing "badge earned" banner — a lot more festive than a normal level's
 * quick pulse, since earning a badge is meant to feel like a bigger deal. */
function SolveCelebration({
  badgeName,
  width,
  height,
  burst,
}: {
  badgeName: string;
  width: number;
  height: number;
  burst: SharedValue<number>;
}) {
  const specs = useMemo<ConfettiSpec[]>(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => {
        const angle = (i / CONFETTI_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
        const distance = Math.min(width, height) * (0.28 + Math.random() * 0.22);
        return { angle, distance, color: CONFETTI_COLORS[i % CONFETTI_COLORS.length] };
      }),
    // Generated once when the celebration first mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const bannerStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, burst.value * 2.5),
    transform: [{ scale: 0.6 + Math.min(1, burst.value * 2) * 0.4 }],
  }));

  return (
    <>
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        {specs.map((spec, i) => (
          <ConfettiDot key={i} spec={spec} burst={burst} centerX={width / 2} centerY={height / 2} />
        ))}
      </Canvas>
      <View style={styles.celebrationBannerWrap} pointerEvents="none">
        <Animated.View style={[styles.celebrationBanner, bannerStyle]}>
          <Text style={styles.celebrationBannerText}>🏅 {badgeName} earned!</Text>
        </Animated.View>
      </View>
    </>
  );
}

/** A saved position's node id is only meaningful for the exact graph
 * shape it was saved from — if a badge's node count ever changes (a data
 * fix, a re-vectorization), old ids no longer line up with the same
 * physical points, and overlaying them would scatter the wrong (id, x, y)
 * pairs onto the new graph instead of leaving something recognizable.
 * Discarding a mismatched save falls back to a fresh scramble, same as
 * having no save at all. */
function applySavedPositions(graph: Graph, saved: Node[] | undefined): Graph {
  if (!saved || saved.length !== graph.nodes.length) return graph;
  const byId = new Map(saved.map((n) => [n.id, n]));
  const nodes = graph.nodes.map((n) => byId.get(n.id) ?? n);
  if (nodes.some((n) => !byId.has(n.id))) return graph;
  return { edges: graph.edges, nodes };
}

interface BadgePuzzleScreenProps {
  badgeId: string;
  onExitToMenu: () => void;
  onOpenSettings: () => void;
  onSolved: () => void;
}

export default function BadgePuzzleScreen({ badgeId, onExitToMenu, onOpenSettings, onSolved }: BadgePuzzleScreenProps) {
  const { width, height } = useWindowDimensions();
  const badge = getBadge(badgeId);
  // canvasSize is stored alongside the graph (not recomputed later from
  // initialGraph.nodes.length) because it wouldn't be the same number:
  // singleLineify (inside getBadgeSolvedGraph) can duplicate a node at
  // every junction its Euler-trail walk revisits, so the *linearized*
  // graph can have more nodes than getBadgeNodeCount(badge) did when this
  // canvasSize was chosen. Recomputing canvasSize downstream from the
  // linearized count used to give a bigger canvas than the one the shape
  // was actually laid out on, so the camera centered on the wrong point
  // and the badge could open off-screen instead of centered.
  const [built, setBuilt] = useState<{ graph: Graph; canvasSize: number } | null>(null);

  useEffect(() => {
    if (!badge || !width || !height) return;
    const viewportMax = Math.max(width, height);
    const nodeCount = getBadgeNodeCount(badge);
    const canvasSize = getBadgeCanvasSize(nodeCount, viewportMax);
    const focusSize = getInitialFocusSize(canvasSize, width, height, BADGE_ZOOM_TIGHTNESS);
    const margin = (canvasSize - focusSize) / 2;
    const { graph: solved, interiorIds } = getBadgeSolvedGraph(badge, canvasSize, margin);
    const minCrossings = getMinCrossingsForLevel(nodeCount);
    const maxCrossings = minCrossings * 2;

    getSavedNodePositions(badgeId).then((saved) => {
      const graph = saved
        ? applySavedPositions(solved, saved)
        : scrambleBadgeGraph(solved, canvasSize, canvasSize, margin, minCrossings, maxCrossings, interiorIds);
      setBuilt({ graph, canvasSize });
    });
    // Only re-run if the badge or viewport actually changes — not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [badgeId, width, height]);

  if (!badge) return null;
  if (!width || !height || !built) return null;

  return (
    <BadgeGame
      badgeId={badgeId}
      badgeName={badge.name}
      width={width}
      height={height}
      initialGraph={built.graph}
      canvasSize={built.canvasSize}
      onExitToMenu={onExitToMenu}
      onOpenSettings={onOpenSettings}
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
  canvasSize,
  onExitToMenu,
  onOpenSettings,
  onSolved,
}: {
  badgeId: string;
  badgeName: string;
  width: number;
  height: number;
  initialGraph: Graph;
  canvasSize: number;
  onExitToMenu: () => void;
  onOpenSettings: () => void;
  onSolved: () => void;
}) {
  // The camera fits to the drawing's own footprint (canvas minus margin),
  // not the whole huge canvas — otherwise the badge would open as a speck
  // in the middle of a mostly-empty screen instead of "starting in the
  // middle" already zoomed in on it. focusSize is picked (per the actual
  // screen aspect ratio) so the canvas' own border stays off-screen at
  // this zoom, with extra tightness so Badge Challenge's board edges feel
  // further away than a normal level's.
  const focusSize = getInitialFocusSize(canvasSize, width, height, BADGE_ZOOM_TIGHTNESS);

  const [graph] = useState(initialGraph);
  const [crossings, setCrossings] = useState(() => countCrossings(graph));
  const endpointIds = useMemo(() => getEndpointIds(graph), [graph]);

  const nodeValues = useMemo<NodeValue[]>(
    () => graph.nodes.map((n) => ({ id: n.id, x: makeMutable(n.x), y: makeMutable(n.y) })),
    [graph]
  );
  const nodeValueById = useCallback((id: number) => nodeValues.find((n) => n.id === id)!, [nodeValues]);

  const pulse = useSharedValue(0);
  const burst = useSharedValue(0);
  const [celebrating, setCelebrating] = useState(false);
  const crossingsRef = useRef(crossings);
  const solvedRef = useRef(crossings === 0);

  const initialCamera = getFitCamera(canvasSize, width, height, focusSize);
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
    const target = getFitCamera(canvasSize, width, height, focusSize);
    scale.value = withTiming(target.scale);
    translateX.value = withTiming(target.translateX);
    translateY.value = withTiming(target.translateY);
    savedScale.value = target.scale;
  }, [canvasSize, focusSize, width, height, scale, savedScale, translateX, translateY]);

  const persistPositions = useCallback(() => {
    if (solvedRef.current) return;
    const positions = nodeValues.map((n) => ({ id: n.id, x: n.x.value, y: n.y.value }));
    saveBadgeInProgress(badgeId, positions);
  }, [badgeId, nodeValues]);

  // Shared by an actual solve and the dev-only "force solve" button below.
  const celebrateSolve = useCallback(() => {
    solvedRef.current = true;
    fireSolveHapticIfEnabled();
    saveBadgeSolved(badgeId);
    setCelebrating(true);
    pulse.value = withSequence(
      withTiming(1, { duration: 200 }),
      withTiming(0.3, { duration: 250 }),
      withTiming(1, { duration: 200 }),
      withTiming(0, { duration: 250 })
    );
    burst.value = withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) });
    setTimeout(onSolved, ADVANCE_DELAY_MS);
  }, [badgeId, burst, onSolved, pulse]);

  const recomputeCrossings = useCallback(() => {
    const currentNodes = nodeValues.map((n) => ({ id: n.id, x: n.x.value, y: n.y.value }));
    const newCrossings = countCrossings({ nodes: currentNodes, edges: graph.edges });
    const wasSolved = crossingsRef.current === 0;
    crossingsRef.current = newCrossings;
    setCrossings(newCrossings);

    if (newCrossings === 0 && !wasSolved) {
      celebrateSolve();
    } else {
      persistPositions();
    }
  }, [celebrateSolve, nodeValues, graph.edges, persistPositions]);

  // Dev-only: triggers the exact same solve feedback/persistence path as an
  // actual solve, without needing to untangle the (possibly huge) puzzle by
  // hand first — for checking the solve animation/haptic/save-and-return
  // flow while testing. Never shown in a production build (see the __DEV__
  // guard around its button below).
  const forceSolve = useCallback(() => {
    if (solvedRef.current) return;
    crossingsRef.current = 0;
    setCrossings(0);
    celebrateSolve();
  }, [celebrateSolve]);

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
                  fill={solved ? COLORS.nodeSolved : endpointIds.has(node.id) ? COLORS.endpoint : COLORS.node}
                  nodeX={nv.x}
                  nodeY={nv.y}
                  pulse={pulse}
                  scale={scale}
                  // Only the (few) endpoint nodes get the shadow here — a
                  // badge can have hundreds of regular nodes, where the
                  // extra per-node image filter isn't worth the draw cost.
                  withShadow={!solved && endpointIds.has(node.id)}
                />
              );
            })}
          </Group>
        </Canvas>
      </GestureDetector>

      {celebrating && <SolveCelebration badgeName={badgeName} width={width} height={height} burst={burst} />}

      <View style={styles.overlay}>
        <View style={styles.leftGroup}>
          <Pressable style={styles.pillButton} onPress={onExitToMenu} hitSlop={12}>
            <Ionicons name="home-outline" size={18} color={COLORS.subtitle} />
          </Pressable>
          <Pressable style={styles.pillButton} onPress={onOpenSettings} hitSlop={12}>
            <Ionicons name="settings-outline" size={18} color={COLORS.subtitle} />
          </Pressable>
          <Text style={[styles.subtitle, solved && styles.subtitleSolved]}>
            {solved ? `${badgeName} — Solved!` : `${badgeName} · ${crossings} crossing${crossings === 1 ? '' : 's'}`}
          </Text>
        </View>
        <View style={styles.rightGroup}>
          {/* DEV-ONLY: skips straight to the solve flow, see celebrateSolve/forceSolve above. Strip before release. */}
          {__DEV__ && !solved && (
            <Pressable style={styles.pillButton} onPress={forceSolve}>
              <Text style={styles.pillButtonText}>Test: Solve</Text>
            </Pressable>
          )}
          <Pressable style={styles.pillButton} onPress={resetCamera}>
            <Text style={styles.pillButtonText}>Fit</Text>
          </Pressable>
        </View>
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
  celebrationBannerWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebrationBanner: {
    backgroundColor: '#241B38',
    borderWidth: 1,
    borderColor: 'rgba(228,219,250,0.3)',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 18,
  },
  celebrationBannerText: {
    color: '#E4DBFA',
    fontSize: 20,
    fontWeight: '800',
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
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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

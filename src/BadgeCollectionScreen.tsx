import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line } from 'react-native-svg';

import { Badge, BADGES, getBadgeSolvedGraph } from './badges';
import { BadgeProgress, BadgeStatus, getBadgeStatus, loadBadgeProgress, resetBadgeProgress } from './badgeProgress';

const COLORS = {
  screenBg: '#1B1530',
  text: '#E4DBFA',
  textDim: 'rgba(228,219,250,0.4)',
  iconButtonBg: 'rgba(0,0,0,0.35)',
  devButtonBg: 'rgba(232,104,138,0.25)',
  devButtonText: '#F6A8B8',
  cardBg: 'rgba(228,219,250,0.08)',
  cardBgDisabled: 'rgba(228,219,250,0.03)',
  cardBgSolved: 'rgba(127,217,185,0.14)',
  cardBorder: 'rgba(228,219,250,0.15)',
  cardBorderSolved: 'rgba(127,217,185,0.6)',
  solved: '#7FD9B9',
  inProgress: '#F6A8B8',
  thumbnailLine: 'rgba(228,219,250,0.85)',
  thumbnailLineSolved: '#7FD9B9',
  thumbnailGlow: 'rgba(127,217,185,0.25)',
};

interface BadgeCollectionScreenProps {
  onExitToMenu: () => void;
  onOpenSettings: () => void;
  onSelectBadge: (badgeId: string) => void;
  /** The badge that was just solved, so its card can play a one-time
   * "hint -> earned" reveal the next time this screen is shown. */
  justSolvedBadgeId?: string | null;
  /** Called once the reveal has started, so the caller can clear
   * justSolvedBadgeId and not replay it on a later visit. */
  onJustSolvedShown?: () => void;
}

function statusLabel(status: BadgeStatus): string | null {
  if (status === 'solved') return 'Earned';
  if (status === 'in-progress') return 'In progress';
  return null;
}

const THUMBNAIL_SIZE = 84;
const THUMBNAIL_MARGIN = 6;

/** The badge's own solved shape, small and static — what you're trying to
 * untangle it into isn't a secret, so show it up front rather than making
 * the player guess from a hint alone. `solved` swaps it from a plain hint
 * sketch to a brighter, thicker "earned" rendering with a soft glow. */
function BadgeThumbnail({ badge, solved }: { badge: Badge; solved: boolean }) {
  const graph = useMemo(() => getBadgeSolvedGraph(badge, THUMBNAIL_SIZE, THUMBNAIL_MARGIN).graph, [badge]);
  const nodeById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);
  const center = THUMBNAIL_SIZE / 2;

  return (
    <Svg width={THUMBNAIL_SIZE} height={THUMBNAIL_SIZE} viewBox={`0 0 ${THUMBNAIL_SIZE} ${THUMBNAIL_SIZE}`}>
      {solved && <Circle cx={center} cy={center} r={THUMBNAIL_SIZE / 2 - 2} fill={COLORS.thumbnailGlow} />}
      {graph.edges.map((edge, i) => {
        const from = nodeById.get(edge.a)!;
        const to = nodeById.get(edge.b)!;
        return (
          <Line
            key={i}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={solved ? COLORS.thumbnailLineSolved : COLORS.thumbnailLine}
            strokeWidth={solved ? 2 : 1.2}
            strokeLinecap="round"
          />
        );
      })}
    </Svg>
  );
}

function BadgeCard({
  badge,
  status,
  justSolved,
  onPress,
}: {
  badge: Badge;
  status: BadgeStatus;
  justSolved: boolean;
  onPress: () => void;
}) {
  const playable = badge.contour.length > 0 || badge.graph !== undefined;
  const label = statusLabel(status);
  const solved = status === 'solved';

  // 0 = the plain "hint" look, 1 = the styled "earned" look. Starts at 0
  // and animates up only the first time this card is shown right after
  // being solved (justSolved) — every other render just sits at its
  // resting value with no animation.
  const reveal = useSharedValue(justSolved ? 0 : solved ? 1 : 0);
  const pop = useSharedValue(1);

  useEffect(() => {
    if (!justSolved) return;
    reveal.value = withDelay(150, withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }));
    pop.value = withDelay(
      150,
      withSequence(
        withTiming(1.12, { duration: 240, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 260, easing: Easing.out(Easing.back(1.5)) })
      )
    );
    // Runs once, on mount, for whichever card was just solved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keeps the card in sync with status changes other than the one-time
  // justSolved reveal above — notably the dev-only reset button, which can
  // flip a card straight back from solved to not-started while it's still
  // mounted (no need to animate that one, just snap to the plain look).
  useEffect(() => {
    if (justSolved) return;
    reveal.value = solved ? 1 : 0;
  }, [solved, justSolved, reveal]);

  const cardStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(reveal.value, [0, 1], [COLORS.cardBg, COLORS.cardBgSolved]),
    borderColor: interpolateColor(reveal.value, [0, 1], [COLORS.cardBorder, COLORS.cardBorderSolved]),
    transform: [{ scale: pop.value }],
  }));
  const hintLayerStyle = useAnimatedStyle(() => ({ opacity: 1 - reveal.value }));
  const earnedLayerStyle = useAnimatedStyle(() => ({ opacity: reveal.value }));
  const ribbonStyle = useAnimatedStyle(() => ({ opacity: reveal.value }));

  return (
    <Pressable onPress={playable ? onPress : undefined} disabled={!playable} style={styles.cardTouchable}>
      <Animated.View style={[styles.card, !playable && styles.cardDisabled, playable && cardStyle]}>
        {solved && (
          <Animated.View style={[styles.ribbon, ribbonStyle]}>
            <Ionicons name="ribbon" size={16} color={COLORS.solved} />
          </Animated.View>
        )}
        {playable && (
          <View style={styles.thumbnailStack}>
            <Animated.View style={[styles.thumbnailLayer, hintLayerStyle]}>
              <BadgeThumbnail badge={badge} solved={false} />
            </Animated.View>
            <Animated.View style={[styles.thumbnailLayer, earnedLayerStyle]}>
              <BadgeThumbnail badge={badge} solved={true} />
            </Animated.View>
          </View>
        )}
        <Text style={styles.cardTitle}>{badge.name}</Text>
        <Text style={[styles.cardHint, !playable && styles.cardHintDisabled]}>
          {playable ? badge.hint : 'Coming soon'}
        </Text>
        {label && (
          <Text style={[styles.cardStatus, status === 'solved' ? styles.solvedText : styles.inProgressText]}>
            {label}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

export default function BadgeCollectionScreen({
  onExitToMenu,
  onOpenSettings,
  onSelectBadge,
  justSolvedBadgeId,
  onJustSolvedShown,
}: BadgeCollectionScreenProps) {
  const [progress, setProgress] = useState<BadgeProgress>({});

  useEffect(() => {
    loadBadgeProgress().then(setProgress);
  }, []);

  // Consumed once on mount so a later visit to this screen (without a fresh
  // solve) never replays the reveal animation.
  useEffect(() => {
    if (justSolvedBadgeId) onJustSolvedShown?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dev-only: resets badge progress and refreshes this screen in place —
  // see the __DEV__ guard around its button below. Strip alongside that
  // button before release.
  const handleDevReset = () => {
    resetBadgeProgress().then(() => setProgress({}));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerGroup}>
          <Pressable style={styles.iconButton} onPress={onExitToMenu} hitSlop={12}>
            <Ionicons name="home-outline" size={20} color={COLORS.text} />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={onOpenSettings} hitSlop={12}>
            <Ionicons name="settings-outline" size={20} color={COLORS.text} />
          </Pressable>
          <Text style={styles.title}>Badge Challenge</Text>
        </View>
        {__DEV__ && (
          <Pressable style={styles.devButton} onPress={handleDevReset}>
            <Text style={styles.devButtonText}>Reset</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.grid}>
        {BADGES.map((badge) => (
          <BadgeCard
            key={badge.id}
            badge={badge}
            status={getBadgeStatus(progress, badge.id)}
            justSolved={badge.id === justSolvedBadgeId}
            onPress={() => onSelectBadge(badge.id)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.screenBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    backgroundColor: COLORS.iconButtonBg,
    padding: 8,
    borderRadius: 14,
  },
  title: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 4,
  },
  devButton: {
    backgroundColor: COLORS.devButtonBg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  devButtonText: {
    color: COLORS.devButtonText,
    fontSize: 13,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  cardTouchable: {
    width: '47%',
    // Taller than wide — a plain square doesn't leave enough room for the
    // thumbnail plus title, hint and status text without the last line
    // (the "Earned" status) getting clipped against the card's own border.
    aspectRatio: 0.8,
  },
  card: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 6,
  },
  cardDisabled: {
    backgroundColor: COLORS.cardBgDisabled,
  },
  ribbon: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  thumbnailStack: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
  },
  thumbnailLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
  },
  cardHint: {
    color: COLORS.textDim,
    fontSize: 12,
    textAlign: 'center',
  },
  cardHintDisabled: {
    color: COLORS.textDim,
  },
  cardStatus: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  solvedText: {
    color: COLORS.solved,
  },
  inProgressText: {
    color: COLORS.inProgress,
  },
});

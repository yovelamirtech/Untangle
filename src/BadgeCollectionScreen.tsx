import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { Badge, BADGES, getBadgeSolvedGraph } from './badges';
import { BadgeProgress, BadgeStatus, getBadgeStatus, loadBadgeProgress } from './badgeProgress';

const COLORS = {
  screenBg: '#1B1530',
  text: '#E4DBFA',
  textDim: 'rgba(228,219,250,0.4)',
  closeButton: 'rgba(0,0,0,0.35)',
  cardBg: 'rgba(228,219,250,0.08)',
  cardBgDisabled: 'rgba(228,219,250,0.03)',
  cardBorder: 'rgba(228,219,250,0.15)',
  solved: '#7FD9B9',
  inProgress: '#F6A8B8',
  thumbnailLine: 'rgba(228,219,250,0.85)',
};

interface BadgeCollectionScreenProps {
  onClose: () => void;
  onSelectBadge: (badgeId: string) => void;
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
 * the player guess from a hint alone. */
function BadgeThumbnail({ badge }: { badge: Badge }) {
  const graph = useMemo(() => getBadgeSolvedGraph(badge, THUMBNAIL_SIZE, THUMBNAIL_MARGIN).graph, [badge]);
  const nodeById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);

  return (
    <Svg width={THUMBNAIL_SIZE} height={THUMBNAIL_SIZE} viewBox={`0 0 ${THUMBNAIL_SIZE} ${THUMBNAIL_SIZE}`}>
      {graph.edges.map((edge, i) => {
        const from = nodeById.get(edge.a)!;
        const to = nodeById.get(edge.b)!;
        return <Line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={COLORS.thumbnailLine} strokeWidth={1.2} />;
      })}
    </Svg>
  );
}

function BadgeCard({ badge, status, onPress }: { badge: Badge; status: BadgeStatus; onPress: () => void }) {
  const playable = badge.contour.length > 0 || badge.graph !== undefined;
  const label = statusLabel(status);

  return (
    <Pressable
      style={[styles.card, !playable && styles.cardDisabled]}
      onPress={playable ? onPress : undefined}
      disabled={!playable}
    >
      {playable && <BadgeThumbnail badge={badge} />}
      <Text style={styles.cardTitle}>{badge.name}</Text>
      <Text style={[styles.cardHint, !playable && styles.cardHintDisabled]}>
        {playable ? badge.hint : 'Coming soon'}
      </Text>
      {label && (
        <Text style={[styles.cardStatus, status === 'solved' ? styles.solvedText : styles.inProgressText]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export default function BadgeCollectionScreen({ onClose, onSelectBadge }: BadgeCollectionScreenProps) {
  const [progress, setProgress] = useState<BadgeProgress>({});

  useEffect(() => {
    loadBadgeProgress().then(setProgress);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Badge Challenge</Text>
        <Pressable style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {BADGES.map((badge) => (
          <BadgeCard
            key={badge.id}
            badge={badge}
            status={getBadgeStatus(progress, badge.id)}
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
  title: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    backgroundColor: COLORS.closeButton,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  closeButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  card: {
    width: '47%',
    aspectRatio: 1,
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

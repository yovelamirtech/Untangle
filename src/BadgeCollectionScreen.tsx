import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, BADGES } from './badges';
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

function BadgeCard({ badge, status, onPress }: { badge: Badge; status: BadgeStatus; onPress: () => void }) {
  const playable = badge.contour.length > 0 || badge.graph !== undefined;
  const label = statusLabel(status);

  return (
    <Pressable
      style={[styles.card, !playable && styles.cardDisabled]}
      onPress={playable ? onPress : undefined}
      disabled={!playable}
    >
      <Text style={styles.cardTitle}>{status === 'solved' ? badge.name : playable ? '?' : badge.name}</Text>
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

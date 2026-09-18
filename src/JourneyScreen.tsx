import { Ionicons } from '@expo/vector-icons';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';

import AdBanner from './AdBanner';
import { getZoneForLevel, getZoneIndexForLevel, isWaypointLevel, LEVELS_PER_ZONE, ZONES } from './zones';

/** Tiny deterministic PRNG (mulberry32) so a zone's decorative star scatter
 * is stable across re-renders instead of jumping around every time. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STARS_PER_ZONE = 40;

/** A subtle, stable scatter of tiny dots within a zone band — decorative
 * only (like faint stars), seeded by the band's own start level so it never
 * shifts between renders or scroll updates. */
function getZoneStars(band: { top: number; height: number; startLevel: number }, width: number) {
  const rand = mulberry32(band.startLevel * 7919 + 1);
  return Array.from({ length: STARS_PER_ZONE }, () => ({
    x: rand() * width,
    y: band.top + rand() * band.height,
    r: 0.6 + rand() * 1.2,
    opacity: 0.08 + rand() * 0.14,
  }));
}

const ROW_HEIGHT = 60;
const MIN_DISPLAY_LEVELS = 12;
const DOT_RADIUS = 12;
const WAYPOINT_RADIUS = 17;
const ARROW_SIZE = 30;
const ARROW_GAP = 8;
const ARROW_BOB_DISTANCE = 8;
const ARROW_BOB_DURATION_MS = 900;
const ZONE_REVEAL_HOLD_MS = 900;
const ZONE_REVEAL_FADE_MS = 900;

const COLORS = {
  screenBg: '#1B1530',
  path: 'rgba(228,219,250,0.35)',
  dotUpcoming: 'rgba(228,219,250,0.25)',
  dotSolved: '#7FD9B9',
  dotCurrent: '#F6A8B8',
  ringCurrent: '#F6A8B8',
  text: '#E4DBFA',
  textDim: 'rgba(228,219,250,0.4)',
  zoneLabel: 'rgba(228,219,250,0.75)',
  // The next zone (not yet reached) is a flat, neutral grey rather than its
  // real palette — so its own colors stay a surprise until it's reached.
  futureZoneBg: '#232030',
  futureZoneLabel: 'rgba(228,219,250,0.35)',
  iconButtonBg: 'rgba(0,0,0,0.35)',
  devButtonBg: 'rgba(232,104,138,0.25)',
  devButtonText: '#F6A8B8',
};

interface JourneyScreenProps {
  furthestLevel: number;
  onExitToMenu: () => void;
  onOpenSettings: () => void;
  /** Opens the given level for play — any unlocked stage (1..furthestLevel)
   * can be tapped; replaying an already-solved one doesn't affect
   * progression either way. */
  onPlay: (level: number) => void;
  /** True right after a solve crossed into a new zone — plays a one-time
   * full-screen reveal for it. */
  justUnlockedZone: boolean;
  /** Called once the reveal has been shown, so it isn't replayed on a later visit. */
  onZoneRevealShown: () => void;
  /** Dev-only: resets journey progress back to level 1. */
  onDevResetProgress: () => void;
}

export default function JourneyScreen({
  furthestLevel,
  onExitToMenu,
  onOpenSettings,
  onPlay,
  justUnlockedZone,
  onZoneRevealShown,
  onDevResetProgress,
}: JourneyScreenProps) {
  const scrollRef = useRef<ScrollView>(null);
  const { width, height: windowHeight } = useWindowDimensions();

  const currentZoneOrdinal = Math.floor((furthestLevel - 1) / LEVELS_PER_ZONE);
  // Shows the whole current zone (including levels not reached yet, greyed
  // out) plus the whole next zone (see zoneBands below, rendered flat grey
  // with its name hidden) — not just a small fixed lookahead.
  const totalLevels = Math.max(MIN_DISPLAY_LEVELS, (currentZoneOrdinal + 2) * LEVELS_PER_ZONE);
  const centerX = width / 2;
  // Scales with the screen instead of a fixed pixel amount, so the path
  // actually zigzags across the full device width (small phone or large
  // tablet) instead of sitting in a narrow fixed-width column.
  const waveAmplitude = Math.max(40, width / 2 - WAYPOINT_RADIUS - 24);

  const contentHeight = ROW_HEIGHT * totalLevels;

  // Level 1 sits at the bottom of the path and later levels wind upward —
  // row index i (0-based) is level i+1, so its y is measured from the
  // bottom of the content instead of the top.
  const points = useMemo(() => {
    return Array.from({ length: totalLevels }, (_, i) => {
      const level = i + 1;
      const y = contentHeight - (ROW_HEIGHT * i + ROW_HEIGHT / 2);
      const x = centerX + Math.sin(level * 0.7) * waveAmplitude;
      return { level, x, y };
    });
  }, [totalLevels, contentHeight, centerX, waveAmplitude]);

  const currentPoint = points[Math.min(furthestLevel, totalLevels) - 1];

  useEffect(() => {
    if (currentPoint) {
      // Leaves current stage a bit below center, so a little of the
      // upcoming path is visible above it right away and the rest of the
      // history is one scroll down.
      const targetY = Math.max(0, currentPoint.y - windowHeight * 0.6);
      // Small delay lets the ScrollView finish laying out before we jump.
      const timeout = setTimeout(() => scrollRef.current?.scrollTo({ y: targetY, animated: false }), 0);
      return () => clearTimeout(timeout);
    }
  }, [currentPoint, windowHeight]);

  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: -ARROW_BOB_DISTANCE,
          duration: ARROW_BOB_DURATION_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: ARROW_BOB_DURATION_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);

  // Full-screen "new zone" reveal: holds a solid cover in the new zone's
  // own color (with its name) briefly, then fades to show the map
  // underneath — shown once, right after a solve crosses into a new zone.
  const [showZoneReveal, setShowZoneReveal] = useState(justUnlockedZone);
  const zoneRevealOpacity = useRef(new Animated.Value(justUnlockedZone ? 1 : 0)).current;
  useEffect(() => {
    if (!justUnlockedZone) return;
    const timer = setTimeout(() => {
      Animated.timing(zoneRevealOpacity, {
        toValue: 0,
        duration: ZONE_REVEAL_FADE_MS,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }).start(() => setShowZoneReveal(false));
    }, ZONE_REVEAL_HOLD_MS);
    onZoneRevealShown();
    return () => clearTimeout(timer);
    // Runs once, only for the mount that actually just unlocked a zone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const newZone = getZoneForLevel(furthestLevel);

  const zoneBands = useMemo(() => {
    const bands: { top: number; height: number; zoneIndex: number; startLevel: number; ordinal: number }[] = [];
    let level = 1;
    while (level <= totalLevels) {
      const zoneIndex = getZoneIndexForLevel(level);
      const ordinal = Math.floor((level - 1) / LEVELS_PER_ZONE);
      const zoneStart = ordinal * LEVELS_PER_ZONE + 1;
      const zoneEnd = Math.min(zoneStart + LEVELS_PER_ZONE - 1, totalLevels);
      bands.push({
        top: ROW_HEIGHT * (totalLevels - zoneEnd),
        height: ROW_HEIGHT * (zoneEnd - zoneStart + 1),
        zoneIndex,
        startLevel: zoneStart,
        ordinal,
      });
      level = zoneEnd + 1;
    }
    return bands;
  }, [totalLevels]);

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
          <Text style={styles.title}>Journey</Text>
        </View>
        {__DEV__ && (
          <Pressable style={styles.devButton} onPress={onDevResetProgress}>
            <Text style={styles.devButtonText}>Reset</Text>
          </Pressable>
        )}
      </View>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{ width, height: contentHeight }}
      >
        <View style={{ width, height: contentHeight }}>
          <Svg width={width} height={contentHeight}>
            {zoneBands.map((band) => (
              <Rect
                key={band.startLevel}
                x={0}
                y={band.top}
                width={width}
                height={band.height}
                fill={band.ordinal > currentZoneOrdinal ? COLORS.futureZoneBg : ZONES[band.zoneIndex].background}
              />
            ))}
            {zoneBands
              .filter((band) => band.ordinal <= currentZoneOrdinal)
              .map((band) =>
                getZoneStars(band, width).map((star, i) => (
                  <Circle
                    key={`star-${band.startLevel}-${i}`}
                    cx={star.x}
                    cy={star.y}
                    r={star.r}
                    fill={COLORS.text}
                    opacity={star.opacity}
                  />
                ))
              )}
            {zoneBands.map((band) => {
              const isFuture = band.ordinal > currentZoneOrdinal;
              const name = isFuture ? '???' : ZONES[band.zoneIndex].name;
              const labelColor = isFuture ? COLORS.futureZoneLabel : COLORS.zoneLabel;
              // Shown near both the top and bottom of the band — tall zones
              // (21 levels of scrolling) would otherwise only show their
              // name once, easy to scroll straight past.
              const labelYs = [band.top + 34, band.top + band.height - 16];
              return labelYs.map((y, i) => (
                <Fragment key={`label-${band.startLevel}-${i}`}>
                  <Circle cx={10} cy={y - 7} r={2.5} fill={labelColor} />
                  <SvgText x={22} y={y} fill={labelColor} fontSize={26} fontWeight="800">
                    {name}
                  </SvgText>
                </Fragment>
              ));
            })}
            {points.slice(0, -1).map((p, i) => {
              const next = points[i + 1];
              return (
                <Line
                  key={`line-${p.level}`}
                  x1={p.x}
                  y1={p.y}
                  x2={next.x}
                  y2={next.y}
                  stroke={COLORS.path}
                  strokeWidth={4}
                />
              );
            })}
            {points.map((p) => {
              const isSolved = p.level < furthestLevel;
              const isCurrent = p.level === furthestLevel;
              const waypoint = isWaypointLevel(p.level);
              const radius = waypoint ? WAYPOINT_RADIUS : DOT_RADIUS;
              const fill = isCurrent ? COLORS.dotCurrent : isSolved ? COLORS.dotSolved : COLORS.dotUpcoming;

              return (
                <Fragment key={p.level}>
                  {isCurrent && (
                    <Circle
                      cx={p.x}
                      cy={p.y}
                      r={radius + 6}
                      fill="none"
                      stroke={COLORS.ringCurrent}
                      strokeWidth={2.5}
                    />
                  )}
                  {waypoint && (
                    <Circle cx={p.x} cy={p.y} r={radius + 4} fill="none" stroke={fill} strokeWidth={2} />
                  )}
                  <Circle cx={p.x} cy={p.y} r={radius} fill={fill} />
                  <SvgText
                    x={p.x}
                    y={p.y + 4}
                    fill={isSolved || isCurrent ? '#241B38' : COLORS.textDim}
                    fontSize={11}
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {p.level}
                  </SvgText>
                </Fragment>
              );
            })}
          </Svg>

          {points
            .filter((p) => p.level <= furthestLevel)
            .map((p) => (
              <Pressable
                key={`tap-${p.level}`}
                style={[styles.tapTarget, { left: p.x - 28, top: p.y - 28 }]}
                onPress={() => onPlay(p.level)}
                hitSlop={8}
              />
            ))}

          {currentPoint && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.arrow,
                {
                  left: currentPoint.x - ARROW_SIZE / 2,
                  top: currentPoint.y - WAYPOINT_RADIUS - ARROW_GAP - ARROW_SIZE,
                  transform: [{ translateY: bob }],
                },
              ]}
            >
              <Ionicons name="caret-down" size={ARROW_SIZE} color={COLORS.ringCurrent} />
            </Animated.View>
          )}
        </View>
      </ScrollView>
      <AdBanner />

      {showZoneReveal && (
        <Animated.View
          pointerEvents="none"
          style={[styles.zoneReveal, { backgroundColor: newZone.background, opacity: zoneRevealOpacity }]}
        >
          <Text style={styles.zoneRevealText}>✨ {newZone.name}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.screenBg,
  },
  scroll: {
    flex: 1,
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
  tapTarget: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  arrow: {
    position: 'absolute',
  },
  zoneReveal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneRevealText: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '800',
  },
});

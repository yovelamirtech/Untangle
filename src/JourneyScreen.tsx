import { Ionicons } from '@expo/vector-icons';
import { Fragment, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';

import AdBanner from './AdBanner';
import { getZoneIndexForLevel, isWaypointLevel, LEVELS_PER_ZONE, ZONES } from './zones';

const ROW_HEIGHT = 60;
const LOOKAHEAD_LEVELS = 4;
const MIN_DISPLAY_LEVELS = 12;
const DOT_RADIUS = 12;
const WAYPOINT_RADIUS = 17;
const ARROW_SIZE = 30;
const ARROW_GAP = 8;
const ARROW_BOB_DISTANCE = 8;
const ARROW_BOB_DURATION_MS = 900;

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
};

interface JourneyScreenProps {
  furthestLevel: number;
  onClose: () => void;
  onPlay: () => void;
}

export default function JourneyScreen({ furthestLevel, onClose, onPlay }: JourneyScreenProps) {
  const scrollRef = useRef<ScrollView>(null);
  const { width, height: windowHeight } = useWindowDimensions();

  const totalLevels = Math.max(MIN_DISPLAY_LEVELS, furthestLevel + LOOKAHEAD_LEVELS);
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

  const zoneBands = useMemo(() => {
    const bands: { top: number; height: number; zoneIndex: number; startLevel: number }[] = [];
    let level = 1;
    while (level <= totalLevels) {
      const zoneIndex = getZoneIndexForLevel(level);
      const zoneStart = Math.floor((level - 1) / LEVELS_PER_ZONE) * LEVELS_PER_ZONE + 1;
      const zoneEnd = Math.min(zoneStart + LEVELS_PER_ZONE - 1, totalLevels);
      bands.push({
        top: ROW_HEIGHT * (totalLevels - zoneEnd),
        height: ROW_HEIGHT * (zoneEnd - zoneStart + 1),
        zoneIndex,
        startLevel: zoneStart,
      });
      level = zoneEnd + 1;
    }
    return bands;
  }, [totalLevels]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Journey</Text>
        <Pressable style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Back</Text>
        </Pressable>
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
                fill={ZONES[band.zoneIndex].background}
              />
            ))}
            {zoneBands.map((band) => (
              <SvgText
                key={`label-${band.startLevel}`}
                x={16}
                y={band.top + band.height - 16}
                fill={COLORS.zoneLabel}
                fontSize={24}
                fontWeight="800"
              >
                {ZONES[band.zoneIndex].name}
              </SvgText>
            ))}
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

          {currentPoint && (
            <>
              <Pressable
                style={[
                  styles.currentTapTarget,
                  { left: currentPoint.x - 28, top: currentPoint.y - 28 },
                ]}
                onPress={onPlay}
                hitSlop={8}
              />
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
                <Ionicons name="caret-up" size={ARROW_SIZE} color={COLORS.ringCurrent} />
              </Animated.View>
            </>
          )}
        </View>
      </ScrollView>
      <AdBanner />
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
  title: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  closeButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  currentTapTarget: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  arrow: {
    position: 'absolute',
  },
});

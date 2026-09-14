import { Fragment, useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';

import AdBanner from './AdBanner';
import { getZoneIndexForLevel, isWaypointLevel, LEVELS_PER_ZONE, ZONES } from './zones';

const ROW_HEIGHT = 60;
const WAVE_AMPLITUDE = 55;
const LOOKAHEAD_LEVELS = 4;
const MIN_DISPLAY_LEVELS = 12;
const DOT_RADIUS = 12;
const WAYPOINT_RADIUS = 17;

const COLORS = {
  screenBg: '#1B1530',
  path: 'rgba(228,219,250,0.35)',
  dotUpcoming: 'rgba(228,219,250,0.25)',
  dotSolved: '#7FD9B9',
  dotCurrent: '#F6A8B8',
  ringCurrent: '#F6A8B8',
  text: '#E4DBFA',
  textDim: 'rgba(228,219,250,0.4)',
  zoneLabel: 'rgba(228,219,250,0.55)',
};

interface JourneyScreenProps {
  furthestLevel: number;
  onClose: () => void;
}

export default function JourneyScreen({ furthestLevel, onClose }: JourneyScreenProps) {
  const scrollRef = useRef<ScrollView>(null);

  const totalLevels = Math.max(MIN_DISPLAY_LEVELS, furthestLevel + LOOKAHEAD_LEVELS);
  const width = 220;
  const centerX = width / 2;

  const points = useMemo(() => {
    return Array.from({ length: totalLevels }, (_, i) => {
      const level = i + 1;
      const y = ROW_HEIGHT * i + ROW_HEIGHT / 2;
      const x = centerX + Math.sin(level * 0.7) * WAVE_AMPLITUDE;
      return { level, x, y };
    });
  }, [totalLevels]);

  const contentHeight = ROW_HEIGHT * totalLevels;

  useEffect(() => {
    const currentPoint = points[Math.min(furthestLevel, totalLevels) - 1];
    if (currentPoint) {
      const targetY = Math.max(0, currentPoint.y - 300);
      // Small delay lets the ScrollView finish laying out before we jump.
      const timeout = setTimeout(() => scrollRef.current?.scrollTo({ y: targetY, animated: false }), 0);
      return () => clearTimeout(timeout);
    }
  }, [points, furthestLevel, totalLevels]);

  const zoneBands = useMemo(() => {
    const bands: { top: number; height: number; zoneIndex: number; startLevel: number }[] = [];
    let level = 1;
    while (level <= totalLevels) {
      const zoneIndex = getZoneIndexForLevel(level);
      const zoneStart = Math.floor((level - 1) / LEVELS_PER_ZONE) * LEVELS_PER_ZONE + 1;
      const zoneEnd = Math.min(zoneStart + LEVELS_PER_ZONE - 1, totalLevels);
      bands.push({
        top: ROW_HEIGHT * (zoneStart - 1),
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
              y={band.top + 28}
              fill={COLORS.zoneLabel}
              fontSize={13}
              fontWeight="600"
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
});

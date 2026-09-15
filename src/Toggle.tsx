import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, TouchableOpacity } from 'react-native';

import { SETTINGS_COLORS } from './settingsTheme';

const TRACK_WIDTH = 50;
const TRACK_HEIGHT = 30;
const THUMB_SIZE = 24;
const PADDING = 3;
const TRAVEL = TRACK_WIDTH - THUMB_SIZE - PADDING * 2;

interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export default function Toggle({ value, onValueChange }: ToggleProps) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: value ? 1 : 0, duration: 180, useNativeDriver: false }).start();
  }, [value, anim]);

  const trackBackground = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [SETTINGS_COLORS.cardBorder, SETTINGS_COLORS.accent],
  });
  const thumbBackground = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [SETTINGS_COLORS.textFaint, SETTINGS_COLORS.accentText],
  });
  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, TRAVEL] });

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={() => onValueChange(!value)}>
      <Animated.View style={[styles.track, { backgroundColor: trackBackground }]}>
        <Animated.View style={[styles.thumb, { backgroundColor: thumbBackground, transform: [{ translateX }] }]} />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    justifyContent: 'center',
    paddingHorizontal: PADDING,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
  },
});

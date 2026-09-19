import { useEffect } from 'react';
import { Accelerometer } from 'expo-sensors';
import { SharedValue, useSharedValue } from 'react-native-reanimated';

const UPDATE_INTERVAL_MS = 50;
/** Low-pass filter factor: lower = smoother/laggier, higher = snappier/jittery. */
const SMOOTHING = 0.15;
/** Raw accelerometer reading (in g) treated as "full tilt", before normalizing to ±1. */
const MAX_TILT_G = 0.5;

export interface DeviceTilt {
  x: SharedValue<number>;
  y: SharedValue<number>;
}

/**
 * Smoothed device tilt on the X/Y axes, roughly in [-1, 1], meant to drive a
 * subtle parallax background. Falls back to a steady (0, 0) — a static
 * background, never a broken one — whenever the accelerometer isn't
 * available (web without motion permission granted, some simulators, etc)
 * or `enabled` is false.
 */
export function useDeviceTilt(enabled: boolean): DeviceTilt {
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  useEffect(() => {
    if (!enabled) return;
    let subscription: { remove: () => void } | undefined;
    let cancelled = false;

    Accelerometer.isAvailableAsync()
      .then((available) => {
        if (!available || cancelled) return;
        Accelerometer.setUpdateInterval(UPDATE_INTERVAL_MS);
        subscription = Accelerometer.addListener(({ x: rawX, y: rawY }) => {
          const targetX = Math.min(Math.max(rawX, -MAX_TILT_G), MAX_TILT_G) / MAX_TILT_G;
          const targetY = Math.min(Math.max(rawY, -MAX_TILT_G), MAX_TILT_G) / MAX_TILT_G;
          x.value = x.value + (targetX - x.value) * SMOOTHING;
          y.value = y.value + (targetY - y.value) * SMOOTHING;
        });
      })
      .catch(() => {
        // No accelerometer, no permission, etc — leave tilt at (0, 0).
      });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled, x, y]);

  return { x, y };
}

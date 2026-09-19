import { Canvas } from '@shopify/react-native-skia';
import { StyleSheet } from 'react-native';

import ParallaxOrb from './ParallaxOrb';
import { DeviceTilt } from './useDeviceTilt';

interface Props {
  width: number;
  height: number;
  tilt: DeviceTilt;
  /** Three tint colors, one per depth layer — reuses the level's own palette
   * so the effect feels like it belongs, not a bolted-on overlay. */
  colors: [string, string, string];
}

/** Three soft blurred color layers, each nudged a different amount by device
 * tilt, sitting behind the puzzle canvas — a cheap "2.5D" depth cue that
 * doesn't touch the puzzle's own flat 2D rendering. */
const LAYERS = [
  { xFactor: 0.16, yFactor: 0.16, radiusFactor: 0.55, depth: 14, opacity: 0.22 },
  { xFactor: 0.88, yFactor: 0.3, radiusFactor: 0.42, depth: 26, opacity: 0.18 },
  { xFactor: 0.5, yFactor: 0.96, radiusFactor: 0.5, depth: 9, opacity: 0.2 },
];

export default function ParallaxBackground({ width, height, tilt, colors }: Props) {
  if (width <= 0 || height <= 0) return null;
  const minDim = Math.min(width, height);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      {LAYERS.map((layer, i) => (
        <ParallaxOrb
          key={i}
          baseX={width * layer.xFactor}
          baseY={height * layer.yFactor}
          radius={minDim * layer.radiusFactor}
          depth={layer.depth}
          opacity={layer.opacity}
          color={colors[i % colors.length]}
          tiltX={tilt.x}
          tiltY={tilt.y}
        />
      ))}
    </Canvas>
  );
}

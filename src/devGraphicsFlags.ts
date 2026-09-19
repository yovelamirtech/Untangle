import { useSyncExternalStore } from 'react';

/**
 * Dev-only kill switches for the graphics-polish effects (gradient nodes,
 * layered node shadow, rope glow) so they can be A/B'd on a real device
 * while testing, without a rebuild. In-memory only — resets on app
 * restart — and only ever surfaced through a `__DEV__`-gated panel; the
 * effects themselves always default to on.
 */
export interface DevGraphicsFlags {
  nodeGradient: boolean;
  nodeShadow: boolean;
  edgeGlow: boolean;
  parallax: boolean;
}

let flags: DevGraphicsFlags = {
  nodeGradient: true,
  nodeShadow: true,
  edgeGlow: true,
  parallax: true,
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): DevGraphicsFlags {
  return flags;
}

export function setDevGraphicsFlag(key: keyof DevGraphicsFlags, value: boolean) {
  // A new object, not a mutation — useSyncExternalStore only re-renders
  // subscribers when getSnapshot() returns a value that fails Object.is
  // against the previous one, so mutating `flags` in place here silently
  // made every toggle a no-op.
  flags = { ...flags, [key]: value };
  notify();
}

export function useDevGraphicsFlags(): DevGraphicsFlags {
  return useSyncExternalStore(subscribe, getSnapshot);
}

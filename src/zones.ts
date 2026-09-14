export const LEVELS_PER_ZONE = 21;
export const WAYPOINT_INTERVAL = 5;

export interface Zone {
  name: string;
  background: string;
}

export const ZONES: Zone[] = [
  { name: 'Dusk Violet', background: '#2B2140' },
  { name: 'Twilight Teal', background: '#1F3A3D' },
  { name: 'Rose Ember', background: '#3A2130' },
  { name: 'Midnight Amber', background: '#2A2410' },
];

export function getZoneIndexForLevel(level: number): number {
  return Math.floor((level - 1) / LEVELS_PER_ZONE) % ZONES.length;
}

export function getZoneForLevel(level: number): Zone {
  return ZONES[getZoneIndexForLevel(level)];
}

export function isWaypointLevel(level: number): boolean {
  return level % WAYPOINT_INTERVAL === 0;
}

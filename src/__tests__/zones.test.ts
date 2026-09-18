import { getZoneForLevel, getZoneIndexForLevel, isWaypointLevel, LEVELS_PER_ZONE, WAYPOINT_INTERVAL, ZONES } from '../zones';

describe('getZoneIndexForLevel', () => {
  it('stays in zone 0 for the first zone worth of levels', () => {
    expect(getZoneIndexForLevel(1)).toBe(0);
    expect(getZoneIndexForLevel(LEVELS_PER_ZONE)).toBe(0);
  });

  it('advances to zone 1 exactly at the first level past a zone boundary', () => {
    expect(getZoneIndexForLevel(LEVELS_PER_ZONE + 1)).toBe(1);
  });

  it('wraps around after the last zone', () => {
    const lastZoneStart = LEVELS_PER_ZONE * (ZONES.length - 1) + 1;
    const wrapLevel = lastZoneStart + LEVELS_PER_ZONE * ZONES.length;
    expect(getZoneIndexForLevel(wrapLevel)).toBe(getZoneIndexForLevel(lastZoneStart));
  });
});

describe('getZoneForLevel', () => {
  it('returns the zone matching the computed index', () => {
    expect(getZoneForLevel(1)).toBe(ZONES[0]);
    expect(getZoneForLevel(LEVELS_PER_ZONE + 1)).toBe(ZONES[1]);
  });
});

describe('isWaypointLevel', () => {
  it('is true only on multiples of the waypoint interval', () => {
    expect(isWaypointLevel(WAYPOINT_INTERVAL)).toBe(true);
    expect(isWaypointLevel(WAYPOINT_INTERVAL * 3)).toBe(true);
    expect(isWaypointLevel(1)).toBe(false);
    expect(isWaypointLevel(WAYPOINT_INTERVAL + 1)).toBe(false);
  });
});

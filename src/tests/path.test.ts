import { describe, it, expect } from 'vitest';
import { distanceAlongPath, totalPathLength } from '../systems/path';
import { LEVELS } from '../config/grid';

const PATH = LEVELS.level1.paths[0];

describe('totalPathLength', () => {
  it('sums segment lengths', () => {
    const expected = PATH.reduce((acc, p, i) => {
      if (i === 0) return 0;
      return acc + Math.hypot(p.x - PATH[i - 1].x, p.y - PATH[i - 1].y);
    }, 0);
    expect(totalPathLength(PATH)).toBeCloseTo(expected, 5);
  });
});

describe('distanceAlongPath', () => {
  it('returns first waypoint at 0', () => {
    const p = distanceAlongPath(PATH, 0);
    expect(p).toEqual(PATH[0]);
  });
  it('returns last waypoint past total length', () => {
    const p = distanceAlongPath(PATH, totalPathLength(PATH) + 9999);
    expect(p).toEqual(PATH[PATH.length - 1]);
  });
  it('moves along straight segment proportionally', () => {
    const p = distanceAlongPath(PATH, 50);
    expect(p.y).toBeCloseTo(PATH[0].y, 5);
    expect(p.x).toBeCloseTo(PATH[0].x + 50, 5);
  });
  it('handles multi-path level2 with each path independently', () => {
    const paths = LEVELS.level2.paths;
    expect(paths.length).toBe(2); // Y 形分叉
    for (const p of paths) {
      expect(totalPathLength(p)).toBeGreaterThan(0);
      const start = distanceAlongPath(p, 0);
      expect(start).toEqual(p[0]);
    }
  });
});

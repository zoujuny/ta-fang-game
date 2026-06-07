import { describe, it, expect } from 'vitest';
import { LEVELS, LEVEL_ORDER, levelScale } from '../config/grid';

describe('LEVELS configuration', () => {
  it('has 10 levels in LEVEL_ORDER', () => {
    expect(LEVEL_ORDER.length).toBe(10);
  });
  it('every level has unique id and a name', () => {
    const ids = new Set<string>();
    for (const id of LEVEL_ORDER) {
      expect(ids.has(id)).toBe(false);
      ids.add(id);
      const lvl = LEVELS[id];
      expect(lvl).toBeDefined();
      expect(lvl.name.length).toBeGreaterThan(0);
    }
  });
  it('difficulty increases monotonically with index', () => {
    let prev = -1;
    for (const id of LEVEL_ORDER) {
      expect(LEVELS[id].difficulty).toBeGreaterThan(prev);
      prev = LEVELS[id].difficulty;
    }
  });
  it('each level has at least 1 path', () => {
    for (const id of LEVEL_ORDER) {
      expect(LEVELS[id].paths.length).toBeGreaterThan(0);
    }
  });
  it('path waypoints are within canvas', () => {
    const MAX = 16 * 48, MAXH = 10 * 48;
    for (const id of LEVEL_ORDER) {
      for (const path of LEVELS[id].paths) {
        for (const wp of path) {
          expect(wp.x).toBeGreaterThanOrEqual(0);
          expect(wp.x).toBeLessThanOrEqual(MAX);
          expect(wp.y).toBeGreaterThanOrEqual(0);
          expect(wp.y).toBeLessThanOrEqual(MAXH);
        }
      }
    }
  });
  it('complex levels (L6-L10) have multiple paths or many waypoints', () => {
    const totalSegs = (id: string) =>
      LEVELS[id as keyof typeof LEVELS].paths.reduce(
        (acc, p) => acc + (p.length - 1),
        0,
      );
    // L1 = 5 segments, L10 should be far more
    expect(totalSegs('level1')).toBeLessThan(totalSegs('level10'));
    expect(totalSegs('level10')).toBeGreaterThanOrEqual(8);
  });
});

describe('levelScale (exponential)', () => {
  it('level 1 (idx 0) is baseline 1.0x', () => {
    const s = levelScale(0);
    expect(s.hpMul).toBeCloseTo(1.0, 2);
    expect(s.speedMul).toBeCloseTo(1.0, 2);
    expect(s.damageMul).toBeCloseTo(1.0, 2);
    expect(s.bountyMul).toBeCloseTo(1.0, 2);
  });
  it('level 10 (idx 9) has ~4.4x hp (exponential)', () => {
    const s = levelScale(9);
    expect(s.hpMul).toBeCloseTo(4.43, 1);
    expect(s.damageMul).toBeCloseTo(2.77, 1);
  });
  it('difficulty scales monotonically with level', () => {
    let prev = 0;
    for (let i = 0; i < 10; i++) {
      const s = levelScale(i);
      expect(s.hpMul).toBeGreaterThan(prev);
      prev = s.hpMul;
    }
  });
});

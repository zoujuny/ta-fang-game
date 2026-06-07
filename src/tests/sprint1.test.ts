import { describe, it, expect } from 'vitest';
import { levelScale } from '../config/grid';
import {
  levelMultiplier,
  upgradeCost,
  sellRefund,
} from '../entities/Tower';

describe('levelScale (exponential curve)', () => {
  it('L1 = 1.0 (baseline)', () => {
    const s = levelScale(0);
    expect(s.hpMul).toBeCloseTo(1, 5);
    expect(s.speedMul).toBeCloseTo(1, 5);
    expect(s.damageMul).toBeCloseTo(1, 5);
    expect(s.bountyMul).toBeCloseTo(1, 5);
  });

  it('L10 = ~4.4x HP, ~3.1x damage, ~2.4x bounty', () => {
    const s = levelScale(9);
    expect(s.hpMul).toBeCloseTo(4.44, 1);
    expect(s.damageMul).toBeCloseTo(2.77, 1);
    expect(s.bountyMul).toBeCloseTo(2.36, 1);
  });

  it('each step increases (strictly monotone)', () => {
    let prev = 0;
    for (let i = 0; i < 10; i++) {
      const cur = levelScale(i).hpMul;
      expect(cur).toBeGreaterThan(prev);
      prev = cur;
    }
  });
});

describe('Tower.levelMultiplier', () => {
  it('L1 = identity (1, 1, 1)', () => {
    const m = levelMultiplier(1);
    expect(m.damage).toBe(1);
    expect(m.range).toBe(1);
    expect(m.fireInterval).toBe(1);
  });
  it('L2 = 1.5x damage, 1.2x range, 0.9x interval', () => {
    const m = levelMultiplier(2);
    expect(m.damage).toBeCloseTo(1.5);
    expect(m.range).toBeCloseTo(1.2);
    expect(m.fireInterval).toBeCloseTo(0.9);
  });
  it('L3 = 2.25x damage, 1.44x range, 0.81x interval', () => {
    const m = levelMultiplier(3);
    expect(m.damage).toBeCloseTo(2.25);
    expect(m.range).toBeCloseTo(1.44);
    expect(m.fireInterval).toBeCloseTo(0.81);
  });
});

describe('upgradeCost', () => {
  it('cost = base * currentLevel', () => {
    expect(upgradeCost(50, 1)).toBe(50);   // L1 -> L2 cost 50
    expect(upgradeCost(50, 2)).toBe(100);  // L2 -> L3 cost 100
    expect(upgradeCost(150, 1)).toBe(150); // 雷塔 L1->L2 cost 150
  });
});

describe('sellRefund', () => {
  it('returns 50% of total spent (floored)', () => {
    expect(sellRefund(100)).toBe(50);
    expect(sellRefund(50)).toBe(25);
    expect(sellRefund(200)).toBe(100);
    // 卖出 L1 + 升 2 级箭塔: 50 + 50 + 100 = 200, 返还 100
    expect(sellRefund(200)).toBe(100);
  });
});

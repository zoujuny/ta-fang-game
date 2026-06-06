import { describe, it, expect } from 'vitest';
import { effectiveDamage, inRange, pickTarget, applySplash } from '../systems/combat';

describe('effectiveDamage', () => {
  it('returns raw damage when no resistance', () => {
    expect(effectiveDamage(100, 0)).toBe(100);
  });

  it('reduces by resistance factor', () => {
    expect(effectiveDamage(100, 0.4)).toBe(60);
  });

  it('clamps resistance to [0, 1]', () => {
    expect(effectiveDamage(100, -0.5)).toBe(100);
    expect(effectiveDamage(100, 1.5)).toBe(0);
  });
});

describe('inRange', () => {
  it('detects points inside range', () => {
    expect(inRange(0, 0, 30, 40, 50)).toBe(true);
  });
  it('excludes points outside range', () => {
    expect(inRange(0, 0, 60, 0, 50)).toBe(false);
  });
  it('boundary inclusive', () => {
    expect(inRange(0, 0, 50, 0, 50)).toBe(true);
  });
});

describe('pickTarget', () => {
  it('returns null on empty', () => {
    expect(pickTarget([], 0, 0, 100)).toBeNull();
  });
  it('picks the candidate with most progress', () => {
    const a = { x: 0, y: 0, alive: true, progress: 1 };
    const b = { x: 10, y: 0, alive: true, progress: 5 };
    expect(pickTarget([a, b], 0, 0, 100)).toBe(b);
  });
  it('skips dead', () => {
    const a = { x: 0, y: 0, alive: false, progress: 99 };
    const b = { x: 10, y: 0, alive: true, progress: 1 };
    expect(pickTarget([a, b], 0, 0, 100)).toBe(b);
  });
  it('skips out-of-range', () => {
    const a = { x: 1000, y: 0, alive: true, progress: 1 };
    expect(pickTarget([a], 0, 0, 50)).toBeNull();
  });
});

describe('applySplash', () => {
  it('hits all monsters within radius and respects resistance', () => {
    const damaged: number[] = [];
    const a = { x: 0, y: 0, alive: true, takeDamage: (d: number) => damaged.push(d) };
    const b = { x: 30, y: 0, alive: true, takeDamage: (d: number) => damaged.push(d) };
    const c = { x: 200, y: 0, alive: true, takeDamage: (d: number) => damaged.push(d) };
    const hits = applySplash(0, 0, 50, [a, b, c], 100, 0.5);
    expect(hits).toBe(2);
    expect(damaged).toEqual([50, 50]);
  });
  it('skips dead', () => {
    const damaged: number[] = [];
    const a = { x: 0, y: 0, alive: false, takeDamage: (d: number) => damaged.push(d) };
    expect(applySplash(0, 0, 50, [a], 100)).toBe(0);
  });
});

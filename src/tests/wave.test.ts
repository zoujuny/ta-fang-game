import { describe, it, expect } from 'vitest';
import { createWaveRuntime, tickWaveSpawns, isWaveComplete } from '../systems/wave';

describe('wave runtime', () => {
  it('returns null for invalid wave index', () => {
    expect(createWaveRuntime(-1, 0)).toBeNull();
    expect(createWaveRuntime(999, 0)).toBeNull();
  });

  it('spawns nothing before delays/intervals elapse', () => {
    const rt = createWaveRuntime(0, 0);
    if (!rt) throw new Error('no runtime');
    const t0 = tickWaveSpawns(rt, 0);
    // 第一个 spawn delay = 0, interval=800 → 现在就应生成一个
    expect(t0.length).toBe(1);
    const t1 = tickWaveSpawns(rt, 100); // 还没到 800
    expect(t1.length).toBe(0);
  });

  it('produces exactly totalToSpawn over the wave', () => {
    const rt = createWaveRuntime(0, 0);
    if (!rt) throw new Error('no runtime');
    const total = rt.totalToSpawn;
    for (let t = 0; t < 10_000; t += 100) {
      tickWaveSpawns(rt, t);
    }
    expect(rt.spawnedSoFar).toBe(total);
    expect(rt.done).toBe(true);
  });

  it('wave completes only when all spawned are dead', () => {
    const rt = createWaveRuntime(0, 0);
    if (!rt) throw new Error('no runtime');
    for (let t = 0; t < 10_000; t += 100) tickWaveSpawns(rt, t);
    expect(isWaveComplete(rt, 2)).toBe(false);
    expect(isWaveComplete(rt, 0)).toBe(true);
  });
});

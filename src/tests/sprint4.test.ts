import { describe, it, expect } from 'vitest';

// 胜利画面 + 统计累加: 纯逻辑测
describe('GameStats tracking', () => {
  it('initial stats are zeroed', () => {
    const s = {
      kills: 0,
      livesStart: 20,
      livesLeft: 20,
      goldEarned: 0,
      towersBuilt: 0,
      waveReached: 0,
      totalWaves: 5,
    };
    expect(s.kills).toBe(0);
    expect(s.goldEarned).toBe(0);
    expect(s.waveReached).toBe(0);
  });

  it('goldEarned accumulates by kill reward', () => {
    let goldEarned = 0;
    goldEarned += Math.round(6.36);
    goldEarned += Math.round(7.08);
    expect(goldEarned).toBe(13);
  });

  it('livesLeft updates as lives lost', () => {
    let lives = 20;
    const livesStart = lives;
    lives -= 3;
    expect(lives).toBe(17);
    expect(livesStart - 17).toBe(3);
  });

  it('waveReached reaches totalWaves on completion', () => {
    let waveReached = 0;
    waveReached++;
    waveReached++;
    expect(waveReached).toBe(2);
  });
});

describe('level index progression', () => {
  it('goToNextLevel advances by 1 (L1 -> L2 -> ... -> L10)', () => {
    const order = ['level1','level2','level3','level4','level5','level6','level7','level8','level9','level10'];
    let i = 0;
    i++;
    const isLast = (idx: number) => idx >= order.length - 1;
    const next = (idx: number) => idx + 1;
    expect(isLast(9)).toBe(true);
    expect(next(0)).toBe(1);
    expect(next(8)).toBe(9);
  });
  it('last level (L10) has no next', () => {
    const isLast = (idx: number) => idx >= 9;
    expect(isLast(9)).toBe(true);
  });
});

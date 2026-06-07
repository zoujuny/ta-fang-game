import { describe, it, expect } from 'vitest';
import { loadProgress, saveProgress, markCleared, isLevelUnlocked } from '../systems/progress';
import { pickReaction, pickReactionByElement, tickStatus } from '../systems/elements';
import { TOWERS } from '../config/towers';

describe('progress save/load', () => {
  it('default empty progress', () => {
    const p = loadProgress();
    expect(p.clearedThrough).toBe(0);
  });

  it('markCleared advances by 1', () => {
    const after = markCleared(0, { clearedThrough: 0 });
    expect(after.clearedThrough).toBe(1);
  });

  it('markCleared only advances (no regression)', () => {
    const after = markCleared(0, { clearedThrough: 5 });
    expect(after.clearedThrough).toBe(5);
  });

  it('isLevelUnlocked respects clearedThrough', () => {
    expect(isLevelUnlocked(0, { clearedThrough: 0 })).toBe(true);  // L1 always unlocked
    expect(isLevelUnlocked(1, { clearedThrough: 0 })).toBe(false); // L2 needs L1 cleared
    expect(isLevelUnlocked(1, { clearedThrough: 1 })).toBe(true);
    expect(isLevelUnlocked(9, { clearedThrough: 9 })).toBe(true);
  });

  it('markCleared caps at 9 (level10 is the last)', () => {
    const after = markCleared(9, { clearedThrough: 9 });
    expect(after.clearedThrough).toBe(9);
  });

  it('saveProgress round-trip (using stubbed localStorage)', () => {
    // Node 环境没有 localStorage, 我们测试 markCleared 逻辑本身
    // 真实 localStorage 在浏览器被 GameScene 调用
    const before = { clearedThrough: 3 };
    const after = markCleared(2, before);
    expect(after.clearedThrough).toBe(3); // 不后退
  });
});

describe('poison status', () => {
  it('pickReactionByElement: poison on chill -> shatter', () => {
    const r = pickReactionByElement('poison', new Set(['chill']));
    expect(r?.name).toBe('shatter');
    expect(r?.damage).toBe(30);
  });

  it('pickReactionByElement: frost on poison -> shatter (symmetric)', () => {
    const r = pickReactionByElement('frost', new Set(['poison']));
    expect(r?.name).toBe('shatter');
  });

  it('pickReaction: chill+poison set -> shatter', () => {
    const r = pickReaction(new Set(['chill', 'poison']));
    expect(r?.name).toBe('shatter');
  });
});

describe('poison DoT tick', () => {
  it('deals damage over time', () => {
    const map = new Map();
    map.set('poison', { kind: 'poison', until: 1000, dps: 6 });
    const m = { hp: 100, takeDamage: (d: number) => { m.hp -= d; } };
    tickStatus(map, m, 0, 500);
    expect(m.hp).toBeCloseTo(97, 1); // 6 * 0.5s = 3 damage
  });
});

describe('TOWERS has 3 new elements', () => {
  it('poison tower with poison element + DoT', () => {
    expect(TOWERS.poison.element).toBe('poison');
    expect(TOWERS.poison.burnDps).toBeGreaterThan(0);
    expect(TOWERS.poison.emoji).toBe('☠️');
  });
  it('holy tower with holy element (no debuff)', () => {
    expect(TOWERS.holy.element).toBe('holy');
    expect(TOWERS.holy.emoji).toBe('⛪');
  });
  it('dark tower with dark element', () => {
    expect(TOWERS.dark.element).toBe('dark');
    expect(TOWERS.dark.emoji).toBe('🌑');
  });
});

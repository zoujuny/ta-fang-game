import { describe, it, expect } from 'vitest';
import { LEVELS, isBuildable } from '../config/grid';

// 回归测试: 路径走过的所有格子应当不可建
// 这是 L1 之前的 bug: 路径 (5,1)->(5,4) 的 col=5 row 2,3,4 未标记,玩家在 5,2 建塔后怪物会从旁边走过

describe('isBuildable matches actual path cells', () => {
  it('L1 vertical segment col=5 row 2,3,4 is NOT buildable', () => {
    const lvl = LEVELS.level1;
    expect(isBuildable(lvl, 5, 2)).toBe(false);
    expect(isBuildable(lvl, 5, 3)).toBe(false);
    expect(isBuildable(lvl, 5, 4)).toBe(false);
  });

  it('L1 horizontal segment col=6 row=1 IS buildable (path is at col 5)', () => {
    // 之前的 bug: bakeGrid 把 col=6 误标为路径,导致 col=6 row=1 不可建
    const lvl = LEVELS.level1;
    // col 6 row 1 在原 L1 是空地
    expect(isBuildable(lvl, 6, 1)).toBe(true);
  });

  it('L1 all path waypoint cells are NOT buildable', () => {
    const lvl = LEVELS.level1;
    for (const p of lvl.paths) {
      for (const wp of p) {
        const col = Math.floor(wp.x / 48);
        const row = Math.floor(wp.y / 48);
        expect(isBuildable(lvl, col, row)).toBe(false);
      }
    }
  });

  it('L2 Y-fork: all path cells are NOT buildable (Y junction at col 6)', () => {
    const lvl = LEVELS.level2;
    for (const p of lvl.paths) {
      for (const wp of p) {
        const col = Math.floor(wp.x / 48);
        const row = Math.floor(wp.y / 48);
        expect(isBuildable(lvl, col, row)).toBe(false);
      }
    }
  });

  it('L10 maze: key path cells are NOT buildable', () => {
    const lvl = LEVELS.level10;
    // L10 简化迷宫: 上路径拐点 (8,4), 下路径拐点 (4,5)(12,5)
    expect(isBuildable(lvl, 8, 4)).toBe(false);
    expect(isBuildable(lvl, 4, 5)).toBe(false);
    expect(isBuildable(lvl, 12, 5)).toBe(false);
  });
});

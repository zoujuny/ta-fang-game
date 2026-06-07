import { describe, it, expect } from 'vitest';

// 暂停菜单的纯逻辑: isPaused 字段 + overlay 行为模拟
class FakeScene {
  isPaused = false;
  pauseOverlay: any = null;
  victoryOverlay: any = null;
  state: any = { gameOver: false };

  togglePause() {
    if (this.state.gameOver) return;
    if (this.isPaused) this.hidePauseOverlay();
    else this.showPauseOverlay();
  }
  showPauseOverlay() {
    if (this.pauseOverlay) return;
    this.isPaused = true;
    this.pauseOverlay = { shown: true };
  }
  hidePauseOverlay() {
    this.isPaused = false;
    if (this.pauseOverlay) {
      this.pauseOverlay = null;
    }
  }
}

describe('Pause menu (pure logic)', () => {
  it('togglePause: paused -> not paused -> paused', () => {
    const s = new FakeScene();
    s.togglePause();
    expect(s.isPaused).toBe(true);
    s.togglePause();
    expect(s.isPaused).toBe(false);
    s.togglePause();
    expect(s.isPaused).toBe(true);
  });

  it('gameOver 状态不可暂停', () => {
    const s = new FakeScene();
    s.state.gameOver = true;
    s.togglePause();
    expect(s.isPaused).toBe(false);
  });

  it('hide 销毁 overlay 但允许再次显示', () => {
    const s = new FakeScene();
    s.showPauseOverlay();
    expect(s.pauseOverlay).not.toBeNull();
    s.hidePauseOverlay();
    expect(s.pauseOverlay).toBeNull();
    s.showPauseOverlay();
    expect(s.pauseOverlay).not.toBeNull();
  });

  it('update() 在 paused 时早 return (手动模拟)', () => {
    const s = new FakeScene();
    let updateRan = false;
    const update = () => {
      if (s.isPaused) return;
      updateRan = true;
    };
    s.showPauseOverlay();
    update();
    expect(updateRan).toBe(false);
    s.hidePauseOverlay();
    update();
    expect(updateRan).toBe(true);
  });
});

import {
  loadUserLevels,
  saveUserLevels,
  upsertUserLevel,
  deleteUserLevel,
  newUserLevelId,
  userLevelToDef,
  type UserLevel,
} from '../levels/editor';

describe('user level storage (editor)', () => {
  it('newUserLevelId generates user: prefix', () => {
    const id = newUserLevelId('test level');
    expect(id.startsWith('user:')).toBe(true);
    expect(id.length).toBeGreaterThan(5);
  });

  it('upsertUserLevel: insert returns array', () => {
    const u1: UserLevel = {
      id: 'user:1' as any,
      name: 'alpha',
      paths: [[{ col: 0, row: 1 }, { col: 5, row: 1 }, { col: 16, row: 1 }]],
      createdAt: 1,
    };
    const all = upsertUserLevel(u1);
    expect(Array.isArray(all)).toBe(true);
  });

  it('userLevelToDef: convert waypoints to pixel coords', () => {
    const u: UserLevel = {
      id: 'user:t' as any,
      name: 't',
      paths: [[{ col: 0, row: 2 }, { col: 5, row: 2 }, { col: 5, row: 7 }, { col: 16, row: 7 }]],
      createdAt: 0,
    };
    const def = userLevelToDef(u);
    expect(def.name).toBe('t');
    expect(def.paths.length).toBe(1);
    expect(def.paths[0][0]).toEqual({ x: 24, y: 120 });
    expect(def.paths[0][1]).toEqual({ x: 264, y: 120 });
    expect(def.paths[0][2]).toEqual({ x: 264, y: 360 });
    expect(def.paths[0][3]).toEqual({ x: 792, y: 360 });
  });

  it('userLevelToDef: multi-path', () => {
    const u: UserLevel = {
      id: 'user:m' as any,
      name: 'm',
      paths: [
        [{ col: 0, row: 1 }, { col: 16, row: 1 }],
        [{ col: 0, row: 5 }, { col: 16, row: 5 }],
      ],
      createdAt: 0,
    };
    const def = userLevelToDef(u);
    expect(def.paths.length).toBe(2);
  });

  it('loadUserLevels: Node environment returns empty array', () => {
    expect(loadUserLevels()).toEqual([]);
  });

  it('deleteUserLevel: returns array (no crash)', () => {
    const all = deleteUserLevel('user:1' as any);
    expect(Array.isArray(all)).toBe(true);
  });

  it('saveUserLevels: empty input ok', () => {
    saveUserLevels([]);
  });
});

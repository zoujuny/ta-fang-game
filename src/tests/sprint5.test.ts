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

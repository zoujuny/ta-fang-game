import Phaser from 'phaser';
import { GameScene, type GameState } from './scenes/GameScene';
import { GAME_WIDTH, GAME_HEIGHT, LEVELS, LEVEL_ORDER as LEVELS_ORDER, type LevelId } from './config/grid';
import { loadProgress, isLevelUnlocked } from './systems/progress';
import { TOWERS, type TowerKind } from './config/towers';

class BootScene extends Phaser.Scene {
  private gameScene?: GameScene;
  private bound = false;

  create() {
    this.scene.start('GameScene', { onState: (s: GameState) => this.onState(s) });
    this.bindDom();
    // 测试桥: 把 game 暴露到 window 方便 e2e 验证
    (window as unknown as { __phaser: Phaser.Game; __levelIds: LevelId[] }).__phaser = this.game;
    (window as unknown as { __levelIds: LevelId[] }).__levelIds = LEVELS_ORDER;
  }

  private ensureGameScene(): GameScene | undefined {
    if (!this.gameScene) {
      this.gameScene = this.scene.get('GameScene') as unknown as GameScene;
    }
    return this.gameScene;
  }

  private bindDom() {
    if (this.bound) return;
    this.bound = true;
    for (const k of ['arrow', 'cannon', 'frost', 'fire', 'shock', 'poison', 'holy', 'dark'] as TowerKind[]) {
      document.getElementById(`btn-${k}`)?.addEventListener('click', () => {
        this.ensureGameScene()?.selectTower(k);
      });
    }
    document.getElementById('start-btn')?.addEventListener('click', () => {
      this.ensureGameScene()?.startNextWave();
    });
    document.getElementById('reset-btn')?.addEventListener('click', () => {
      this.ensureGameScene()?.resetCurrentLevel();
    });
    document.querySelectorAll('.lvl-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const lvl = (btn as HTMLElement).dataset.level as LevelId | undefined;
        if (!lvl) return;
        const idx0 = LEVELS_ORDER.indexOf(lvl);
        const progress = loadProgress();
        if (!isLevelUnlocked(idx0, progress)) return;
        this.ensureGameScene()?.switchLevel(lvl);
      });
    });
    document.getElementById('hud')?.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private onState(s: GameState) {
    try {
      const gold = document.getElementById('gold');
      const lives = document.getElementById('lives');
      const wave = document.getElementById('wave');
      const levelName = document.getElementById('level-name');
      if (gold) gold.textContent = String(s.gold);
      if (lives) lives.textContent = String(s.lives);
      if (wave) {
        const idx = Math.min(s.waveIndex + 1, s.totalWaves);
        wave.textContent = `${idx}/${s.totalWaves}${s.waveInProgress ? ' (进行中)' : ''}`;
      }
      if (levelName) {
        const def = LEVELS[s.levelId];
        levelName.textContent = def ? `L${LEVELS_ORDER.indexOf(s.levelId) + 1} · ${def.name}` : s.levelId;
      }
      const progress = loadProgress();
      for (let i = 0; i < (window as unknown as { __levelIds: LevelId[] }).__levelIds.length; i++) {
        const lvl = (window as unknown as { __levelIds: LevelId[] }).__levelIds[i];
        const btn = document.querySelector(`.lvl-btn[data-level="${lvl}"]`);
        if (!btn) continue;
        btn.classList.toggle('active', s.levelId === lvl);
        const unlocked = isLevelUnlocked(i, progress);
        btn.classList.toggle('locked', !unlocked);
        if (!unlocked) {
          btn.setAttribute('title', `需通关 L${i} 解锁`);
        } else {
          btn.removeAttribute('title');
        }
      }
      for (const k of ['arrow', 'cannon', 'frost', 'fire', 'shock', 'poison', 'holy', 'dark'] as TowerKind[]) {
        const btn = document.getElementById(`btn-${k}`);
        if (!btn) continue;
        const cfg = TOWERS[k];
        btn.classList.toggle('disabled', s.gold < cfg.cost || s.gameOver);
        btn.classList.toggle('selected', s.selectedKind === k);
      }
      const startBtn = document.getElementById('start-btn') as HTMLButtonElement | null;
      if (startBtn) {
        if (s.gameOver) {
          startBtn.disabled = true;
          startBtn.textContent = s.victory ? '胜利!' : '失败';
        } else if (s.waveInProgress) {
          startBtn.disabled = true;
          startBtn.textContent = '出怪中…';
        } else if (s.waveIndex >= s.totalWaves) {
          startBtn.disabled = true;
          startBtn.textContent = '已通关';
        } else {
          startBtn.disabled = false;
          startBtn.textContent = '开始下一波';
        }
      }
      const overlay = document.getElementById('overlay');
      if (overlay) {
        if (s.gameOver) {
          overlay.classList.add('show');
          overlay.classList.toggle('win', s.victory);
          overlay.classList.toggle('lose', !s.victory);
          const h1 = overlay.querySelector('h1');
          if (h1) h1.textContent = s.victory ? '胜利!' : '失败';
        } else {
          overlay.classList.remove('show');
        }
      }
    } catch (err) {
      console.warn('HUD update error:', err);
    }
  }
}

const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game',
  backgroundColor: '#1a1a2e',
  scene: [BootScene, GameScene],
};

new Phaser.Game(gameConfig);

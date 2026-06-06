import Phaser from 'phaser';
import { GRID_COLS, GRID_ROWS, TILE_SIZE, GAME_HEIGHT, isBuildable, STARTING_GOLD, STARTING_LIVES, LEVELS, LEVEL_ORDER, levelScale, type LevelId, type LevelDef } from '../config/grid';
import { TOWERS, type TowerKind } from '../config/towers';
import { Monster } from '../entities/Monster';
import { Tower } from '../entities/Tower';
import { Projectile, type ReactionEvent } from '../entities/Projectile';
import { createWaveRuntime, tickWaveSpawns, isWaveComplete, type WaveRuntime } from '../systems/wave';
import { WAVES } from '../config/monsters';

interface SceneData {
  onState: (s: GameState) => void;
}

export interface GameState {
  gold: number;
  lives: number;
  waveIndex: number;
  totalWaves: number;
  waveInProgress: boolean;
  selectedKind: TowerKind | null;
  gameOver: boolean;
  victory: boolean;
  levelId: LevelId;
  totalLevels: number;
}

export class GameScene extends Phaser.Scene {
  public state: GameState;
  private level!: LevelDef;
  private towers: Tower[] = [];
  private monsters: Monster[] = [];
  private projectiles: Projectile[] = [];
  private chainFx: Array<{ line: Phaser.GameObjects.Line; until: number }> = [];
  private explosionFx: Array<{ circle: Phaser.GameObjects.Arc; until: number }> = [];
  private wave: WaveRuntime | null = null;
  private gridGfx!: Phaser.GameObjects.Graphics;
  private pathGfx!: Phaser.GameObjects.Graphics;
  private rangeGfx!: Phaser.GameObjects.Graphics;
  private hoverCell = { col: -1, row: -1 };
  private sceneData!: SceneData;
  private lastEmitted = '';

  constructor() {
    super('GameScene');
    this.state = {
      gold: STARTING_GOLD,
      lives: STARTING_LIVES,
      waveIndex: 0,
      totalWaves: WAVES.length,
      waveInProgress: false,
      selectedKind: null,
      gameOver: false,
      victory: false,
      levelId: 'level1',
      totalLevels: LEVEL_ORDER.length,
    };
  }

  init(data: unknown) {
    this.sceneData = data as SceneData;
  }

  create() {
    this.level = LEVELS[this.state.levelId];
    this.drawBackground();
    this.drawPaths();
    this.gridGfx = this.add.graphics().setDepth(1);
    this.rangeGfx = this.add.graphics().setDepth(2);

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const col = Math.floor(p.x / TILE_SIZE);
      const row = Math.floor(p.y / TILE_SIZE);
      this.hoverCell = { col, row };
      this.redrawGrid();
      this.redrawRange();
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.handleClick(p);
    });
  }

  private drawBackground() {
    // 全铺草地; 路径由 drawPaths 用 lineStyle 单独画
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        this.add.rectangle(
          c * TILE_SIZE + TILE_SIZE / 2,
          r * TILE_SIZE + TILE_SIZE / 2,
          TILE_SIZE,
          TILE_SIZE,
          0x3a5a40,
        );
      }
    }
  }

  private drawPaths() {
    this.pathGfx = this.add.graphics();
    for (const path of this.level.paths) {
      this.pathGfx.lineStyle(TILE_SIZE, 0xb38b59, 1);
      this.pathGfx.beginPath();
      this.pathGfx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) {
        this.pathGfx.lineTo(path[i].x, path[i].y);
      }
      this.pathGfx.strokePath();
    }
    // 终点(基地)
    const endPath = this.level.paths[this.level.paths.length - 1];
    const end = endPath[endPath.length - 1];
    this.add.circle(end.x, end.y, 14, 0xdc2626).setStrokeStyle(2, 0x111827);
    const tri = this.add.triangle(end.x, end.y - 24, 0, 8, 6, -4, -6, -4, 0xef4444);
    tri.setStrokeStyle(1, 0x111827);
  }

  private redrawGrid() {
    this.gridGfx.clear();
    const { col, row } = this.hoverCell;
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return;
    const canBuild = isBuildable(this.level, col, row) && !this.towers.some(t => t.col === col && t.row === row);
    const color = canBuild ? (this.state.selectedKind ? 0x4ade80 : 0x60a5fa) : 0xef4444;
    this.gridGfx.lineStyle(2, color, 0.9);
    this.gridGfx.strokeRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
  }

  private redrawRange() {
    this.rangeGfx.clear();
    if (!this.state.selectedKind) return;
    const { col, row } = this.hoverCell;
    if (!isBuildable(this.level, col, row)) return;
    const cfg = TOWERS[this.state.selectedKind];
    const x = col * TILE_SIZE + TILE_SIZE / 2;
    const y = row * TILE_SIZE + TILE_SIZE / 2;
    this.rangeGfx.lineStyle(2, cfg.color, 0.6);
    this.rangeGfx.fillStyle(cfg.color, 0.1);
    this.rangeGfx.strokeCircle(x, y, cfg.range);
    this.rangeGfx.fillCircle(x, y, cfg.range);
  }

  private handleClick(p: Phaser.Input.Pointer) {
    if (p.y >= GAME_HEIGHT) return;
    if (this.state.gameOver) return;
    const col = Math.floor(p.x / TILE_SIZE);
    const row = Math.floor(p.y / TILE_SIZE);
    if (!isBuildable(this.level, col, row)) return;
    if (this.towers.some(t => t.col === col && t.row === row)) return;
    const kind = this.state.selectedKind;
    if (!kind) return;
    const cost = TOWERS[kind].cost;
    if (this.state.gold < cost) return;
    this.state.gold -= cost;
    const tower = new Tower(this, kind, col, row, col * TILE_SIZE + TILE_SIZE / 2, row * TILE_SIZE + TILE_SIZE / 2);
    this.towers.push(tower);
    this.emitState();
  }

  public selectTower(kind: TowerKind) {
    this.state.selectedKind = kind;
    this.emitState();
  }

  public startNextWave() {
    if (this.state.gameOver) return;
    if (this.state.waveInProgress) return;
    if (this.state.waveIndex >= WAVES.length) return;
    this.wave = createWaveRuntime(this.state.waveIndex, this.time.now);
    this.state.waveInProgress = true;
    this.emitState();
  }

  public switchLevel(levelId: LevelId) {
    if (LEVEL_ORDER.indexOf(levelId) === -1) return;
    // 重置游戏状态
    this.towers.forEach(t => t.destroy());
    this.monsters.forEach(m => m.destroy());
    this.projectiles.forEach(p => p.destroy());
    this.chainFx.forEach(f => f.line.destroy());
    this.explosionFx.forEach(f => f.circle.destroy());
    this.towers = [];
    this.monsters = [];
    this.projectiles = [];
    this.chainFx = [];
    this.explosionFx = [];
    this.wave = null;
    this.state = {
      gold: STARTING_GOLD,
      lives: STARTING_LIVES,
      waveIndex: 0,
      totalWaves: WAVES.length,
      waveInProgress: false,
      selectedKind: null,
      gameOver: false,
      victory: false,
      levelId,
      totalLevels: LEVEL_ORDER.length,
    };
    this.level = LEVELS[levelId];
    // 清理画布
    this.children.removeAll();
    this.create();
    this.emitState();
  }

  update(_time: number, delta: number) {
    if (this.state.gameOver) return;
    const now = this.time.now;
    const dt = Math.min(delta, 50);

    if (this.wave) {
      const spawned = tickWaveSpawns(this.wave, now);
      const scale = levelScale(LEVEL_ORDER.indexOf(this.state.levelId));
      for (const s of spawned) {
        const pathIdx = this.level.paths.length > 1
          ? Math.floor(Math.random() * this.level.paths.length)
          : 0;
        const path = this.level.paths[pathIdx];
        const m = new Monster(this, s.kind, path, pathIdx, scale);
        this.monsters.push(m);
      }
    }

    for (const m of this.monsters) m.update(now, dt);

    for (const t of this.towers) {
      t.acquireTarget(this.monsters);
      const p = t.fire(this, now);
      if (p) this.projectiles.push(p);
    }

    for (const p of this.projectiles) p.update(dt);

    // 解析命中 + 元素反应
    for (const p of this.projectiles) {
      if (p.hit) {
        const res = p.resolve(this.monsters, now);
        if (res.reaction) {
          this.onReaction(res.reaction, p.target, now);
        }
      }
    }

    // 清理过期 projectile
    this.projectiles = this.projectiles.filter(p => {
      if (p.alive) return true;
      p.destroy();
      return false;
    });

    // 清理 FX
    this.chainFx = this.chainFx.filter(fx => {
      if (fx.until > now) return true;
      fx.line.destroy();
      return false;
    });
    this.explosionFx = this.explosionFx.filter(fx => {
      if (fx.until > now) return true;
      fx.circle.destroy();
      return false;
    });

    // 击杀/到达处理
    let goldEarned = 0;
    let livesLost = 0;
    this.monsters = this.monsters.filter(m => {
      if (m.alive) return true;
      if (m.reachedEnd) {
        livesLost += m.damage;
      } else {
        goldEarned += m.bounty;
      }
      m.destroy();
      return false;
    });
    if (goldEarned) this.state.gold += goldEarned;
    if (livesLost) this.state.lives -= livesLost;

    if (this.wave && this.state.waveInProgress && isWaveComplete(this.wave, this.monsters.length)) {
      this.state.gold += this.wave.def.reward;
      this.state.waveInProgress = false;
      this.state.waveIndex++;
      this.wave = null;
      if (this.state.waveIndex >= WAVES.length) {
        this.state.victory = true;
        this.state.gameOver = true;
      }
    }

    if (this.state.lives <= 0) {
      this.state.lives = 0;
      this.state.gameOver = true;
    }

    this.emitState();
  }

  private onReaction(evt: ReactionEvent, target: Monster, now: number) {
    if (evt.name === 'melt' && evt.splashRadius) {
      for (const m of this.monsters) {
        if (!m.alive) continue;
        const dx = m.x - evt.x;
        const dy = m.y - evt.y;
        if (dx * dx + dy * dy <= evt.splashRadius * evt.splashRadius) {
          m.takeDamage(evt.damage * 0.6);
          const d = Math.hypot(dx, dy) || 1;
          m.x += (dx / d) * 8;
          m.y += (dy / d) * 8;
        }
      }
      const circle = this.add.circle(evt.x, evt.y, evt.splashRadius, 0xfb923c, 0.5).setStrokeStyle(3, 0xfde047);
      this.explosionFx.push({ circle, until: now + 400 });
    } else if (evt.name === 'overload') {
      // burn+shock: 小爆 + 链到 chill 状态怪物
      const circle = this.add.circle(evt.x, evt.y, 50, 0xfde047, 0.5).setStrokeStyle(3, 0xfb923c);
      this.explosionFx.push({ circle, until: now + 350 });
      const chilled = this.monsters.filter(m => m.alive && m.statuses.has('chill') && m !== target);
      for (const m of chilled) {
        const line = this.add.line(0, 0, evt.x, evt.y, m.x, m.y, 0xfde047, 0.8).setLineWidth(2);
        this.chainFx.push({ line, until: now + 250 });
        m.takeDamage(evt.damage * 0.5);
      }
    } else if (evt.name === 'supercharge') {
      // chill+shock: 链到 burn 状态怪物
      const burning = this.monsters.filter(m => m.alive && m.statuses.has('burn') && m !== target);
      let count = 0;
      for (const m of burning) {
        if (count >= 2) break;
        const dx = m.x - evt.x;
        const dy = m.y - evt.y;
        if (dx * dx + dy * dy <= 140 * 140) {
          const line = this.add.line(0, 0, evt.x, evt.y, m.x, m.y, 0x67e8f9, 0.9).setLineWidth(2);
          this.chainFx.push({ line, until: now + 300 });
          m.takeDamage(evt.damage * 0.4);
          count++;
        }
      }
    }
  }

  private emitState() {
    const key = `${this.state.gold}|${this.state.lives}|${this.state.waveIndex}|${this.state.waveInProgress}|${this.state.selectedKind}|${this.state.gameOver}|${this.state.victory}|${this.state.levelId}`;
    if (key === this.lastEmitted) return;
    this.lastEmitted = key;
    this.sceneData.onState({ ...this.state });
  }
}

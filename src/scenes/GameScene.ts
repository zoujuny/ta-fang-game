import Phaser from 'phaser';
import { GRID_COLS, GRID_ROWS, TILE_SIZE, GAME_HEIGHT, GAME_WIDTH, isBuildable, STARTING_GOLD, STARTING_LIVES, LEVELS, LEVEL_ORDER, levelScale, type LevelId, type LevelDef } from '../config/grid';
import { TOWERS, type TowerKind } from '../config/towers';
import { Monster } from '../entities/Monster';
import { Tower } from '../entities/Tower';
import { Projectile, type ReactionEvent } from '../entities/Projectile';
import { createWaveRuntime, tickWaveSpawns, isWaveComplete, type WaveRuntime } from '../systems/wave';
import { WAVES } from '../config/monsters';
import { cameraShake, cameraFlash, spawnBurst } from '../systems/fx';
import { loadProgress, saveProgress, markCleared } from '../systems/progress';

interface SceneData {
  onState: (s: GameState) => void;
}

export interface GameStats {
  kills: number;
  livesStart: number;
  livesLeft: number;
  goldEarned: number;
  towersBuilt: number;
  waveReached: number;
  totalWaves: number;
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
  stats: GameStats;
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
  private manageGfx!: Phaser.GameObjects.Graphics;
  private hoverCell = { col: -1, row: -1 };
  private managedTower: Tower | null = null;
  private manageUpgradeBtn: Phaser.GameObjects.Container | null = null;
  private manageSellBtn: Phaser.GameObjects.Container | null = null;
  private sceneData!: SceneData;
  private lastEmitted = '';
  private victoryOverlay: Phaser.GameObjects.Container | null = null;

  private emptyStats(): GameStats {
    return {
      kills: 0,
      livesStart: STARTING_LIVES,
      livesLeft: STARTING_LIVES,
      goldEarned: 0,
      towersBuilt: 0,
      waveReached: 0,
      totalWaves: WAVES.length,
    };
  }

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
      stats: this.emptyStats(),
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
    this.manageGfx = this.add.graphics().setDepth(3);

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
    const existing = this.towers.find(t => t.col === col && t.row === row);
    if (existing) {
      this.enterManageMode(existing);
      return;
    }
    // 退出管理模式 (如在空地点击)
    this.exitManageMode();
    const kind = this.state.selectedKind;
    if (!kind) return;
    const cost = TOWERS[kind].cost;
    if (this.state.gold < cost) return;
    this.state.gold -= cost;
    const tower = new Tower(this, kind, col, row, col * TILE_SIZE + TILE_SIZE / 2, row * TILE_SIZE + TILE_SIZE / 2);
    this.towers.push(tower);
    this.state.stats.towersBuilt = this.towers.length;
    this.emitState();
  }

  private enterManageMode(t: Tower) {
    this.managedTower = t;
    this.state.selectedKind = null; // 退出选塔模式
    this.redrawManage();
  }

  private exitManageMode() {
    if (this.managedTower) {
      this.managedTower = null;
      this.manageGfx.clear();
      this.manageUpgradeBtn?.destroy();
      this.manageSellBtn?.destroy();
      this.manageUpgradeBtn = null;
      this.manageSellBtn = null;
    }
  }

  private redrawManage() {
    this.manageGfx.clear();
    this.manageUpgradeBtn?.destroy();
    this.manageSellBtn?.destroy();
    this.manageUpgradeBtn = null;
    this.manageSellBtn = null;
    if (!this.managedTower) return;
    const t = this.managedTower;
    // 选中光圈 (黄色实心方框)
    this.manageGfx.lineStyle(3, 0xfde047, 1);
    this.manageGfx.strokeRect(t.col * TILE_SIZE + 1, t.row * TILE_SIZE + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    // 升级按钮 (在塔上方)
    if (t.canUpgrade()) {
      const upCost = t.nextUpgradeCost();
      const canAfford = this.state.gold >= upCost;
      const upY = t.row * TILE_SIZE - 28;
      const upX = t.x;
      const c = this.add.container(upX, upY).setDepth(30);
      const w = 76, h = 22;
      const rect = this.add.rectangle(0, 0, w, h, canAfford ? 0x22c55e : 0x6b7280).setStrokeStyle(1, 0x111827);
      const txt = this.add.text(0, 0, `升级 L${t.level}→L${t.level + 1} (${upCost})`, { fontSize: '10px', color: '#fff' }).setOrigin(0.5);
      c.add([rect, txt]);
      c.setSize(w, h);
      c.setInteractive(new Phaser.Geom.Rectangle(-w/2, -h/2, w, h), Phaser.Geom.Rectangle.Contains);
      c.on('pointerdown', () => {
        this.upgradeManagedTower();
      });
      this.manageUpgradeBtn = c;
    }
    // 卖出按钮 (塔下方)
    const refund = t.sellValue();
    const dnY = t.row * TILE_SIZE + TILE_SIZE + 14;
    const dnX = t.x;
    const c2 = this.add.container(dnX, dnY).setDepth(30);
    const w2 = 60, h2 = 22;
    const rect2 = this.add.rectangle(0, 0, w2, h2, 0x6b7280).setStrokeStyle(1, 0x111827);
    const txt2 = this.add.text(0, 0, `卖出 +${refund}`, { fontSize: '10px', color: '#fde047' }).setOrigin(0.5);
    c2.add([rect2, txt2]);
    c2.setSize(w2, h2);
    c2.setInteractive(new Phaser.Geom.Rectangle(-w2/2, -h2/2, w2, h2), Phaser.Geom.Rectangle.Contains);
    c2.on('pointerdown', () => {
      this.sellManagedTower();
    });
    this.manageSellBtn = c2;
  }

  private upgradeManagedTower() {
    if (!this.managedTower) return;
    const t = this.managedTower;
    const cost = t.nextUpgradeCost();
    if (this.state.gold < cost) return;
    this.state.gold -= cost;
    t.upgrade();
    this.redrawManage();
    this.emitState();
  }

  private sellManagedTower() {
    if (!this.managedTower) return;
    const t = this.managedTower;
    this.state.gold += t.sellValue();
    this.towers = this.towers.filter(x => x !== t);
    t.destroy();
    this.state.stats.towersBuilt = this.towers.length;
    this.exitManageMode();
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

  public resetCurrentLevel() {
    this.switchLevel(this.state.levelId);
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
      stats: this.emptyStats(),
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

    // 神圣塔: 每 1.5s 给范围友军塔施加速 buff
    const HOLY_RADIUS = 80;
    const HOLY_FACTOR = 0.7;
    const HOLY_DURATION = 2000;
    const HOLY_TICK = 1500;
    for (const t of this.towers) {
      if (t.kind !== 'holy') continue;
      if (now - t.lastBuffTickAt < HOLY_TICK) continue;
      t.lastBuffTickAt = now;
      for (const other of this.towers) {
        if (other === t) continue;
        const dx = other.x - t.x;
        const dy = other.y - t.y;
        if (dx * dx + dy * dy <= HOLY_RADIUS * HOLY_RADIUS) {
          other.applyBuff(HOLY_FACTOR, HOLY_DURATION, now);
        }
      }
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
    let kills = 0;
    this.monsters = this.monsters.filter(m => {
      if (m.alive) return true;
      if (m.reachedEnd) {
        livesLost += m.damage;
      } else {
        goldEarned += m.bounty;
        kills++;
      }
      m.destroy();
      return false;
    });
    if (goldEarned) {
      const r = Math.round(goldEarned);
      this.state.gold += r;
      this.state.stats.goldEarned += r;
    }
    if (livesLost) this.state.lives -= Math.round(livesLost);
    this.state.stats.livesLeft = this.state.lives;
    this.state.stats.kills += kills;

    if (this.wave && this.state.waveInProgress && isWaveComplete(this.wave, this.monsters.length)) {
      this.state.gold += this.wave.def.reward;
      this.state.stats.goldEarned += this.wave.def.reward;
      this.state.waveInProgress = false;
      this.state.waveIndex++;
      this.state.stats.waveReached = this.state.waveIndex;
      this.wave = null;
      if (this.state.waveIndex >= WAVES.length) {
        this.state.victory = true;
        this.state.gameOver = true;
        // 写存档: 解锁下一关
        const idx0 = LEVEL_ORDER.indexOf(this.state.levelId);
        if (idx0 >= 0) {
          const cur = loadProgress();
          const next = markCleared(idx0, cur);
          if (next.clearedThrough !== cur.clearedThrough) {
            saveProgress(next);
          }
        }
        this.showVictoryOverlay();
      }
    }

    if (this.state.lives <= 0) {
      this.state.lives = 0;
      this.state.gameOver = true;
    } else if (!Number.isInteger(this.state.lives)) {
      this.state.lives = Math.round(this.state.lives);
    }

    this.emitState();
  }

  private onReaction(evt: ReactionEvent, target: Monster, now: number) {
    // 反应触发 → 屏幕震 + 色变
    cameraShake(this, 0.004, 150);
    const flashColors: Record<string, number> = { melt: 0xfb923c, overload: 0xfde047, supercharge: 0x67e8f9, shatter: 0xa3e635 };
    cameraFlash(this, flashColors[evt.name] ?? 0xffffff, 80, 0.2);
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
    } else if (evt.name === 'shatter') {
      // chill+poison: 清空目标所有状态 + 绿色碎片圈
      target.statuses.clear();
      target.slowFactor = 1;
      target.slowUntil = 0;
      target.stunnedUntil = 0;
      const circle = this.add.circle(evt.x, evt.y, 40, 0xa3e635, 0.5).setStrokeStyle(3, 0x65a30d);
      this.explosionFx.push({ circle, until: now + 350 });
    }
  }

  private showVictoryOverlay() {
    if (this.victoryOverlay) return;
    const c = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(500);
    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75);
    c.add(dim);

    const title = this.add.text(0, -180, '🏆 通关胜利!', { fontSize: '40px', color: '#fde047', fontStyle: 'bold' }).setOrigin(0.5);
    c.add(title);
    const sub = this.add.text(0, -130, LEVELS[this.state.levelId]?.name ?? '', { fontSize: '18px', color: '#fff' }).setOrigin(0.5);
    c.add(sub);

    const s = this.state.stats;
    const lines = [
      { label: '击杀怪物', value: `${s.kills}`, color: 0xfca5a5 },
      { label: '生命剩余', value: `${s.livesLeft} / ${s.livesStart}`, color: 0x86efac },
      { label: '金币总获得', value: `${s.goldEarned}`, color: 0xfde047 },
      { label: '塔总数', value: `${s.towersBuilt}`, color: 0x93c5fd },
      { label: '完成波次', value: `${s.waveReached} / ${s.totalWaves}`, color: 0xd8b4fe },
    ];
    let y = -70;
    for (const l of lines) {
      const t = this.add.text(0, y, `${l.label}: ${l.value}`, {
        fontSize: '18px', color: '#' + l.color.toString(16).padStart(6, '0'),
      }).setOrigin(0.5);
      c.add(t);
      y += 28;
    }

    const idx0 = LEVEL_ORDER.indexOf(this.state.levelId);
    const isLastLevel = idx0 >= LEVEL_ORDER.length - 1;
    if (!isLastLevel) {
      const btn = this.add.container(0, 130);
      const rect = this.add.rectangle(0, 0, 200, 50, 0x22c55e).setStrokeStyle(3, 0x15803d);
      const label = this.add.text(0, -8, '下一关 →', { fontSize: '20px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
      const sub2 = this.add.text(0, 14, '点击进入', { fontSize: '12px', color: '#bbf7d0' }).setOrigin(0.5);
      btn.add([rect, label, sub2]);
      btn.setSize(200, 50);
      btn.setInteractive(new Phaser.Geom.Rectangle(-100, -25, 200, 50), Phaser.Geom.Rectangle.Contains);
      btn.on('pointerdown', () => this.goToNextLevel());
      c.add(btn);
    } else {
      const final = this.add.text(0, 130, '🎉 全部 10 关通关!', { fontSize: '24px', color: '#fde047', fontStyle: 'bold' }).setOrigin(0.5);
      c.add(final);
    }

    const replay = this.add.container(-110, 195);
    const rect2 = this.add.rectangle(0, 0, 90, 32, 0x6b7280).setStrokeStyle(2, 0x374151);
    const lab2 = this.add.text(0, 0, '重玩本关', { fontSize: '13px', color: '#fff' }).setOrigin(0.5);
    replay.add([rect2, lab2]);
    replay.setSize(90, 32);
    replay.setInteractive(new Phaser.Geom.Rectangle(-45, -16, 90, 32), Phaser.Geom.Rectangle.Contains);
    replay.on('pointerdown', () => this.resetCurrentLevel());
    c.add(replay);

    const back = this.add.container(110, 195);
    const rect3 = this.add.rectangle(0, 0, 90, 32, 0x1f2937).setStrokeStyle(2, 0x374151);
    const lab3 = this.add.text(0, 0, '选关', { fontSize: '13px', color: '#fff' }).setOrigin(0.5);
    back.add([rect3, lab3]);
    back.setSize(90, 32);
    back.setInteractive(new Phaser.Geom.Rectangle(-45, -16, 90, 32), Phaser.Geom.Rectangle.Contains);
    back.on('pointerdown', () => {
      this.victoryOverlay = null;
      c.destroy();
    });
    c.add(back);

    this.victoryOverlay = c;

    // 彩带粒子
    for (let i = 0; i < 6; i++) {
      this.time.delayedCall(i * 200, () => {
        spawnBurst(this, {
          x: Math.random() * GAME_WIDTH,
          y: -20,
          count: 18,
          color: [0xfb923c, 0xfde047, 0x67e8f9, 0xa3e635, 0xfca5a5][i % 5],
          speed: 220,
          life: 1400,
          size: 4,
        });
      });
    }
  }

  public goToNextLevel() {
    const idx0 = LEVEL_ORDER.indexOf(this.state.levelId);
    if (idx0 < 0 || idx0 >= LEVEL_ORDER.length - 1) return;
    this.switchLevel(LEVEL_ORDER[idx0 + 1]);
  }

  private emitState() {
    const key = `${this.state.gold}|${this.state.lives}|${this.state.waveIndex}|${this.state.waveInProgress}|${this.state.selectedKind}|${this.state.gameOver}|${this.state.victory}|${this.state.levelId}`;
    if (key === this.lastEmitted) return;
    this.lastEmitted = key;
    this.sceneData.onState({ ...this.state });
  }
}

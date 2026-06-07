import { MONSTERS, BOSS, type MonsterKind } from '../config/monsters';
import { distanceAlongPath, totalPathLength } from '../systems/path';
import { effectiveDamage } from '../systems/combat';
import { tickStatus, type StatusEffect, type StatusKind } from '../systems/elements';
import { spawnBurst, popIn, shrinkOut, spawnFloater } from '../systems/fx';

export class Monster {
  public kind: MonsterKind;
  public x: number;
  public y: number;
  public hp: number;
  public maxHp: number;
  public speed: number;
  public bounty: number;
  public damage: number;
  public resistance: number;
  public radius: number;
  public color: number;

  public alive = true;
  public reachedEnd = false;
  public progress = 0; // pixels along its path
  public slowUntil = 0;
  public slowFactor = 1;
  public stunnedUntil = 0;

  public pathIndex: number;
  public path: Array<{ x: number; y: number }>;
  public pathLen: number;
  public statuses: Map<StatusKind, StatusEffect> = new Map();
  public activeReactions: Array<{ name: string; until: number }> = [];

  private container: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Arc;
  private emojiText: Phaser.GameObjects.Text;
  private hpBar: Phaser.GameObjects.Rectangle;
  private hpBg: Phaser.GameObjects.Rectangle;
  private slowTint: Phaser.GameObjects.Arc;
  private burnTint: Phaser.GameObjects.Arc;
  private shockTint: Phaser.GameObjects.Arc;
  private reactionGlow: Phaser.GameObjects.Arc | null = null;
  private reactionText: Phaser.GameObjects.Text | null = null;
  private reactionUntil = 0;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, kind: MonsterKind, path: Array<{ x: number; y: number }>, pathIndex: number, scale: { hpMul: number; speedMul: number; damageMul: number; bountyMul: number } = { hpMul: 1, speedMul: 1, damageMul: 1, bountyMul: 1 }) {
    this.scene = scene;
    this.kind = kind;
    this.path = path;
    this.pathIndex = pathIndex;
    this.pathLen = totalPathLength(path);
    const cfg = kind === 'boss' ? BOSS : MONSTERS[kind];
    this.hp = cfg.hp * scale.hpMul;
    this.maxHp = this.hp;
    this.speed = cfg.speed * scale.speedMul;
    this.bounty = cfg.bounty * scale.bountyMul;
    this.damage = cfg.damage * scale.damageMul;
    this.resistance = cfg.resistance ?? 0;
    this.radius = cfg.radius;
    this.color = cfg.color;

    const start = distanceAlongPath(path, 0);
    this.x = start.x;
    this.y = start.y;

    this.container = scene.add.container(this.x, this.y);
    this.body = scene.add.circle(0, 0, this.radius, this.color).setStrokeStyle(2, 0x111827);
    this.slowTint = scene.add.circle(0, 0, this.radius + 2, 0xbae6fd, 0);
    this.burnTint = scene.add.circle(0, 0, this.radius + 2, 0xfb923c, 0);
    this.shockTint = scene.add.circle(0, 0, this.radius + 2, 0xe9d5ff, 0);
    this.hpBg = scene.add.rectangle(0, -this.radius - 6, this.radius * 2, 3, 0x000000, 0.6).setOrigin(0.5);
    this.hpBar = scene.add.rectangle(0, -this.radius - 6, this.radius * 2, 3, 0x4ade80).setOrigin(0.5);
    const emojiSize = Math.max(12, this.radius * 1.7);
    this.emojiText = scene.add.text(0, 0, cfg.emoji, {
      fontSize: `${emojiSize}px`,
    }).setOrigin(0.5);
    this.container.add([this.body, this.slowTint, this.burnTint, this.shockTint, this.emojiText, this.hpBg, this.hpBar]);
    // 出生弹入动画
    this.container.setScale(0);
    popIn(this.container, 350);
  }

  applySlow(factor: number, durationMs: number, now: number) {
    const expire = now + durationMs;
    if (expire > this.slowUntil) {
      this.slowUntil = expire;
      this.slowFactor = factor;
    }
  }

  applyStatus(kind: StatusKind, effect: StatusEffect) {
    this.statuses.set(kind, effect);
  }

  triggerReaction(name: string, durationMs: number, now: number) {
    this.activeReactions.push({ name, until: now + durationMs });
    if (name === 'melt' || name === 'overload' || name === 'supercharge') {
      this.reactionUntil = now + durationMs;
      if (this.reactionGlow) this.reactionGlow.destroy();
      if (this.reactionText) this.reactionText.destroy();
      const colorMap: Record<string, number> = { melt: 0xfb923c, overload: 0xfde047, supercharge: 0x67e8f9 };
      this.reactionGlow = this.scene.add.circle(0, 0, this.radius + 6, colorMap[name] ?? 0xffffff, 0.7).setStrokeStyle(2, 0xffffff);
      this.reactionText = this.scene.add.text(0, -this.radius - 18, name === 'melt' ? '融化' : name === 'overload' ? '超载' : '超导', {
        fontSize: '11px',
        color: '#fff',
        backgroundColor: '#000',
        padding: { x: 3, y: 1 },
      }).setOrigin(0.5);
      this.container.add([this.reactionGlow, this.reactionText]);
    }
  }

  takeDamage(raw: number) {
    if (!this.alive) return;
    const d = effectiveDamage(raw, this.resistance);
    this.hp -= d;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.playDeathFx();
    }
  }

  update(now: number, dt: number) {
    if (!this.alive) return;

    // 状态 tick (DoT)
    const present = tickStatus(this.statuses, this, now, dt);

    // 眩晕期间不走
    if (now < this.stunnedUntil) {
      this.refreshVisuals(present);
      this.container.setPosition(this.x, this.y);
      this.hpBar.scaleX = Math.max(0, this.hp / this.maxHp);
      this.hpBar.setX(0);
      return;
    }

    const factor = now < this.slowUntil ? this.slowFactor : 1;
    if (factor === 1 && this.slowFactor !== 1) {
      this.slowFactor = 1;
      this.slowUntil = 0;
    }
    this.progress += this.speed * factor * (dt / 1000);
    const p = distanceAlongPath(this.path, this.progress);
    this.x = p.x;
    this.y = p.y;
    this.container.setPosition(this.x, this.y);
    this.hpBar.scaleX = Math.max(0, this.hp / this.maxHp);
    this.hpBar.setX(0);
    this.refreshVisuals(present);

    if (this.progress >= this.pathLen) {
      this.reachedEnd = true;
      this.alive = false;
    }
  }

  private refreshVisuals(present: Set<StatusKind>) {
    this.slowTint.setFillStyle(0xbae6fd, present.has('chill') ? 0.45 : 0);
    this.burnTint.setFillStyle(0xfb923c, present.has('burn') ? 0.45 : 0);
    this.shockTint.setFillStyle(0xe9d5ff, present.has('shock') ? 0.45 : 0);
    if (this.reactionGlow && Date.now() > this.reactionUntil) {
      this.reactionGlow.destroy();
      this.reactionGlow = null;
      this.reactionText?.destroy();
      this.reactionText = null;
    }
  }

  private deathFxPlayed = false;
  private playDeathFx() {
    if (this.deathFxPlayed) return;
    this.deathFxPlayed = true;
    // 死亡: 缩到 0 + 4 个颜色碎片 + 金币飘字
    spawnBurst(this.scene, { x: this.x, y: this.y, count: 6, color: this.color, speed: 100, life: 400, size: 3 });
    if (this.bounty > 0) {
      spawnFloater(this.scene, {
        x: this.x,
        y: this.y - this.radius - 4,
        text: `+${Math.round(this.bounty)}`,
        color: 0xfde047,
        fontSize: 14,
        rise: 24,
        duration: 800,
      });
    }
    // 渐隐动画
    shrinkOut(this.container, 200);
  }

  destroy() {
    this.container.destroy();
  }
}

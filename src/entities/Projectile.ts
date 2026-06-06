import { Monster } from './Monster';
import { applySplash } from '../systems/combat';
import type { Element } from '../config/towers';
import { pickReactionByElement, ELEMENT_TO_STATUS, type StatusEffect } from '../systems/elements';
import { spawnFloater } from '../systems/fx';

export interface ProjectileOptions {
  splashRadius: number;
  slowFactor: number;
  slowDuration: number;
  element: Element;
  burnDps: number;
  burnDuration: number;
  shockDuration: number;
  shockChainDamage: number;
}

export interface ReactionEvent {
  x: number;
  y: number;
  name: 'melt' | 'overload' | 'supercharge';
  damage: number;
  splashRadius?: number;
  stunMs?: number;
}

export class Projectile {
  public x: number;
  public y: number;
  public target: Monster;
  public speed: number;
  public damage: number;
  public color: number;
  public options: ProjectileOptions;
  public alive = true;
  public hit = false;
  public reactionEvent: ReactionEvent | null = null;

  private sprite: Phaser.GameObjects.Arc;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, x: number, y: number, target: Monster, speed: number, damage: number, color: number, options: ProjectileOptions) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.target = target;
    this.speed = speed;
    this.damage = damage;
    this.color = color;
    this.options = options;
    this.sprite = scene.add.circle(x, y, 4, color).setStrokeStyle(1, 0x111827);
  }

  update(dt: number) {
    if (!this.alive || !this.target.alive) {
      this.alive = false;
      return;
    }
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const dist = Math.hypot(dx, dy);
    const step = this.speed * (dt / 1000);
    if (step >= dist) {
      this.x = this.target.x;
      this.y = this.target.y;
      this.hit = true;
      this.alive = false;
    } else {
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
    }
    this.sprite.setPosition(this.x, this.y);
  }

  resolve(monsters: Monster[], now: number): { hit: number; reaction: ReactionEvent | null } {
    let reaction: ReactionEvent | null = null;

    if (this.options.splashRadius > 0) {
      applySplash(this.x, this.y, this.options.splashRadius, monsters, this.damage);
    }
    if (this.target && this.target.alive) {
      const preStatuses = new Set(this.target.statuses.keys());

      const beforeHp = this.target.hp;
      this.target.takeDamage(this.damage);
      const dealt = Math.max(0, beforeHp - this.target.hp);
      if (dealt > 0) {
        spawnFloater(this.scene, {
          x: this.target.x,
          y: this.target.y - this.target.radius - 8,
          text: `-${Math.round(dealt)}`,
          color: 0xffffff,
          fontSize: 16,
        });
      }
      if (this.options.slowFactor < 1 && this.options.slowDuration > 0) {
        this.target.applySlow(this.options.slowFactor, this.options.slowDuration, now);
      }
      // 施加状态
      if (this.options.element === 'frost' && this.options.slowDuration > 0) {
        this.target.applySlow(this.options.slowFactor || 0.5, this.options.slowDuration, now);
        this.target.applyStatus('chill', { kind: 'chill', until: now + this.options.slowDuration });
      }
      if (this.options.element === 'fire' && this.options.burnDps > 0) {
        const eff: StatusEffect = { kind: 'burn', until: now + this.options.burnDuration, dps: this.options.burnDps };
        this.target.applyStatus('burn', eff);
      }
      if (this.options.element === 'shock' && this.options.shockDuration > 0) {
        this.target.applyStatus('shock', { kind: 'shock', until: now + this.options.shockDuration });
      }
      // 反应检测: 新元素 + 预快照中的已有状态
      const r = pickReactionByElement(this.options.element, preStatuses);
      if (r) {
        const evt: ReactionEvent = {
          x: this.target.x,
          y: this.target.y,
          name: r.name,
          damage: r.damage,
          splashRadius: r.splashRadius,
          stunMs: r.stunMs,
        };
        reaction = evt;
        const beforeReactionHp = this.target.hp;
        this.target.takeDamage(r.damage);
        const reactionDealt = Math.max(0, beforeReactionHp - this.target.hp);
        const reactionLabels: Record<string, string> = { melt: '融化!', overload: '超载!', supercharge: '超导!' };
        const reactionColors: Record<string, number> = { melt: 0xfb923c, overload: 0xfde047, supercharge: 0x67e8f9 };
        spawnFloater(this.scene, {
          x: this.target.x,
          y: this.target.y - this.target.radius - 28,
          text: `${reactionLabels[r.name]} -${Math.round(reactionDealt)}`,
          color: reactionColors[r.name] ?? 0xffffff,
          fontSize: 20,
          rise: 50,
          duration: 900,
        });
        if (r.stunMs) {
          this.target.stunnedUntil = now + r.stunMs;
        }
        this.target.triggerReaction(r.name, 800, now);
        // 反应消耗涉及的两个状态, 但保留这次新施加的那个(让"火打到已冰"后, 仍有 burn 状态)
        const newStatus = ELEMENT_TO_STATUS[this.options.element];
        const a = r.a, b = r.b;
        for (const s of [a, b]) {
          if (s !== newStatus) this.target.statuses.delete(s);
        }
      }
    }
    return { hit: 1, reaction };
  }

  destroy() {
    this.sprite.destroy();
  }
}

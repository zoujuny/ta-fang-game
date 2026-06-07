import { TOWERS, type TowerKind, type Element } from '../config/towers';
import { inRange, pickTarget } from '../systems/combat';
import { Monster } from './Monster';
import { Projectile } from './Projectile';
import { spawnMuzzleFlash, spawnBurst } from '../systems/fx';

// 每级加成: 伤害 × 1.5, 射程 × 1.2, 射速 × 0.9
export function levelMultiplier(level: number): { damage: number; range: number; fireInterval: number } {
  if (level <= 1) return { damage: 1, range: 1, fireInterval: 1 };
  const l = level - 1; // 0 for L1, 1 for L2, 2 for L3
  return {
    damage: Math.pow(1.5, l),
    range: Math.pow(1.2, l),
    fireInterval: Math.pow(0.9, l),
  };
}

// 升级到 L(n+1) 需要的金币 = baseCost * n
export function upgradeCost(baseCost: number, currentLevel: number): number {
  return baseCost * currentLevel;
}

// 卖出返还 = totalSpent * 0.5
export function sellRefund(totalSpent: number): number {
  return Math.floor(totalSpent * 0.5);
}

export class Tower {
  public kind: TowerKind;
  public col: number;
  public row: number;
  public x: number;
  public y: number;
  public range: number;
  public damage: number;
  public fireInterval: number;
  public projectileSpeed: number;
  public splashRadius: number;
  public slowFactor: number;
  public slowDuration: number;
  public element: Element;
  public burnDps: number;
  public burnDuration: number;
  public shockDuration: number;
  public shockChainDamage: number;
  public color: number;
  public projectileColor: number;

  public level = 1;
  public lastFiredAt = 0;
  public target: Monster | null = null;
  public baseCost: number;
  public totalSpent: number;

  private container: Phaser.GameObjects.Container;
  private base: Phaser.GameObjects.Rectangle;
  private head: Phaser.GameObjects.Arc;
  private emojiText: Phaser.GameObjects.Text;
  private barrel: Phaser.GameObjects.Rectangle;
  private levelBadge: Phaser.GameObjects.Text | null = null;

  constructor(scene: Phaser.Scene, kind: TowerKind, col: number, row: number, pixelX: number, pixelY: number) {
    const cfg = TOWERS[kind];
    this.kind = kind;
    this.col = col;
    this.row = row;
    this.x = pixelX;
    this.y = pixelY;
    this.baseCost = cfg.cost;
    this.totalSpent = cfg.cost;
    this.range = cfg.range;
    this.damage = cfg.damage;
    this.fireInterval = cfg.fireInterval;
    this.projectileSpeed = cfg.projectileSpeed;
    this.splashRadius = cfg.splashRadius;
    this.slowFactor = cfg.slowFactor;
    this.slowDuration = cfg.slowDuration;
    this.element = cfg.element;
    this.burnDps = cfg.burnDps;
    this.burnDuration = cfg.burnDuration;
    this.shockDuration = cfg.shockDuration;
    this.shockChainDamage = cfg.shockChainDamage;
    this.color = cfg.color;
    this.projectileColor = cfg.projectileColor;

    this.container = scene.add.container(this.x, this.y);
    this.base = scene.add.rectangle(0, 0, 36, 36, 0x374151).setStrokeStyle(2, 0x111827);
    this.head = scene.add.circle(0, 0, 14, this.color).setStrokeStyle(2, 0x111827);
    this.emojiText = scene.add.text(0, 0, cfg.emoji, { fontSize: '20px' }).setOrigin(0.5);
    this.barrel = scene.add.rectangle(0, 0, 20, 8, 0x111827).setOrigin(0, 0.5);
    this.container.add([this.base, this.head, this.emojiText, this.barrel]);
    this.refreshVisuals();
  }

  // 升级到 L+1, 累加 totalSpent
  upgrade(): boolean {
    if (this.level >= 3) return false;
    this.level++;
    const m = levelMultiplier(this.level);
    const cfg = TOWERS[this.kind];
    this.damage = cfg.damage * m.damage;
    this.range = cfg.range * m.range;
    this.fireInterval = cfg.fireInterval * m.fireInterval;
    this.totalSpent += upgradeCost(cfg.cost, this.level - 1);
    this.refreshVisuals();
    return true;
  }

  // 升级到指定等级(支持任意 1..3)
  setLevel(target: number): void {
    target = Math.max(1, Math.min(3, target));
    while (this.level < target) {
      const ok = this.upgrade();
      if (!ok) break;
    }
  }

  canUpgrade(): boolean {
    return this.level < 3;
  }

  nextUpgradeCost(): number {
    if (this.level >= 3) return 0;
    return upgradeCost(this.baseCost, this.level);
  }

  sellValue(): number {
    return sellRefund(this.totalSpent);
  }

  private refreshVisuals() {
    // 头圆描边: L1 黑(默认), L2 白(3), L3 金(0xfde047) + 厚
    if (this.level === 2) {
      this.head.setStrokeStyle(3, 0xffffff);
      this.emojiText.setScale(1.15);
    } else if (this.level >= 3) {
      this.head.setStrokeStyle(4, 0xfde047);
      this.emojiText.setScale(1.3);
    } else {
      this.head.setStrokeStyle(2, 0x111827);
      this.emojiText.setScale(1);
    }
    // 等级徽章
    if (this.level > 1) {
      if (!this.levelBadge) {
        this.levelBadge = this.container.scene.add.text(0, 18, `L${this.level}`, {
          fontSize: '10px', color: '#fde047', fontStyle: 'bold',
          backgroundColor: '#000', padding: { x: 3, y: 1 },
        }).setOrigin(0.5);
        this.container.add(this.levelBadge);
      } else {
        this.levelBadge.setText(`L${this.level}`);
        this.levelBadge.setColor(this.level >= 3 ? '#fde047' : '#ffffff');
      }
    } else if (this.levelBadge) {
      this.levelBadge.destroy();
      this.levelBadge = null;
    }
  }

  acquireTarget(monsters: Monster[]): Monster | null {
    this.target = pickTarget(monsters, this.x, this.y, this.range);
    return this.target;
  }

  canFire(now: number): boolean {
    return now - this.lastFiredAt >= this.fireInterval;
  }

  fire(scene: Phaser.Scene, now: number): Projectile | null {
    if (!this.target || !this.target.alive) return null;
    if (!this.canFire(now)) return null;
    if (!inRange(this.x, this.y, this.target.x, this.target.y, this.range)) return null;
    this.lastFiredAt = now;
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const angle = Math.atan2(dy, dx);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    this.barrel.rotation = angle;
    const muzzleDist = 34;
    const mx = this.x + cos * muzzleDist;
    const my = this.y + sin * muzzleDist;
    spawnMuzzleFlash(scene, mx, my, this.color, 10);
    spawnBurst(scene, { x: mx, y: my, count: 6, color: this.projectileColor, speed: 80, life: 280, size: 2 });
    return new Projectile(scene, mx, my, this.target, this.projectileSpeed, this.damage, this.projectileColor, {
      splashRadius: this.splashRadius,
      slowFactor: this.slowFactor,
      slowDuration: this.slowDuration,
      element: this.element,
      burnDps: this.burnDps,
      burnDuration: this.burnDuration,
      shockDuration: this.shockDuration,
      shockChainDamage: this.shockChainDamage,
    });
  }

  destroy() {
    this.container.destroy();
  }
}

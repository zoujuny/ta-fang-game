import { TOWERS, type TowerKind, type Element } from '../config/towers';
import { inRange, pickTarget } from '../systems/combat';
import { Monster } from './Monster';
import { Projectile } from './Projectile';

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

  private container: Phaser.GameObjects.Container;
  private base: Phaser.GameObjects.Rectangle;
  private head: Phaser.GameObjects.Arc;
  private barrel: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, kind: TowerKind, col: number, row: number, pixelX: number, pixelY: number) {
    const cfg = TOWERS[kind];
    this.kind = kind;
    this.col = col;
    this.row = row;
    this.x = pixelX;
    this.y = pixelY;
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
    // barrel: 从中心 (0,0) 向 +X 方向延伸 20 像素,origin (0, 0.5)
    this.barrel = scene.add.rectangle(0, 0, 20, 8, 0x111827).setOrigin(0, 0.5);
    this.container.add([this.base, this.head, this.barrel]);
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
    // 子弹从炮口尖端发射 (head 半径 14 + barrel 长度 20 = 34)
    const muzzleDist = 34;
    const mx = this.x + cos * muzzleDist;
    const my = this.y + sin * muzzleDist;
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

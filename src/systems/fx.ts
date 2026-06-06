// 视觉特效: 飘字、粒子、震屏、色变
import Phaser from 'phaser';

// 飘字配置
export interface FloaterConfig {
  x: number;
  y: number;
  text: string;
  color: number;
  fontSize?: number;
  rise?: number;       // 上升像素
  duration?: number;   // ms
}

// 在 (x, y) 弹出飘字: 上升 + 淡出
export function spawnFloater(scene: Phaser.Scene, cfg: FloaterConfig): void {
  const t = scene.add.text(cfg.x, cfg.y, cfg.text, {
    fontSize: `${cfg.fontSize ?? 18}px`,
    color: '#' + cfg.color.toString(16).padStart(6, '0'),
    fontStyle: 'bold',
    stroke: '#000',
    strokeThickness: 3,
  }).setOrigin(0.5).setDepth(50);
  const rise = cfg.rise ?? 30;
  const dur = cfg.duration ?? 700;
  scene.tweens.add({
    targets: t,
    y: t.y - rise,
    alpha: 0,
    duration: dur,
    ease: 'Cubic.easeOut',
    onComplete: () => t.destroy(),
  });
}

// 粒子配置
export interface BurstConfig {
  x: number;
  y: number;
  count: number;
  color: number;
  speed?: number;       // 平均初速
  life?: number;        // 寿命 ms
  size?: number;
}

export function spawnBurst(scene: Phaser.Scene, cfg: BurstConfig): void {
  const count = cfg.count;
  const speed = cfg.speed ?? 120;
  const life = cfg.life ?? 500;
  const size = cfg.size ?? 3;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const v = speed * (0.7 + Math.random() * 0.6);
    const dx = Math.cos(angle) * v;
    const dy = Math.sin(angle) * v;
    const p = scene.add.circle(cfg.x, cfg.y, size, cfg.color).setDepth(45);
    scene.tweens.add({
      targets: p,
      x: cfg.x + dx,
      y: cfg.y + dy,
      alpha: 0,
      scale: 0.2,
      duration: life,
      ease: 'Cubic.easeOut',
      onComplete: () => p.destroy(),
    });
  }
}

// 闪光圆: 在 (x, y) 闪一下, 60ms 淡出
export function spawnMuzzleFlash(scene: Phaser.Scene, x: number, y: number, color: number, radius = 8): void {
  const flash = scene.add.circle(x, y, radius, color, 0.85).setStrokeStyle(2, 0xffffff).setDepth(40);
  scene.tweens.add({
    targets: flash,
    scale: 1.8,
    alpha: 0,
    duration: 120,
    ease: 'Cubic.easeOut',
    onComplete: () => flash.destroy(),
  });
}

// 屏幕震动
export function cameraShake(scene: Phaser.Scene, intensity = 0.005, duration = 200): void {
  scene.cameras.main.shake(duration, intensity);
}

// 屏幕色变 (tint)
export function cameraFlash(scene: Phaser.Scene, color = 0xffffff, duration = 100, alpha = 0.3): void {
  scene.cameras.main.flash(duration, (color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff, false, undefined, alpha);
}

// 弹入动画: scale 0 → 1.2 → 1 (弹性)
export function popIn(target: Phaser.GameObjects.GameObject & { scale: number }, duration = 300): void {
  target.scale = 0;
  if ('scene' in target && target.scene && 'tweens' in target.scene) {
    (target.scene as Phaser.Scene).tweens.add({
      targets: target,
      scale: { from: 0, to: 1.2 },
      duration: duration * 0.6,
      yoyo: false,
      ease: 'Back.easeOut',
      onComplete: () => {
        (target.scene as Phaser.Scene).tweens.add({
          targets: target,
          scale: 1,
          duration: duration * 0.4,
          ease: 'Bounce.easeOut',
        });
      },
    });
  }
}

// 缓动缓缩 (死亡)
export function shrinkOut(target: Phaser.GameObjects.GameObject & { scale: number }, duration = 200, onComplete?: () => void): void {
  if ('scene' in target && target.scene && 'tweens' in target.scene) {
    (target.scene as Phaser.Scene).tweens.add({
      targets: target,
      scale: 0,
      alpha: 0,
      duration,
      ease: 'Cubic.easeIn',
      onComplete,
    });
  } else if (onComplete) {
    onComplete();
  }
}

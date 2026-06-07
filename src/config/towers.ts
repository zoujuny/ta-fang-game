export type Element = 'phys' | 'frost' | 'fire' | 'shock';

export type TowerKind = 'arrow' | 'cannon' | 'frost' | 'fire' | 'shock';

export interface TowerConfig {
  kind: TowerKind;
  name: string;
  cost: number;
  range: number;       // pixels
  damage: number;
  fireInterval: number; // ms
  projectileSpeed: number; // pixels/sec
  splashRadius: number; // 0 = single target
  slowFactor: number;    // 1 = no slow, 0.5 = 50% slow
  slowDuration: number;  // ms
  element: Element;
  burnDps: number;        // per second when applying burn
  burnDuration: number;   // ms
  shockDuration: number;  // ms
  shockChainDamage: number; // 0 = no chain
  color: number;
  projectileColor: number;
  emoji: string;
}

export const TOWERS: Record<TowerKind, TowerConfig> = {
  arrow: {
    kind: 'arrow',
    name: '箭塔',
    cost: 50,
    range: 140,
    damage: 12,
    fireInterval: 600,
    projectileSpeed: 500,
    splashRadius: 0,
    slowFactor: 1,
    slowDuration: 0,
    element: 'phys',
    burnDps: 0,
    burnDuration: 0,
    shockDuration: 0,
    shockChainDamage: 0,
    color: 0x4ade80,
    projectileColor: 0xfde047,
    emoji: '🏹',
  },
  cannon: {
    kind: 'cannon',
    name: '炮塔',
    cost: 120,
    range: 160,
    damage: 35,
    fireInterval: 1400,
    projectileSpeed: 320,
    splashRadius: 50,
    slowFactor: 1,
    slowDuration: 0,
    element: 'phys',
    burnDps: 0,
    burnDuration: 0,
    shockDuration: 0,
    shockChainDamage: 0,
    color: 0xef4444,
    projectileColor: 0xfb923c,
    emoji: '💣',
  },
  frost: {
    kind: 'frost',
    name: '冰塔',
    cost: 80,
    range: 130,
    damage: 6,
    fireInterval: 900,
    projectileSpeed: 420,
    splashRadius: 0,
    slowFactor: 0.5,
    slowDuration: 1500,
    element: 'frost',
    burnDps: 0,
    burnDuration: 0,
    shockDuration: 0,
    shockChainDamage: 0,
    color: 0x60a5fa,
    projectileColor: 0xbae6fd,
    emoji: '❄️',
  },
  fire: {
    kind: 'fire',
    name: '火塔',
    cost: 100,
    range: 140,
    damage: 18,
    fireInterval: 800,
    projectileSpeed: 420,
    splashRadius: 0,
    slowFactor: 1,
    slowDuration: 0,
    element: 'fire',
    burnDps: 8,
    burnDuration: 4000,
    shockDuration: 0,
    shockChainDamage: 0,
    color: 0xfb923c,
    projectileColor: 0xfca5a5,
    emoji: '🔥',
  },
  shock: {
    kind: 'shock',
    name: '雷塔',
    cost: 150,
    range: 180,
    damage: 20,
    fireInterval: 1100,
    projectileSpeed: 520,
    splashRadius: 0,
    slowFactor: 1,
    slowDuration: 0,
    element: 'shock',
    burnDps: 0,
    burnDuration: 0,
    shockDuration: 3000,
    shockChainDamage: 12,
    color: 0xa855f7,
    projectileColor: 0xe9d5ff,
    emoji: '⚡',
  },
};

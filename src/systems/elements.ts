// 元素状态与反应
import type { Element } from '../config/towers';

export type StatusKind = 'burn' | 'chill' | 'shock';

export interface StatusEffect {
  kind: StatusKind;
  until: number;     // ms timestamp
  sourceX?: number;
  sourceY?: number;
  damage?: number;
  factor?: number;
  dps?: number;
}

// 每个元素 → 该状态 (元素-状态映射, 简化: 每个元素塔只施加 1 种状态)
export const ELEMENT_TO_STATUS: Record<Element, StatusKind | null> = {
  phys: null,
  frost: 'chill',
  fire: 'burn',
  shock: 'shock',
};

// 反应规则: [新施加的状态, 怪物身上已有的状态] -> 反应
// 对称触发: 任何顺序都触发同一反应
export interface ReactionRule {
  name: 'melt' | 'overload' | 'supercharge';
  a: StatusKind;
  b: StatusKind;
  damage: number;
  splashRadius?: number;
  stunMs?: number;
  // 视觉颜色
  color: number;
  labelZh: string;
}

export const REACTIONS: ReactionRule[] = [
  // 冰 + 火 = 融化(双向触发)
  { name: 'melt', a: 'chill', b: 'burn', damage: 60, splashRadius: 60, color: 0xfb923c, labelZh: '融化' },
  // 火 + 雷 = 超载(双向)
  { name: 'overload', a: 'burn', b: 'shock', damage: 40, color: 0xfde047, labelZh: '超载' },
  // 雷 + 冰 = 超导(双向)
  { name: 'supercharge', a: 'shock', b: 'chill', damage: 50, stunMs: 600, color: 0x67e8f9, labelZh: '超导' },
];

export function findReaction(a: StatusKind, b: StatusKind): ReactionRule | null {
  for (const r of REACTIONS) {
    if ((r.a === a && r.b === b) || (r.a === b && r.b === a)) return r;
  }
  return null;
}

// 给定新施加的元素, 检查怪物身上已存在的状态, 触发反应
export function pickReactionByElement(elemApplied: Element, existingStatuses: Set<StatusKind>): ReactionRule | null {
  const newStatus = ELEMENT_TO_STATUS[elemApplied];
  if (!newStatus) return null;
  for (const ex of existingStatuses) {
    if (ex === newStatus) continue;
    const r = findReaction(newStatus, ex);
    if (r) return r;
  }
  return null;
}

// 兼容旧 API: set-based 查询(用于测试)
export function pickReaction(statuses: Set<StatusKind>): ReactionRule | null {
  const arr = Array.from(statuses);
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      const r = findReaction(arr[i], arr[j]);
      if (r) return r;
    }
  }
  return null;
}

export function applyStatus(
  map: Map<StatusKind, StatusEffect>,
  kind: StatusKind,
  effect: StatusEffect,
) {
  const existing = map.get(kind);
  // 取较长的剩余时间
  if (existing && existing.until >= effect.until) return;
  map.set(kind, effect);
}

export function tickStatus(
  map: Map<StatusKind, StatusEffect>,
  monster: { hp: number; takeDamage: (d: number) => void },
  now: number,
  dtMs: number,
): Set<StatusKind> {
  const present = new Set<StatusKind>();
  for (const [k, eff] of map) {
    if (now >= eff.until) {
      map.delete(k);
      continue;
    }
    present.add(k);
    if (k === 'burn' && eff.dps) {
      const d = eff.dps * (dtMs / 1000);
      monster.takeDamage(d);
    }
  }
  return present;
}

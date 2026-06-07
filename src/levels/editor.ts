// 用户关卡编辑 + 持久化
// 路径用 waypoint 列表 (col, row) 整数坐标, 起点在 (0, X) 左边 / 终点在 (15, X) 右边表示走出画布

import type { LevelDef, LevelId } from '../config/grid';
import { GRID_COLS, GRID_ROWS, TILE_SIZE, bakeGrid } from '../config/grid';

export type UserLevelId = `user:${string}`;

export interface UserLevel {
  id: UserLevelId;
  name: string;
  paths: Array<Array<{ col: number; row: number }>>; // waypoint 列表
  createdAt: number;
}

const STORAGE_KEY = 'tafang.userlevels.v1';

export function loadUserLevels(): UserLevel[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as UserLevel[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveUserLevels(levels: UserLevel[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(levels));
  } catch {
    // 忽略
  }
}

export function upsertUserLevel(level: UserLevel): UserLevel[] {
  const all = loadUserLevels();
  const idx = all.findIndex(l => l.id === level.id);
  if (idx >= 0) all[idx] = level;
  else all.push(level);
  saveUserLevels(all);
  return all;
}

export function deleteUserLevel(id: UserLevelId): UserLevel[] {
  const all = loadUserLevels().filter(l => l.id !== id);
  saveUserLevels(all);
  return all;
}

// 转换: waypoint(col,row) 列表 → LevelDef
export function userLevelToDef(l: UserLevel): LevelDef {
  const paths = l.paths.map(waypoints =>
    waypoints.map(wp => ({ x: wp.col * TILE_SIZE + TILE_SIZE / 2, y: wp.row * TILE_SIZE + TILE_SIZE / 2 }))
  );
  return {
    id: l.id as unknown as LevelId,
    name: l.name,
    blurb: '用户关卡',
    grid: bakeGrid(makeEmptyGrid(), paths),
    paths,
    difficulty: 5,
  };
}

function makeEmptyGrid(): number[][] {
  return Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(0));
}

// 给新关卡分配 id
export function newUserLevelId(name: string): UserLevelId {
  const safe = name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32) || 'untitled';
  return `user:${Date.now()}_${safe}`;
}

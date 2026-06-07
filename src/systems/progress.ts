// 关卡进度存档 (localStorage)
const STORAGE_KEY = 'tafang.progress.v1';

export interface Progress {
  // 已通关到第几个关卡 (0=还没通关任何关, 1=已通关 L1 但 L2 仍可玩, etc.)
  // 用户可以选择任意已解锁关卡, 但更高关卡锁定
  clearedThrough: number; // 0..9
}

export function loadProgress(): Progress {
  if (typeof localStorage === 'undefined') return { clearedThrough: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { clearedThrough: 0 };
    const parsed = JSON.parse(raw) as Partial<Progress>;
    const n = Number(parsed.clearedThrough);
    if (!Number.isFinite(n) || n < 0) return { clearedThrough: 0 };
    return { clearedThrough: Math.min(9, Math.floor(n)) };
  } catch {
    return { clearedThrough: 0 };
  }
}

export function saveProgress(p: Progress): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // 忽略 (隐私模式/超限)
  }
}

export function isLevelUnlocked(idx0: number, p: Progress): boolean {
  return idx0 <= p.clearedThrough;
}

export function markCleared(idx0: number, p: Progress): Progress {
  if (idx0 >= p.clearedThrough) {
    return { clearedThrough: Math.min(9, idx0 + 1) };
  }
  return p;
}

export function effectiveDamage(rawDamage: number, resistance: number = 0): number {
  if (resistance < 0) resistance = 0;
  if (resistance > 1) resistance = 1;
  return rawDamage * (1 - resistance);
}

export function inRange(ax: number, ay: number, bx: number, by: number, range: number): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy <= range * range;
}

export function pickTarget<T extends { x: number; y: number; alive: boolean }>(
  candidates: T[],
  x: number,
  y: number,
  range: number,
): T | null {
  let best: T | null = null;
  let bestProgress = -Infinity;
  for (const c of candidates) {
    if (!c.alive) continue;
    if (!inRange(x, y, c.x, c.y, range)) continue;
    // 由具体系统提供 progress 字段时取最大 progress
    const p = (c as unknown as { progress?: number }).progress ?? 0;
    if (p > bestProgress) {
      bestProgress = p;
      best = c;
    }
  }
  return best;
}

export function applySplash(
  cx: number,
  cy: number,
  radius: number,
  targets: Array<{ x: number; y: number; alive: boolean; takeDamage: (d: number) => void }>,
  damage: number,
  resistance: number = 0,
): number {
  let hit = 0;
  const r2 = radius * radius;
  for (const t of targets) {
    if (!t.alive) continue;
    const dx = t.x - cx;
    const dy = t.y - cy;
    if (dx * dx + dy * dy <= r2) {
      t.takeDamage(effectiveDamage(damage, resistance));
      hit++;
    }
  }
  return hit;
}

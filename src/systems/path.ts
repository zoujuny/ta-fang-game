export function totalPathLength(waypoints: Array<{ x: number; y: number }>): number {
  let len = 0;
  for (let i = 1; i < waypoints.length; i++) {
    const a = waypoints[i - 1];
    const b = waypoints[i];
    len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return len;
}

export function distanceAlongPath(
  waypoints: Array<{ x: number; y: number }>,
  dist: number,
): { x: number; y: number } {
  if (waypoints.length === 0) return { x: 0, y: 0 };
  if (dist <= 0) return { ...waypoints[0] };
  let remaining = dist;
  for (let i = 1; i < waypoints.length; i++) {
    const a = waypoints[i - 1];
    const b = waypoints[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= seg) {
      const t = seg === 0 ? 0 : remaining / seg;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= seg;
  }
  return { ...waypoints[waypoints.length - 1] };
}

// 兼容旧 API: 假定单条路径
import { LEVELS } from '../config/grid';
const _defaultPath = LEVELS.level1.paths[0];
export function totalPathLengthDefault(): number {
  return totalPathLength(_defaultPath);
}
export function distanceAlongPathDefault(dist: number) {
  return distanceAlongPath(_defaultPath, dist);
}

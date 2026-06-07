export const TILE_SIZE = 48;
export const GRID_COLS = 16;
export const GRID_ROWS = 10;
export const GAME_WIDTH = TILE_SIZE * GRID_COLS; // 768
export const GAME_HEIGHT = TILE_SIZE * GRID_ROWS; // 480

export const STARTING_GOLD = 200;
export const STARTING_LIVES = 20;

export type LevelId =
  | 'level1' | 'level2' | 'level3' | 'level4' | 'level5'
  | 'level6' | 'level7' | 'level8' | 'level9' | 'level10';

export interface LevelDef {
  id: LevelId;
  name: string;
  blurb: string;
  grid: number[][]; // 0=buildable, 1=path
  paths: Array<Array<{ x: number; y: number }>>;
  difficulty: number; // 1..10
}

const p = (col: number, row: number) => ({
  x: col * TILE_SIZE + TILE_SIZE / 2,
  y: row * TILE_SIZE + TILE_SIZE / 2,
});

const empty = (): number[][] => Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(0));

// 把所有 path 段合并成"被 path 覆盖的格子集合"
// 用精确的"格子中心到线段最短距离"判断, 与 pathGfx 的 lineStyle 宽度一致 (TILE_SIZE)
function pathCoveredCells(paths: Array<Array<{ x: number; y: number }>>): Set<string> {
  const covered = new Set<string>();
  const radius = TILE_SIZE / 2;
  const r2 = radius * radius;

  // 合并所有段, 去重
  type Seg = { ax: number; ay: number; bx: number; by: number };
  const segs: Seg[] = [];
  for (const path of paths) {
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i];
      const b = path[i + 1];
      segs.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y });
    }
  }

  // 遍历每个格子, 看中心点是否落在某条线段的"宽 r"范围内
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const cx = c * TILE_SIZE + TILE_SIZE / 2;
      const cy = r * TILE_SIZE + TILE_SIZE / 2;
      for (const s of segs) {
        const dx = s.bx - s.ax;
        const dy = s.by - s.ay;
        const len2 = dx * dx + dy * dy;
        let t = 0;
        if (len2 > 0) {
          t = ((cx - s.ax) * dx + (cy - s.ay) * dy) / len2;
          if (t < 0) t = 0;
          if (t > 1) t = 1;
        }
        const px = s.ax + dx * t;
        const py = s.ay + dy * t;
        const ddx = cx - px;
        const ddy = cy - py;
        if (ddx * ddx + ddy * ddy <= r2) {
          covered.add(`${c},${r}`);
          break;
        }
      }
    }
  }
  return covered;
}

function bakeGrid(_base: number[][], paths: Array<Array<{ x: number; y: number }>>): number[][] {
  const g: number[][] = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(0));
  for (const key of pathCoveredCells(paths)) {
    const [c, r] = key.split(',').map(Number);
    if (r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS) g[r][c] = 1;
  }
  return g;
}

// L1 (网格对齐版本): 入口/折点/出口 全部用格子中心 (col*48+24, row*48+24)
const l1Paths = [[
  p(0, 1),
  p(5, 1),
  p(5, 4),
  p(11, 4),
  p(11, 7),
  p(GRID_COLS - 1, 7),
]];
const l1Grid = bakeGrid(empty(), l1Paths);

// L2 Y 形分叉: 单入口 → 中段强制分 2 路 → 末段汇合
const l2Paths = [
  // 上分支: 入口 → 拐点 → 上绕 → 下来汇合
  [p(0, 5), p(6, 5), p(6, 2), p(10, 2), p(10, 5), p(15, 5)],
  // 下分支: 入口 → 拐点 → 下绕 → 上来汇合
  [p(0, 5), p(6, 5), p(6, 8), p(10, 8), p(10, 5), p(15, 5)],
];
const l2Grid = bakeGrid(empty(), l2Paths);

// L3 双路径并行 (上 / 下, 各自独立终点)
const l3Paths = [
  [p(0, 2), p(15, 2)],           // 上路径
  [p(0, 7), p(15, 7)],           // 下路径
];
const l3Grid = bakeGrid(empty(), l3Paths);

// L4 U 形(从左下进入, 绕到右上)
const l4Paths = [
  [p(0, 9), p(2, 9), p(2, 0), p(13, 0), p(13, 9), p(15, 9)],
];
const l4Grid = bakeGrid(empty(), l4Paths);

// L5 螺旋(从外圈进入中心)
const l5Paths = [
  [p(0, 0), p(15, 0), p(15, 9), p(1, 9), p(1, 2), p(14, 2), p(14, 7), p(3, 7), p(3, 4), p(13, 4)],
];
const l5Grid = bakeGrid(empty(), l5Paths);

// L6 双汇合(两组独立汇合, 中心 X 形)
const l6Paths = [
  [p(0, 0), p(7, 0), p(7, 4), p(15, 4)],
  [p(15, 0), p(8, 0), p(8, 4), p(15, 4)],
  [p(0, 9), p(7, 9), p(7, 5), p(15, 5)],
  [p(15, 9), p(8, 9), p(8, 5), p(15, 5)],
];
const l6Grid = bakeGrid(empty(), l6Paths);

// L7 8 字交叉
const l7Paths = [
  [p(0, 7), p(7, 7), p(7, 2), p(15, 2)],
  [p(0, 2), p(8, 2), p(8, 7), p(15, 7)],
];
const l7Grid = bakeGrid(empty(), l7Paths);

// L8 中心辐射(4 条路径从四角进入中心)
const l8Paths = [
  [p(0, 0), p(7, 0), p(7, 4), p(15, 4)],
  [p(15, 0), p(8, 0), p(8, 4), p(15, 4)],
  [p(0, 9), p(7, 9), p(7, 4), p(15, 4)],
  [p(15, 9), p(8, 9), p(8, 4), p(15, 4)],
];
const l8Grid = bakeGrid(empty(), l8Paths);

// L9 菱形多段
const l9Paths = [
  [p(0, 4), p(4, 0), p(11, 0), p(15, 4), p(11, 9), p(4, 9), p(0, 4)],
];
const l9Grid = bakeGrid(empty(), l9Paths);

// L10 简化迷宫 (2 路径, 各 3 拐以内)
const l10Paths = [
  // 上路径: 入口 (0,1) → 右到 col 8 → 下到 row 4 → 右到 col 14 → 下到 row 7 → 终点
  [p(0, 1), p(8, 1), p(8, 4), p(14, 4), p(14, 7), p(15, 7)],
  // 下路径: 入口 (0,8) → 右到 col 4 → 上到 row 5 → 右到 col 12 → 下到 row 8 → 右到 col 15 → 上到 row 7 → 终点
  [p(0, 8), p(4, 8), p(4, 5), p(12, 5), p(12, 8), p(15, 8), p(15, 7)],
];
const l10Grid = bakeGrid(empty(), l10Paths);

export const LEVELS: Record<LevelId, LevelDef> = {
  level1:  { id: 'level1',  name: '蜿蜒',     blurb: '入门',         grid: l1Grid,  paths: l1Paths,  difficulty: 1 },
  level2:  { id: 'level2',  name: 'Y 形分叉', blurb: '2 路随机',     grid: l2Grid,  paths: l2Paths,  difficulty: 2 },
  level3:  { id: 'level3',  name: '平行',     blurb: '2 条独立',     grid: l3Grid,  paths: l3Paths,  difficulty: 3 },
  level4:  { id: 'level4',  name: 'U 形',     blurb: '绕场一周',     grid: l4Grid,  paths: l4Paths,  difficulty: 4 },
  level5:  { id: 'level5',  name: '螺旋',     blurb: '5 圈弯绕',     grid: l5Grid,  paths: l5Paths,  difficulty: 5 },
  level6:  { id: 'level6',  name: 'X 形',     blurb: '4 段双汇合',   grid: l6Grid,  paths: l6Paths,  difficulty: 6 },
  level7:  { id: 'level7',  name: '8 字',     blurb: '交叉绕行',     grid: l7Grid,  paths: l7Paths,  difficulty: 7 },
  level8:  { id: 'level8',  name: '辐射',     blurb: '4 路向心',     grid: l8Grid,  paths: l8Paths,  difficulty: 8 },
  level9:  { id: 'level9',  name: '菱形',     blurb: '环绕钻石',     grid: l9Grid,  paths: l9Paths,  difficulty: 9 },
  level10: { id: 'level10', name: '迷宫',     blurb: '4 路 4 拐',    grid: l10Grid, paths: l10Paths, difficulty: 10 },
};

export const LEVEL_ORDER: LevelId[] = [
  'level1', 'level2', 'level3', 'level4', 'level5',
  'level6', 'level7', 'level8', 'level9', 'level10',
];

// 难度因子: 1-based 关卡 → 怪物 scaling (指数曲线)
// idx0 = 关卡在 LEVEL_ORDER 的索引 (0..9)
export function levelScale(idx0: number) {
  const k = idx0; // 0..9
  return {
    hpMul: Math.pow(1.18, k),        // L1=1.00, L10=4.22
    speedMul: Math.pow(1.08, k),     // L1=1.00, L10=1.99
    damageMul: Math.pow(1.12, k),    // L1=1.00, L10=3.11
    bountyMul: Math.pow(1.10, k),    // L1=1.00, L10=2.36
  };
}

export function isBuildable(level: LevelDef, col: number, row: number): boolean {
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return false;
  return level.grid[row][col] === 0;
}

// 兼容旧 API
export const GRID = l1Grid;
export const PIXEL_PATH = LEVELS.level1.paths[0];

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

// 将一条 path 写进 grid: 把 path 上的格子标记为 1
function bakeGrid(base: number[][], paths: Array<Array<{ x: number; y: number }>>): number[][] {
  const g = base.map(r => r.slice());
  for (const path of paths) {
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i];
      const b = path[i + 1];
      const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
      const y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
      // 简单 Bresenham-ish: 水平或垂直段
      if (Math.abs(a.y - b.y) < 0.5) {
        const row = Math.round(a.y / TILE_SIZE);
        for (let c = Math.floor(x0 / TILE_SIZE); c <= Math.ceil(x1 / TILE_SIZE); c++) {
          if (row >= 0 && row < GRID_ROWS && c >= 0 && c < GRID_COLS) g[row][c] = 1;
        }
      } else if (Math.abs(a.x - b.x) < 0.5) {
        const col = Math.round(a.x / TILE_SIZE);
        for (let r = Math.floor(y0 / TILE_SIZE); r <= Math.ceil(y1 / TILE_SIZE); r++) {
          if (col >= 0 && col < GRID_COLS && r >= 0 && r < GRID_ROWS) g[r][col] = 1;
        }
      }
    }
  }
  return g;
}

// L1 (existing)
const l1Paths = [[
  { x: 0, y: TILE_SIZE * 1 },
  { x: TILE_SIZE * 5 + TILE_SIZE / 2, y: TILE_SIZE * 1 },
  { x: TILE_SIZE * 5 + TILE_SIZE / 2, y: TILE_SIZE * 4 + TILE_SIZE / 2 },
  { x: TILE_SIZE * 11 + TILE_SIZE / 2, y: TILE_SIZE * 4 + TILE_SIZE / 2 },
  { x: TILE_SIZE * 11 + TILE_SIZE / 2, y: TILE_SIZE * 7 + TILE_SIZE / 2 },
  { x: GAME_WIDTH, y: TILE_SIZE * 7 + TILE_SIZE / 2 },
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

// L10 复杂迷宫(4 路 4 拐)
const l10Paths = [
  [p(0, 0), p(3, 0), p(3, 3), p(1, 3), p(1, 6), p(4, 6), p(4, 9), p(8, 9), p(8, 6), p(12, 6), p(12, 9), p(15, 9)],
  [p(0, 2), p(6, 2), p(6, 5), p(10, 5), p(10, 2), p(14, 2), p(14, 5), p(15, 5)],
  [p(0, 5), p(2, 5), p(2, 8), p(5, 8), p(5, 5), p(7, 5)],
  [p(0, 8), p(9, 8), p(9, 4), p(13, 4), p(13, 1), p(15, 1)],
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

// 难度因子: 1-based 关卡 → 怪物 scaling
export function levelScale(idx0: number) {
  // idx0 = 关卡在 LEVEL_ORDER 的索引 (0..9)
  const t = (idx0 + 1) / 10; // 0.1 .. 1.0
  return {
    hpMul: 1 + t * 1.2,           // L1=1.12, L10=2.20
    speedMul: 1 + t * 0.5,        // L1=1.05, L10=1.50
    damageMul: 1 + t * 0.8,       // L1=1.08, L10=1.80
    bountyMul: 1 + t * 0.6,       // L1=1.06, L10=1.60
  };
}

export function isBuildable(level: LevelDef, col: number, row: number): boolean {
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return false;
  return level.grid[row][col] === 0;
}

// 兼容旧 API
export const GRID = l1Grid;
export const PIXEL_PATH = LEVELS.level1.paths[0];

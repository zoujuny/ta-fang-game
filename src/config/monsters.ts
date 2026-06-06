export type MonsterKind = 'orc' | 'bat' | 'golem';

export interface MonsterConfig {
  kind: MonsterKind;
  name: string;
  hp: number;
  speed: number;       // pixels/sec
  bounty: number;      // gold on kill
  damage: number;      // life damage on reach end
  resistance?: number;  // 0..1 damage reduction
  color: number;
  radius: number;
}

export const MONSTERS: Record<MonsterKind, MonsterConfig> = {
  orc: {
    kind: 'orc',
    name: '兽人',
    hp: 40,
    speed: 60,
    bounty: 8,
    damage: 1,
    color: 0x16a34a,
    radius: 14,
  },
  bat: {
    kind: 'bat',
    name: '飞虫',
    hp: 18,
    speed: 110,
    bounty: 6,
    damage: 1,
    color: 0xa855f7,
    radius: 10,
  },
  golem: {
    kind: 'golem',
    name: '重甲',
    hp: 140,
    speed: 32,
    bounty: 22,
    damage: 3,
    resistance: 0.4,
    color: 0x78716c,
    radius: 18,
  },
};

export interface WaveSpawn {
  kind: MonsterKind;
  count: number;
  interval: number; // ms between spawns
  delay: number;    // ms after wave start
}

export interface WaveDef {
  index: number;
  reward: number; // completion bonus
  spawns: WaveSpawn[];
}

export const WAVES: WaveDef[] = [
  {
    index: 0,
    reward: 20,
    spawns: [{ kind: 'orc', count: 8, interval: 800, delay: 0 }],
  },
  {
    index: 1,
    reward: 30,
    spawns: [
      { kind: 'orc', count: 10, interval: 700, delay: 0 },
      { kind: 'bat', count: 4, interval: 600, delay: 4000 },
    ],
  },
  {
    index: 2,
    reward: 40,
    spawns: [
      { kind: 'bat', count: 12, interval: 400, delay: 0 },
      { kind: 'orc', count: 8, interval: 600, delay: 3000 },
    ],
  },
  {
    index: 3,
    reward: 60,
    spawns: [
      { kind: 'golem', count: 2, interval: 2000, delay: 0 },
      { kind: 'orc', count: 12, interval: 500, delay: 1000 },
    ],
  },
  {
    index: 4,
    reward: 80,
    spawns: [
      { kind: 'golem', count: 4, interval: 1500, delay: 0 },
      { kind: 'bat', count: 15, interval: 350, delay: 500 },
    ],
  },
];

import { WAVES, type WaveDef, type WaveSpawn } from '../config/monsters';

export interface ActiveSpawn {
  def: WaveSpawn;
  spawned: number;
  nextAt: number; // ms timestamp
}

export interface WaveRuntime {
  def: WaveDef;
  activeSpawns: ActiveSpawn[];
  totalToSpawn: number;
  spawnedSoFar: number;
  done: boolean;
}

export function createWaveRuntime(waveIndex: number, now: number): WaveRuntime | null {
  const def = WAVES[waveIndex];
  if (!def) return null;
  return {
    def,
    spawnedSoFar: 0,
    totalToSpawn: def.spawns.reduce((s, sp) => s + sp.count, 0),
    done: false,
    activeSpawns: def.spawns.map((sp) => ({
      def: sp,
      spawned: 0,
      nextAt: now + sp.delay,
    })),
  };
}

export interface SpawnedThisTick {
  kind: WaveSpawn['kind'];
}

export function tickWaveSpawns(rt: WaveRuntime, now: number): SpawnedThisTick[] {
  if (rt.done) return [];
  const out: SpawnedThisTick[] = [];
  for (const sp of rt.activeSpawns) {
    while (sp.spawned < sp.def.count && now >= sp.nextAt) {
      sp.spawned++;
      rt.spawnedSoFar++;
      sp.nextAt += sp.def.interval;
      out.push({ kind: sp.def.kind });
    }
  }
  if (rt.spawnedSoFar >= rt.totalToSpawn) {
    rt.done = true;
  }
  return out;
}

export function isWaveComplete(rt: WaveRuntime, aliveMonsters: number): boolean {
  return rt.done && aliveMonsters === 0;
}

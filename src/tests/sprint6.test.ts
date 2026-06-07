import { describe, it, expect } from 'vitest';
import { getAudio } from '../systems/audio';

describe('AudioManager', () => {
  it('getAudio returns singleton', () => {
    const a1 = getAudio();
    const a2 = getAudio();
    expect(a1).toBe(a2);
  });

  it('default not muted', () => {
    expect(getAudio().isMuted()).toBe(false);
  });

  it('mute toggles correctly', () => {
    const a = getAudio();
    a.setMuted(true);
    expect(a.isMuted()).toBe(true);
    a.setMuted(false);
    expect(a.isMuted()).toBe(false);
  });

  it('volume clamped 0..1', () => {
    const a = getAudio();
    a.setVolume(2);
    expect(a.getVolume()).toBe(1);
    a.setVolume(-0.5);
    expect(a.getVolume()).toBe(0);
    a.setVolume(0.7);
    expect(a.getVolume()).toBe(0.7);
  });

  it('all sound methods callable without throwing', () => {
    const a = getAudio();
    // Node 环境无 AudioContext, 方法应静默 return
    const fns = ['fire', 'hit', 'monsterDeath', 'monsterReachedEnd', 'reaction',
      'build', 'upgrade', 'sell', 'waveStart', 'bossSpawn', 'victory', 'defeat'] as const;
    for (const fn of fns) {
      expect(() => (a as any)[fn]()).not.toThrow();
    }
    // reaction 子类型
    expect(() => a.reaction('melt')).not.toThrow();
    expect(() => a.reaction('overload')).not.toThrow();
    expect(() => a.reaction('supercharge')).not.toThrow();
    expect(() => a.reaction('shatter')).not.toThrow();
    // fire 子类型
    expect(() => a.fire('phys')).not.toThrow();
    expect(() => a.fire('cannon')).not.toThrow();
    expect(() => a.fire('frost')).not.toThrow();
    expect(() => a.fire('fire')).not.toThrow();
    expect(() => a.fire('shock')).not.toThrow();
    expect(() => a.fire('poison')).not.toThrow();
    expect(() => a.fire('holy')).not.toThrow();
    expect(() => a.fire('dark')).not.toThrow();
  });

  it('muted methods do not throw even if they reach AudioContext', () => {
    const a = getAudio();
    a.setMuted(true);
    expect(() => a.fire('phys')).not.toThrow();
    a.setMuted(false);
  });
});

import { describe, it, expect } from 'vitest';

// 神圣塔 buff 纯逻辑 (Tower.applyBuff + canFire)
class FakeTower {
  lastFiredAt = 0;
  fireInterval = 1000;
  buffUntil = 0;
  buffFactor = 1;
  canFire(now: number): boolean {
    const eff = now < this.buffUntil ? this.buffFactor : 1;
    return now - this.lastFiredAt >= this.fireInterval * eff;
  }
  applyBuff(factor: number, durationMs: number, now: number) {
    const expire = now + durationMs;
    if (expire > this.buffUntil) {
      this.buffUntil = expire;
      this.buffFactor = factor;
    }
  }
}

describe('Tower buff (holy aura)', () => {
  it('initial canFire waits full interval', () => {
    const t = new FakeTower();
    t.lastFiredAt = 0;
    expect(t.canFire(500)).toBe(false);
    expect(t.canFire(1000)).toBe(true);
  });
  it('buff factor 0.7 reduces effective wait to 700ms', () => {
    const t = new FakeTower();
    t.lastFiredAt = 0;
    t.applyBuff(0.7, 2000, 0);
    expect(t.canFire(500)).toBe(false);
    expect(t.canFire(700)).toBe(true);
  });
  it('expire reverts to normal', () => {
    const t = new FakeTower();
    t.lastFiredAt = 0;
    t.applyBuff(0.7, 1000, 0); // expire at 1000
    // 700: buff 生效 (eff 0.7), 700 >= 700 ✓ 可开火
    expect(t.canFire(700)).toBe(true);
    // 重新设置 lastFiredAt=700, buff 仍生效
    t.lastFiredAt = 700;
    // 1000: buff 刚好到期, eff=1, 1000-700=300 < 1000 ✗ 不可开火
    expect(t.canFire(1000)).toBe(false);
    // 1700: buff 失效, eff=1, 1700-700=1000 >= 1000 ✓
    expect(t.canFire(1700)).toBe(true);
  });
  it('stacking keeps longer expire', () => {
    const t = new FakeTower();
    t.applyBuff(0.5, 500, 0);  // expire 500
    t.applyBuff(0.7, 2000, 0); // expire 2000 胜出
    expect(t.buffUntil).toBe(2000);
    expect(t.buffFactor).toBe(0.7);
  });
});

// 暗塔 curse 纯逻辑
class FakeMonster {
  hp = 100;
  resistance = 0;
  cursedUntil = 0;
  takeDamage(raw: number) { this.hp -= raw; }
  applyCurse(now: number, dur: number) {
    const expire = now + dur;
    if (expire > this.cursedUntil) this.cursedUntil = expire;
  }
  consumeCurse(now: number): number {
    if (now < this.cursedUntil) {
      this.cursedUntil = 0;
      return 0.5;
    }
    return 0;
  }
}

describe('Monster curse (dark debuff)', () => {
  it('no curse -> no bonus', () => {
    const m = new FakeMonster();
    expect(m.consumeCurse(0)).toBe(0);
  });
  it('curse applied + consume within window -> 0.5 bonus', () => {
    const m = new FakeMonster();
    m.applyCurse(0, 3000);
    expect(m.consumeCurse(1000)).toBe(0.5);
    // 已消耗
    expect(m.consumeCurse(1500)).toBe(0);
  });
  it('curse expired -> no bonus', () => {
    const m = new FakeMonster();
    m.applyCurse(0, 1000);
    expect(m.consumeCurse(2000)).toBe(0);
  });
  it('stacking keeps longer expire', () => {
    const m = new FakeMonster();
    m.applyCurse(0, 1000);
    m.applyCurse(500, 2000); // 500+2000=2500, 胜出
    expect(m.cursedUntil).toBe(2500);
  });
});

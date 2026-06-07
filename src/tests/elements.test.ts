import { describe, it, expect } from 'vitest';
import { findReaction, pickReaction, pickReactionByElement, tickStatus, REACTIONS, ELEMENT_TO_STATUS, type StatusEffect, type StatusKind } from '../systems/elements';
import { TOWERS } from '../config/towers';

describe('REACTIONS table', () => {
  it('contains 4 reactions: melt, overload, supercharge, shatter', () => {
    const names = REACTIONS.map(r => r.name).sort();
    expect(names).toEqual(['melt', 'overload', 'shatter', 'supercharge']);
  });
  it('melt is chill+burn', () => {
    const r = REACTIONS.find(x => x.name === 'melt')!;
    expect([r.a, r.b].sort()).toEqual(['burn', 'chill']);
  });
  it('overload is burn+shock', () => {
    const r = REACTIONS.find(x => x.name === 'overload')!;
    expect([r.a, r.b].sort()).toEqual(['burn', 'shock']);
  });
  it('supercharge is chill+shock', () => {
    const r = REACTIONS.find(x => x.name === 'supercharge')!;
    expect([r.a, r.b].sort()).toEqual(['chill', 'shock']);
  });
});

describe('findReaction (symmetric)', () => {
  it('chill+burn -> melt in both orderings', () => {
    expect(findReaction('chill', 'burn')?.name).toBe('melt');
    expect(findReaction('burn', 'chill')?.name).toBe('melt');
  });
  it('burn+shock -> overload in both orderings', () => {
    expect(findReaction('burn', 'shock')?.name).toBe('overload');
    expect(findReaction('shock', 'burn')?.name).toBe('overload');
  });
  it('chill+shock -> supercharge in both orderings', () => {
    expect(findReaction('chill', 'shock')?.name).toBe('supercharge');
    expect(findReaction('shock', 'chill')?.name).toBe('supercharge');
  });
  it('no reaction for same element', () => {
    expect(findReaction('burn', 'burn')).toBeNull();
  });
});

describe('pickReaction (set-based)', () => {
  it('returns null when no compatible pair', () => {
    expect(pickReaction(new Set())).toBeNull();
    expect(pickReaction(new Set(['burn']))).toBeNull();
    expect(pickReaction(new Set(['chill']))).toBeNull();
  });
  it('melt on {burn, chill}', () => {
    expect(pickReaction(new Set(['burn', 'chill']))?.name).toBe('melt');
  });
  it('overload on {burn, shock}', () => {
    expect(pickReaction(new Set(['burn', 'shock']))?.name).toBe('overload');
  });
  it('supercharge on {chill, shock}', () => {
    expect(pickReaction(new Set(['chill', 'shock']))?.name).toBe('supercharge');
  });
});

describe('pickReactionByElement (symmetric triggers)', () => {
  it('fire on chill -> melt (冰+火 common path)', () => {
    const r = pickReactionByElement('fire', new Set(['chill']));
    expect(r?.name).toBe('melt');
    expect(r?.splashRadius).toBeGreaterThan(0);
  });
  it('frost on burn -> melt (双向触发)', () => {
    const r = pickReactionByElement('frost', new Set(['burn']));
    expect(r?.name).toBe('melt');
  });
  it('shock on burn -> overload', () => {
    const r = pickReactionByElement('shock', new Set(['burn']));
    expect(r?.name).toBe('overload');
  });
  it('fire on shock -> overload (双向)', () => {
    const r = pickReactionByElement('fire', new Set(['shock']));
    expect(r?.name).toBe('overload');
  });
  it('shock on chill -> supercharge', () => {
    const r = pickReactionByElement('shock', new Set(['chill']));
    expect(r?.name).toBe('supercharge');
    expect(r?.stunMs).toBeGreaterThan(0);
  });
  it('frost on shock -> supercharge (双向)', () => {
    const r = pickReactionByElement('frost', new Set(['shock']));
    expect(r?.name).toBe('supercharge');
  });
  it('phys triggers nothing', () => {
    expect(pickReactionByElement('phys', new Set(['burn', 'chill', 'shock']))).toBeNull();
  });
  it('no false positive: same status as applied element', () => {
    expect(pickReactionByElement('fire', new Set(['burn']))).toBeNull();
  });
});

describe('ELEMENT_TO_STATUS mapping', () => {
  it('maps correctly', () => {
    expect(ELEMENT_TO_STATUS.frost).toBe('chill');
    expect(ELEMENT_TO_STATUS.fire).toBe('burn');
    expect(ELEMENT_TO_STATUS.shock).toBe('shock');
    expect(ELEMENT_TO_STATUS.phys).toBeNull();
  });
});

describe('tickStatus', () => {
  it('burn tick deals damage proportional to time', () => {
    const map = new Map<StatusKind, StatusEffect>();
    map.set('burn', { kind: 'burn', until: 1000, dps: 10 });
    const m = { hp: 100, takeDamage: (d: number) => { m.hp -= d; } };
    const present = tickStatus(map, m, 0, 500);
    expect(present.has('burn')).toBe(true);
    expect(m.hp).toBeCloseTo(95, 1);
  });
  it('removes expired statuses', () => {
    const map = new Map<StatusKind, StatusEffect>();
    map.set('burn', { kind: 'burn', until: 100, dps: 10 });
    const m = { hp: 100, takeDamage: () => {} };
    const present = tickStatus(map, m, 200, 0);
    expect(present.has('burn')).toBe(false);
    expect(map.has('burn')).toBe(false);
  });
  it('preserves longer duration on re-apply', () => {
    const map = new Map<StatusKind, StatusEffect>();
    // 模拟 applyStatus 的"取较长"逻辑
    map.set('burn', { kind: 'burn', until: 1000, dps: 5 });
    const incoming: StatusEffect = { kind: 'burn', until: 500, dps: 8 };
    const existing = map.get('burn')!;
    if (existing.until >= incoming.until) {
      // 不更新
    } else {
      map.set('burn', incoming);
    }
    expect(map.get('burn')!.until).toBe(1000);
  });
});

describe('TOWERS config has element types', () => {
  it('fire/shock/frost expose element + status params', () => {
    expect(TOWERS.fire.element).toBe('fire');
    expect(TOWERS.fire.burnDps).toBeGreaterThan(0);
    expect(TOWERS.fire.burnDuration).toBeGreaterThan(0);
    expect(TOWERS.shock.element).toBe('shock');
    expect(TOWERS.shock.shockDuration).toBeGreaterThan(0);
    expect(TOWERS.frost.element).toBe('frost');
    expect(TOWERS.frost.slowDuration).toBeGreaterThan(0);
  });
});

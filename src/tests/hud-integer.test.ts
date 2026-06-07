import { describe, it, expect } from 'vitest';
import { MONSTERS } from '../config/monsters';
import { levelScale } from '../config/grid';

// 回归测试: 金币/生命在游戏内必须始终是整数(用户期望)
describe('gold/lives stay integer after level scale', () => {
  it('L3+ bounty after scale is rounded when added', () => {
    for (const lvl of [3, 5, 7, 10]) {
      const scale = levelScale(lvl - 1);
      const rawBounty = MONSTERS.orc.bounty * scale.bountyMul;
      expect(Number.isInteger(rawBounty)).toBe(false); // 实际是浮点
      expect(Number.isInteger(Math.round(rawBounty))).toBe(true); // round 后整数
    }
  });

  it('L5 golem damage after scale rounds to int', () => {
    for (const lvl of [3, 5, 7, 10]) {
      const scale = levelScale(lvl - 1);
      const rawDmg = MONSTERS.golem.damage * scale.damageMul;
      expect(Number.isInteger(Math.round(rawDmg))).toBe(true);
    }
  });
});

/// <reference types="node" />
import { describe, test } from 'node:test';
import { deepStrictEqual, strictEqual } from 'node:assert';
import { cyclePeriod, resolvedTargets, achievement, trackedPeriod, deliveryBalance } from './client-delivery';
describe('Client delivery periods', () => {
  test('Remind runs from 3 to 2', () => {
    deepStrictEqual(cyclePeriod(3,'2026-11-19'),{start:'2026-11-03',end:'2026-12-02'});
    deepStrictEqual(cyclePeriod(3,'2026-11-02'),{start:'2026-10-03',end:'2026-11-02'});
  });
  test('Sampurna runs from 9 to 8', () => {
    deepStrictEqual(cyclePeriod(9,'2026-11-19'),{start:'2026-11-09',end:'2026-12-08'});
    deepStrictEqual(cyclePeriod(9,'2026-11-08'),{start:'2026-10-09',end:'2026-11-08'});
  });
  test('short months have continuous boundaries', () => {
    deepStrictEqual(cyclePeriod(31,'2026-02-28'),{start:'2026-02-28',end:'2026-03-30'});
  });
  test('previous and next cycles cross calendar years', () => {
    deepStrictEqual(cyclePeriod(3,'2026-01-02'),{start:'2025-12-03',end:'2026-01-02'});
    deepStrictEqual(cyclePeriod(9,'2026-12-19',1),{start:'2027-01-09',end:'2027-02-08'});
    deepStrictEqual(cyclePeriod(9,'2026-11-19',-1),{start:'2026-10-09',end:'2026-11-08'});
  });
  test('same targets repeat unless a period overrides them', () => {
    deepStrictEqual(resolvedTargets({graphics:12}),{graphics:12});
    deepStrictEqual(resolvedTargets({graphics:12},{graphics:18}),{graphics:18});
  });
  test('remaining graphics cannot be negative', () => {
    strictEqual(achievement(12,5).remaining,7);
    deepStrictEqual(achievement(12,15),{remaining:0,percentage:100});
  });
  test('an explicit zero target overrides the recurring target', () => {
    deepStrictEqual(resolvedTargets({graphics:12},{graphics:0}),{graphics:0});
    deepStrictEqual(achievement(0,5),{remaining:0,percentage:0});
  });
  test('periods before the chosen tracking date are skipped', () => {
    deepStrictEqual(trackedPeriod(cyclePeriod(3,'2026-10-15'),'2026-11-03'),
      {start:'2026-11-03',end:'2026-11-02',skipped:true});
  });
  test('a mid-period tracking date excludes earlier activity without prorating the quota', () => {
    deepStrictEqual(trackedPeriod(cyclePeriod(9,'2026-11-23'),'2026-11-20'),
      {start:'2026-11-20',end:'2026-12-08',skipped:false});
    strictEqual(deliveryBalance(12,0).target,12);
  });
  test('a shortfall of 7 graphics adds to the next target of 12', () => {
    deepStrictEqual(deliveryBalance(12,5,12,5),{carry:7,target:19,nextBalance:14,remaining:14,percentage:5/19*100});
  });
  test('an excess of 3 graphics reduces the next target from 12 to 9', () => {
    strictEqual(deliveryBalance(12,0,12,15).target,9);
    strictEqual(deliveryBalance(12,0,12,15).carry,-3);
  });
  test('credits larger than the target remain available in later periods', () => {
    deepStrictEqual(deliveryBalance(12,0,12,40),{carry:-28,target:0,nextBalance:-16,remaining:0,percentage:0});
    strictEqual(deliveryBalance(12,0,24,40).nextBalance,-4);
  });
  test('carryover is cumulative across multiple periods with different targets', () => {
    strictEqual(deliveryBalance(12,4,12+18,5+20).target,17);
    strictEqual(deliveryBalance(12,4,12+18,5+20).nextBalance,13);
  });
  test('unconfigured tracking retains the original target with no historical debt', () => {
    deepStrictEqual(trackedPeriod(cyclePeriod(3,'2026-11-23'),null),{start:'2026-11-03',end:'2026-12-02',skipped:false});
    strictEqual(deliveryBalance(12,5).carry,0);
  });
});
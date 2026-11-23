/// <reference types="node" />
import { describe, test } from 'node:test';
import { deepStrictEqual, strictEqual } from 'node:assert';
import { cyclePeriod, resolvedTargets, achievement } from './client-delivery';
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
});
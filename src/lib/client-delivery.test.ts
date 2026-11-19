import { describe, test, expect } from 'bun:test';
import { cyclePeriod, resolvedTargets, achievement } from './client-delivery';
describe('Client delivery periods', () => {
  test('Remind runs from 3 to 2', () => {
    expect(cyclePeriod(3,'2026-11-19')).toEqual({start:'2026-11-03',end:'2026-12-02'});
    expect(cyclePeriod(3,'2026-11-02')).toEqual({start:'2026-10-03',end:'2026-11-02'});
  });
  test('Sampurna runs from 9 to 8', () => {
    expect(cyclePeriod(9,'2026-11-19')).toEqual({start:'2026-11-09',end:'2026-12-08'});
    expect(cyclePeriod(9,'2026-11-08')).toEqual({start:'2026-10-09',end:'2026-11-08'});
  });
  test('short months have continuous boundaries', () => {
    expect(cyclePeriod(31,'2026-02-28')).toEqual({start:'2026-02-28',end:'2026-03-30'});
  });
  test('same targets repeat unless a period overrides them', () => {
    expect(resolvedTargets({graphics:12})).toEqual({graphics:12});
    expect(resolvedTargets({graphics:12},{graphics:18})).toEqual({graphics:18});
  });
  test('remaining graphics cannot be negative', () => {
    expect(achievement(12,5).remaining).toBe(7);
    expect(achievement(12,15)).toEqual({remaining:0,percentage:100});
  });
});
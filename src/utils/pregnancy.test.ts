/**
 * Tests for pregnancy dates and mode resolution.
 */

import {
  calculatedDueDate,
  daysUntilDue,
  effectiveDueDate,
  findActivePregnancy,
  gestationalAge,
  periodsSinceLastPregnancy,
  pregnancyProgress,
  pregnancySpans,
  resolveMode,
  trimesterFor,
} from './pregnancy';
import type { PregnancyLike } from './pregnancy';

function pregnancy(overrides: Partial<PregnancyLike> = {}): PregnancyLike {
  return {
    id: 'g1',
    lastPeriodDate: '2026-07-04',
    scanDueDate: null,
    endedOn: null,
    outcome: null,
    ...overrides,
  };
}

describe('due dates', () => {
  it('adds 280 days to the first day of the last period', () => {
    expect(calculatedDueDate('2026-07-04')).toBe('2027-04-10');
  });

  it('uses the scan due date when one was entered', () => {
    expect(effectiveDueDate(pregnancy({ scanDueDate: '2027-04-14' }))).toBe('2027-04-14');
    expect(effectiveDueDate(pregnancy())).toBe('2027-04-10');
  });

  it('counts days until the due date, negative once past', () => {
    expect(daysUntilDue(pregnancy(), '2026-11-21')).toBe(140);
    expect(daysUntilDue(pregnancy(), '2027-04-13')).toBe(-3);
  });
});

describe('gestationalAge', () => {
  it('counts completed weeks and days from the last period', () => {
    // 140 days after 2026-07-04.
    expect(gestationalAge(pregnancy(), '2026-11-21')).toEqual({ weeks: 20, days: 0, totalDays: 140 });
    expect(gestationalAge(pregnancy(), '2026-11-24')).toEqual({ weeks: 20, days: 3, totalDays: 143 });
  });

  it('reads 40 weeks + 3 days three days past the due date', () => {
    expect(gestationalAge(pregnancy(), '2027-04-13')).toMatchObject({ weeks: 40, days: 3 });
  });

  it('follows a scan due date, so the week moves with it', () => {
    // A scan puts the due date four days later: four days less along.
    const scanned = pregnancy({ scanDueDate: '2027-04-14' });
    expect(gestationalAge(scanned, '2026-11-21')).toEqual({ weeks: 19, days: 3, totalDays: 136 });
  });

  it('never goes negative before the counted start', () => {
    const scanned = pregnancy({ scanDueDate: '2027-05-01' });
    expect(gestationalAge(scanned, '2026-07-05').totalDays).toBe(0);
  });

  it('caps progress at the due date', () => {
    expect(pregnancyProgress(pregnancy(), '2026-11-21')).toBe(0.5);
    expect(pregnancyProgress(pregnancy(), '2027-05-01')).toBe(1);
  });
});

describe('trimesterFor', () => {
  it('splits at 14 and 28 completed weeks', () => {
    expect(trimesterFor(0)).toBe(1);
    expect(trimesterFor(13)).toBe(1);
    expect(trimesterFor(14)).toBe(2);
    expect(trimesterFor(27)).toBe(2);
    expect(trimesterFor(28)).toBe(3);
    expect(trimesterFor(41)).toBe(3);
  });
});

describe('resolveMode', () => {
  const periods = ['2026-05-08', '2026-06-06', '2026-07-04'];

  it('is cycle with no pregnancy', () => {
    expect(resolveMode([], periods)).toEqual({ kind: 'cycle' });
  });

  it('is pregnant while a pregnancy has no end date', () => {
    const p = pregnancy();
    expect(resolveMode([p], periods)).toEqual({ kind: 'pregnant', pregnancy: p });
  });

  it('is recovery after a birth until a period is logged after it', () => {
    const p = pregnancy({ endedOn: '2027-04-08', outcome: 'birth' });
    expect(resolveMode([p], periods)).toEqual({ kind: 'recovery', pregnancy: p, outcome: 'birth' });
    expect(resolveMode([p], [...periods, '2027-06-20'])).toEqual({ kind: 'cycle' });
  });

  it('is recovery after a loss too, so no lateness is shown before the next period', () => {
    const p = pregnancy({ endedOn: '2026-09-01', outcome: 'loss' });
    expect(resolveMode([p], periods)).toMatchObject({ kind: 'recovery', outcome: 'loss' });
  });

  it('does not count a period logged on the day the pregnancy ended', () => {
    const p = pregnancy({ endedOn: '2026-09-01', outcome: 'loss' });
    expect(resolveMode([p], [...periods, '2026-09-01']).kind).toBe('recovery');
  });

  it('prefers an active pregnancy over a recovery from an earlier one', () => {
    const earlier = pregnancy({ id: 'g0', lastPeriodDate: '2025-01-01', endedOn: '2025-03-01', outcome: 'loss' });
    const active = pregnancy();
    expect(resolveMode([earlier, active], periods)).toMatchObject({ kind: 'pregnant', pregnancy: active });
  });
});

describe('findActivePregnancy', () => {
  it('picks the most recent when two are somehow open', () => {
    const older = pregnancy({ id: 'a', lastPeriodDate: '2025-01-01' });
    const newer = pregnancy({ id: 'b' });
    expect(findActivePregnancy([newer, older])?.id).toBe('b');
  });
});

describe('pregnancySpans and periodsSinceLastPregnancy', () => {
  it('spans an active pregnancy to the end of time', () => {
    expect(pregnancySpans([pregnancy()])).toEqual([{ start: '2026-07-04', end: '9999-12-31' }]);
  });

  it('counts periods started after the most recent pregnancy ended', () => {
    const ended = pregnancy({ endedOn: '2027-04-08', outcome: 'birth' });
    expect(periodsSinceLastPregnancy([ended], ['2026-07-04', '2027-06-20', '2027-07-25'])).toBe(2);
    expect(periodsSinceLastPregnancy([], ['2026-07-04'])).toBeNull();
  });
});

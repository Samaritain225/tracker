/**
 * Tests for hormonal phase computation.
 *
 * computePhase reads `new Date()` internally for "today", so these tests
 * pin the system clock with jest fake timers and derive lastPeriodDate
 * relative to it.
 */

import { addDays, toISODate } from './date';
import { computePhase } from './phase';

const TODAY = new Date(2025, 5, 15); // June 15, 2025 (arbitrary fixed point)

function lastPeriodNDaysAgo(n: number): string {
  return toISODate(addDays(TODAY, -n));
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(TODAY);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('computePhase — 28-day cycle, 5-day period', () => {
  const cycleLength = 28;
  const periodDurationDays = 5;
  // ovulationDay = 28 - 14 = 14; ovulationStart = 13; ovulationEnd = 15

  it('day 3 is menstrual', () => {
    const info = computePhase(lastPeriodNDaysAgo(2), cycleLength, periodDurationDays);
    expect(info?.phase).toBe('menstrual');
    expect(info?.dayInCycle).toBe(3);
  });

  it('day 5 (last menstrual day) is still menstrual', () => {
    const info = computePhase(lastPeriodNDaysAgo(4), cycleLength, periodDurationDays);
    expect(info?.phase).toBe('menstrual');
  });

  it('day 6 is follicular', () => {
    const info = computePhase(lastPeriodNDaysAgo(5), cycleLength, periodDurationDays);
    expect(info?.phase).toBe('follicular');
  });

  it('day 13 (ovulationStart) is ovulatory', () => {
    const info = computePhase(lastPeriodNDaysAgo(12), cycleLength, periodDurationDays);
    expect(info?.phase).toBe('ovulatory');
  });

  it('day 14 (ovulation day) is ovulatory', () => {
    const info = computePhase(lastPeriodNDaysAgo(13), cycleLength, periodDurationDays);
    expect(info?.phase).toBe('ovulatory');
  });

  it('day 15 (ovulationEnd) is ovulatory', () => {
    const info = computePhase(lastPeriodNDaysAgo(14), cycleLength, periodDurationDays);
    expect(info?.phase).toBe('ovulatory');
  });

  it('day 16 is luteal', () => {
    const info = computePhase(lastPeriodNDaysAgo(15), cycleLength, periodDurationDays);
    expect(info?.phase).toBe('luteal');
  });

  it('day 28 (last day of cycle) is luteal', () => {
    const info = computePhase(lastPeriodNDaysAgo(27), cycleLength, periodDurationDays);
    expect(info?.phase).toBe('luteal');
  });
});

describe('computePhase — short cycle with overlapping menstrual/ovulatory windows', () => {
  // cycleLength=21, periodDurationDays=8: ovulationDay = 21-14 = 7,
  // ovulationStart = 6, ovulationEnd = 8. Since menstrualEnd (8) equals
  // ovulationEnd (8), the menstrual branch (checked first) fully
  // swallows the ovulatory window — there is no day reported as
  // 'ovulatory' at all for this combination. This is a known edge case
  // of the current boundary logic, not a bug under test here — just
  // locking in the documented behavior for an unusually short cycle
  // with a long period.
  const cycleLength = 21;
  const periodDurationDays = 8;

  it('day 7 (nominal ovulation day) is reported as menstrual due to the overlap', () => {
    const info = computePhase(lastPeriodNDaysAgo(6), cycleLength, periodDurationDays);
    expect(info?.phase).toBe('menstrual');
  });

  it('day 8 (nominal ovulationEnd) is still menstrual', () => {
    const info = computePhase(lastPeriodNDaysAgo(7), cycleLength, periodDurationDays);
    expect(info?.phase).toBe('menstrual');
  });

  it('day 9 jumps straight to luteal — the ovulatory phase never occurs', () => {
    const info = computePhase(lastPeriodNDaysAgo(8), cycleLength, periodDurationDays);
    expect(info?.phase).toBe('luteal');
  });
});

describe('computePhase — long cycle (40 days)', () => {
  const cycleLength = 40;
  const periodDurationDays = 5;
  // ovulationDay = 40 - 14 = 26; ovulationStart = 25; ovulationEnd = 27

  it('day 24 is follicular', () => {
    const info = computePhase(lastPeriodNDaysAgo(23), cycleLength, periodDurationDays);
    expect(info?.phase).toBe('follicular');
  });

  it('day 26 is ovulatory', () => {
    const info = computePhase(lastPeriodNDaysAgo(25), cycleLength, periodDurationDays);
    expect(info?.phase).toBe('ovulatory');
  });

  it('day 28 is luteal', () => {
    const info = computePhase(lastPeriodNDaysAgo(27), cycleLength, periodDurationDays);
    expect(info?.phase).toBe('luteal');
  });
});

describe('computePhase — late period (regression target for fix 2c)', () => {
  // The last period started 34 days ago, so today is day 35 of a
  // 28-day cycle — 7 days past when the next period was due. Before
  // fix 2c, computePhase wrapped via modulo and incorrectly reported
  // this as day 7 of a brand-new cycle (follicular). It now holds the
  // phase at 'luteal' and surfaces how late the period is via `isLate`
  // / `daysLate` on PhaseInfo.
  const cycleLength = 28;
  const periodDurationDays = 5;

  it('does not restart the cycle when 7 days late', () => {
    const info = computePhase(lastPeriodNDaysAgo(34), cycleLength, periodDurationDays);
    expect(info?.phase).toBe('luteal');
    expect(info?.dayInCycle).toBe(35);
    expect(info?.isLate).toBe(true);
    expect(info?.daysLate).toBe(7);
  });
});

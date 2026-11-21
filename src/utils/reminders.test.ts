/**
 * Tests for period reminder scheduling.
 */

import { computePeriodReminderDates } from './reminders';

/** Local-time date at a given hour, matching how reminders are built. */
function at(iso: string, hour: number): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, hour, 0, 0, 0);
}

describe('computePeriodReminderDates', () => {
  const starts = ['2026-03-01', '2026-03-29', '2026-04-26', '2026-05-24'];

  it('reminds at 09:00 two days before each of the next three periods', () => {
    const dates = computePeriodReminderDates(starts, at('2026-02-10', 12));
    expect(dates).toEqual([
      at('2026-02-27', 9),
      at('2026-03-27', 9),
      at('2026-04-24', 9),
    ]);
  });

  it('skips a reminder whose moment has already passed', () => {
    // 2026-02-27 09:00 is the first reminder; it is now 10:00 that day.
    const dates = computePeriodReminderDates(starts, at('2026-02-27', 10));
    expect(dates[0]).toEqual(at('2026-03-27', 9));
    expect(dates).toHaveLength(3);
  });

  it('still schedules a reminder later the same morning', () => {
    const dates = computePeriodReminderDates(starts, at('2026-02-27', 8));
    expect(dates[0]).toEqual(at('2026-02-27', 9));
  });

  it('skips a prediction that starts today, as while a period is overdue', () => {
    // Overdue: the first prediction is today, so its reminder is in the
    // past, but the following periods still get theirs.
    const overdue = ['2026-03-03', '2026-03-31', '2026-04-28'];
    const dates = computePeriodReminderDates(overdue, at('2026-03-03', 7));
    expect(dates).toEqual([at('2026-03-29', 9), at('2026-04-26', 9)]);
  });

  it('returns nothing when there is nothing to predict', () => {
    expect(computePeriodReminderDates([], at('2026-02-10', 12))).toEqual([]);
  });

  it('works through starts given out of order', () => {
    const dates = computePeriodReminderDates([...starts].reverse(), at('2026-02-10', 12));
    expect(dates[0]).toEqual(at('2026-02-27', 9));
  });
});

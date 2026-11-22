/**
 * Pure scheduling maths for period reminders. No Expo imports, so it can
 * be tested directly — the notification service only executes the plan.
 */

import { addDays, parseISODate } from './date';

/** How many upcoming periods get a reminder at once. */
export const PERIOD_REMINDER_COUNT = 3;
/** Days before a predicted period that its reminder fires. */
export const PERIOD_REMINDER_DAYS_BEFORE = 2;
/** Local hour the reminder fires at, on the reminder day. */
export const PERIOD_REMINDER_HOUR = 9;

/**
 * When to remind the user about each of the next few predicted periods:
 * 09:00 local time, two days before each one, skipping any moment that
 * has already passed.
 *
 * Scheduling several at once is the point. A single reminder for the
 * next period fired once and then nothing was scheduled again until the
 * user happened to open the app, so anyone who didn't open it got one
 * reminder and then silence while Settings still showed them as on.
 */
export function computePeriodReminderDates(
  predictedStarts: string[],
  now: Date,
  count: number = PERIOD_REMINDER_COUNT,
): Date[] {
  const dates: Date[] = [];

  for (const start of [...predictedStarts].sort()) {
    const reminder = addDays(parseISODate(start), -PERIOD_REMINDER_DAYS_BEFORE);
    reminder.setHours(PERIOD_REMINDER_HOUR, 0, 0, 0);
    if (reminder <= now) continue;
    dates.push(reminder);
    if (dates.length === count) break;
  }

  return dates;
}

/** How many upcoming visits get a reminder at once. */
export const VISIT_REMINDER_COUNT = 10;

/**
 * When to remind the user about upcoming pregnancy visits: 09:00 local
 * time the day before each one, skipping any moment already passed,
 * soonest first.
 */
export function computeVisitReminderDates(
  visitDates: string[],
  now: Date,
  count: number = VISIT_REMINDER_COUNT,
): { visitDate: string; remindAt: Date }[] {
  const result: { visitDate: string; remindAt: Date }[] = [];
  for (const visitDate of [...visitDates].sort()) {
    const remindAt = addDays(parseISODate(visitDate), -1);
    remindAt.setHours(PERIOD_REMINDER_HOUR, 0, 0, 0);
    if (remindAt <= now) continue;
    result.push({ visitDate, remindAt });
    if (result.length === count) break;
  }
  return result;
}

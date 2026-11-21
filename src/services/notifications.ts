/**
 * Local notification service.
 * Handles scheduling and cancelling period prediction and daily log reminders.
 */

import * as Notifications from 'expo-notifications';

import { PERIOD_REMINDER_COUNT } from '@/utils/reminders';

// Notification identifier for the daily check-in.
const DAILY_LOG_ID = 'daily-log-reminder';

/**
 * Request notification permissions from the user.
 * Returns true if granted.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  const permissions = await Notifications.getPermissionsAsync();

  if ((permissions as any).granted) return true;

  const request = await Notifications.requestPermissionsAsync();
  return (request as any).granted;
}

/**
 * Identifier for the reminder of the Nth upcoming period. Each upcoming
 * period gets its own, so rescheduling replaces them one for one.
 */
function periodReminderId(index: number): string {
  return `period-reminder-${index}`;
}

/**
 * The single identifier used before reminders covered several periods.
 * Still cancelled on every reschedule, so someone upgrading from that
 * version doesn't get the old reminder on top of the new ones.
 */
const LEGACY_PERIOD_REMINDER_ID = 'period-reminder';

/**
 * Replaces every scheduled period reminder with one at each of the
 * given moments (see computePeriodReminderDates for how they are chosen).
 *
 * Uses DATE triggers fixed to those mornings rather than TIME_INTERVAL
 * countdowns in seconds — the latter fire at whatever time of day the
 * app happened to be open when they were scheduled, which could be 2am.
 */
export async function schedulePeriodReminders(
  reminderDates: Date[],
  title: string,
  body: string,
): Promise<void> {
  await cancelPeriodReminders();

  for (let i = 0; i < reminderDates.length; i++) {
    await Notifications.scheduleNotificationAsync({
      identifier: periodReminderId(i),
      content: {
        title,
        body,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderDates[i],
      },
    });
  }
}

async function cancelPeriodReminders(): Promise<void> {
  await cancelNotification(LEGACY_PERIOD_REMINDER_ID);
  for (let i = 0; i < PERIOD_REMINDER_COUNT; i++) {
    await cancelNotification(periodReminderId(i));
  }
}

/**
 * Schedule a daily log reminder at 20:00 local time.
 * Cancels any existing daily reminder first.
 */
export async function scheduleDailyLogReminder(
  title: string,
  body: string,
): Promise<void> {
  await cancelNotification(DAILY_LOG_ID);

  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_LOG_ID,
    content: {
      title,
      body,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 20,
      minute: 0,
    },
  });
}

/**
 * Cancel a specific scheduled notification by identifier.
 */
async function cancelNotification(identifier: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch {
    // Notification may not exist — that's fine
  }
}

/**
 * Cancel all reminders this app schedules.
 * Cancels by identifier rather than calling
 * cancelAllScheduledNotificationsAsync(), which would wipe out any
 * other scheduled notification on the device too, not just this app's.
 */
export async function cancelAllReminders(): Promise<void> {
  await cancelPeriodReminders();
  await cancelNotification(DAILY_LOG_ID);
}

/**
 * Set up the global notification handler.
 * Call this once at app startup.
 */
export function setupNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Local notification service.
 * Handles scheduling and cancelling period prediction and daily log reminders.
 */

import * as Notifications from 'expo-notifications';

// Notification identifiers for tracking
const PERIOD_REMINDER_ID = 'period-reminder';
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

/** Local hour the period reminder fires at, on the reminder day. */
const PERIOD_REMINDER_HOUR = 9;

/**
 * Schedule a notification at 09:00 local time, 2 days before the
 * predicted next period. Cancels any existing period reminder first.
 *
 * Uses a DATE trigger fixed to that morning rather than a TIME_INTERVAL
 * countdown in seconds — the latter fires whatever time of day the app
 * happened to be open when it was scheduled, which could be 2am.
 */
export async function schedulePeriodReminder(
  nextPeriodDate: Date,
  title: string,
  body: string,
): Promise<void> {
  // Cancel existing period reminder
  await cancelNotification(PERIOD_REMINDER_ID);

  const reminderDate = new Date(nextPeriodDate);
  reminderDate.setDate(reminderDate.getDate() - 2);
  reminderDate.setHours(PERIOD_REMINDER_HOUR, 0, 0, 0);

  // Don't schedule if the reminder date is already in the past
  if (reminderDate <= new Date()) return;

  await Notifications.scheduleNotificationAsync({
    identifier: PERIOD_REMINDER_ID,
    content: {
      title,
      body,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminderDate,
    },
  });
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
  await cancelNotification(PERIOD_REMINDER_ID);
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

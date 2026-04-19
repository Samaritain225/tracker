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

/**
 * Schedule a notification 2 days before the predicted next period.
 * Cancels any existing period reminder first.
 */
export async function schedulePeriodReminder(
  nextPeriodDate: Date,
  title: string,
  body: string,
): Promise<void> {
  // Cancel existing period reminder
  await cancelNotification(PERIOD_REMINDER_ID);

  const now = new Date();
  const reminderDate = new Date(nextPeriodDate);
  reminderDate.setDate(reminderDate.getDate() - 2);

  // Don't schedule if the reminder date is already in the past
  if (reminderDate <= now) return;

  const secondsUntilReminder = Math.floor((reminderDate.getTime() - now.getTime()) / 1000);

  await Notifications.scheduleNotificationAsync({
    identifier: PERIOD_REMINDER_ID,
    content: {
      title,
      body,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: secondsUntilReminder,
      repeats: false,
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
 * Cancel all scheduled reminders.
 */
export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
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

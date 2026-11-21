/**
 * Moving the user's data in and out of the app: backup files, restore,
 * the spreadsheet export, and deleting everything.
 *
 * The decisions — what a backup holds, what a restore adds — live in
 * src/utils/backup.ts as tested pure functions. This file only does the
 * file and database work those decisions call for.
 */

import { eq } from 'drizzle-orm';
import * as DocumentPicker from 'expo-document-picker';
import { cacheDirectory, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { DEFAULT_CYCLE_DAYS, DEFAULT_PERIOD_DURATION_DAYS } from '@/constants/cycle';
import { db } from '@/db/client';
import { dailyLogs, periods, settings } from '@/db/schema';
import type { RestorePlan } from '@/utils/backup';

const SETTINGS_ID = '1';

export type ShareOutcome = 'shared' | 'unavailable';

/**
 * Writes a file to the app's cache and opens the share sheet, so the
 * user chooses where it goes: Files, Drive, an email to themselves.
 * Nothing is uploaded anywhere unless they pick a destination that does.
 */
export async function shareTextFile(
  fileName: string,
  contents: string,
  mimeType: string,
  dialogTitle: string,
): Promise<ShareOutcome> {
  if (!cacheDirectory) {
    throw new Error('cache_directory_unavailable');
  }
  if (!(await Sharing.isAvailableAsync())) {
    return 'unavailable';
  }

  const uri = `${cacheDirectory}${fileName}`;
  await writeAsStringAsync(uri, contents, { encoding: 'utf8' });
  await Sharing.shareAsync(uri, { mimeType, dialogTitle });
  return 'shared';
}

/**
 * Lets the user pick a backup file and returns its text, or null if they
 * backed out of the picker. Accepts any file type: Android often labels
 * a .json file saved through another app as a generic binary, and the
 * contents are checked properly by parseBackup anyway.
 */
export async function pickBackupText(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || result.assets.length === 0) {
    return null;
  }
  return readAsStringAsync(result.assets[0].uri, { encoding: 'utf8' });
}

/**
 * Adds everything in the plan in a single transaction, so a failure
 * part-way leaves the phone exactly as it was rather than half-restored.
 * Rows get fresh ids; the dates are what identify a record.
 */
export function applyRestorePlan(plan: RestorePlan): void {
  db.transaction((tx) => {
    for (const p of plan.periodsToAdd) {
      tx.insert(periods)
        .values({
          startDate: p.startDate,
          endDate: p.endDate,
          notes: p.notes,
          ...(p.createdAt !== null ? { createdAt: p.createdAt } : {}),
        })
        .run();
    }

    for (const l of plan.logsToAdd) {
      tx.insert(dailyLogs)
        .values({
          date: l.date,
          flow: l.flow,
          symptoms: l.symptoms,
          mood: l.mood,
          notes: l.notes,
          ...(l.createdAt !== null ? { createdAt: l.createdAt } : {}),
          ...(l.updatedAt !== null ? { updatedAt: l.updatedAt } : {}),
        })
        .run();
    }

    if (plan.settingsToApply) {
      tx.update(settings).set(plan.settingsToApply).where(eq(settings.id, SETTINGS_ID)).run();
    }
  });
}

/**
 * Deletes every period and daily log and resets the settings, in one
 * transaction. The language is kept: someone who reads the app in
 * English shouldn't be dropped into French by the act of deleting their
 * data. App lock and reminders are switched off, which also cancels any
 * scheduled reminder through RemindersProvider.
 */
export function deleteAllData(): void {
  db.transaction((tx) => {
    tx.delete(dailyLogs).run();
    tx.delete(periods).run();
    tx.update(settings)
      .set({
        calendarType: 'gregorian',
        fallbackCycleDays: DEFAULT_CYCLE_DAYS,
        periodDurationDays: DEFAULT_PERIOD_DURATION_DAYS,
        theme: 'system',
        appLockEnabled: 0,
        remindersEnabled: 0,
      })
      .where(eq(settings.id, SETTINGS_ID))
      .run();
  });
}

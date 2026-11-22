/**
 * Moving the user's data in and out of the app: backup files, restore,
 * the spreadsheet export, and deleting everything.
 *
 * The decisions — what a backup holds, what a restore adds — live in
 * src/utils/backup.ts and backup-archive.ts as tested pure functions.
 * This file only does the file and database work those decisions call
 * for.
 */

import { eq, isNotNull } from 'drizzle-orm';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { DEFAULT_CYCLE_DAYS, DEFAULT_PERIOD_DURATION_DAYS } from '@/constants/cycle';
import { db } from '@/db/client';
import {
  dailyLogs,
  periods,
  pregnancies,
  pregnancyMoments,
  pregnancyVisits,
  settings,
} from '@/db/schema';
import { buildBackup, backupFileName, serializeBackup } from '@/utils/backup';
import type { RestorePlan } from '@/utils/backup';
import { buildBackupArchive, readBackupBytes } from '@/utils/backup-archive';
import type { BackupPhoto } from '@/utils/backup-archive';

const SETTINGS_ID = '1';

/** Where Journey photos live: inside the app, never in the gallery. */
export function photoDirectory(): Directory {
  return new Directory(Paths.document, 'pregnancy-photos');
}

export type ShareOutcome = 'shared' | 'unavailable';

/**
 * Writes a file to the app's cache and opens the share sheet, so the
 * user chooses where it goes: Files, Drive, an email to themselves.
 * Nothing is uploaded anywhere unless they pick a destination that does.
 */
async function shareFile(
  fileName: string,
  contents: string | Uint8Array,
  mimeType: string,
  dialogTitle: string,
): Promise<ShareOutcome> {
  if (!(await Sharing.isAvailableAsync())) {
    return 'unavailable';
  }
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  await file.write(contents);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle });
  return 'shared';
}

export function shareTextFile(
  fileName: string,
  contents: string,
  mimeType: string,
  dialogTitle: string,
): Promise<ShareOutcome> {
  return shareFile(fileName, contents, mimeType, dialogTitle);
}

/** Everything a backup or a restore needs to know about the phone. */
export function readAllData() {
  return {
    periods: db.select().from(periods).all(),
    logs: db.select().from(dailyLogs).all(),
    settings: db.select().from(settings).where(eq(settings.id, SETTINGS_ID)).get() ?? null,
    pregnancies: db.select().from(pregnancies).all(),
    visits: db.select().from(pregnancyVisits).all(),
    moments: db.select().from(pregnancyMoments).all(),
  };
}

/**
 * Builds a complete backup — data and every Journey photo — as one zip,
 * read straight from the database so it can't miss anything a screen
 * happened not to have loaded, and opens the share sheet.
 */
export async function shareBackup(now: Date, dialogTitle: string): Promise<ShareOutcome> {
  const data = readAllData();
  const backup = buildBackup(data.periods, data.logs, data.settings, now, {
    pregnancies: data.pregnancies,
    visits: data.visits,
    moments: data.moments,
  });

  const photos: BackupPhoto[] = [];
  const dir = photoDirectory();
  for (const moment of data.moments) {
    if (!moment.photoFileName) continue;
    const file = new File(dir, moment.photoFileName);
    // A photo that has gone missing on disk is left out rather than
    // failing the whole backup; its moment is still saved.
    if (!file.exists) continue;
    photos.push({ name: moment.photoFileName, bytes: await file.bytes() });
  }

  const archive = buildBackupArchive(serializeBackup(backup), photos);
  return shareFile(backupFileName(now), archive, 'application/zip', dialogTitle);
}

export type PickedBackup =
  | { ok: true; json: string; photos: Map<string, Uint8Array> }
  | { ok: false; error: 'invalid' };

/**
 * Lets the user pick a backup file — a version 2 .zip or a version 1
 * .json — and returns its contents, or null if they backed out. Accepts
 * any file type: Android often labels a file saved through another app
 * as a generic binary, and the contents are checked properly anyway.
 */
export async function pickBackupFile(): Promise<PickedBackup | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/zip', 'application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || result.assets.length === 0) {
    return null;
  }
  const bytes = await new File(result.assets[0].uri).bytes();
  return readBackupBytes(bytes);
}

/**
 * Adds everything in the plan in a single transaction, so a failure
 * part-way leaves the phone exactly as it was rather than half-restored.
 * Rows get fresh ids; the dates are what identify a record, and visits
 * and moments are re-linked to their pregnancy's new id.
 *
 * Photos are copied only after the transaction succeeds. A photo the
 * file names but doesn't contain is skipped, and its moment is kept
 * without it. Returns how many photos could not be restored.
 */
export async function applyRestorePlan(
  plan: RestorePlan,
  photos: Map<string, Uint8Array>,
): Promise<{ missingPhotos: number }> {
  const photoNames: string[] = [];

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

    for (const { pregnancy: p, visits, moments } of plan.pregnanciesToAdd) {
      const [created] = tx
        .insert(pregnancies)
        .values({
          lastPeriodDate: p.lastPeriodDate,
          scanDueDate: p.scanDueDate,
          endedOn: p.endedOn,
          outcome: p.outcome,
          babyName: p.babyName,
          breastfeeding: p.breastfeeding === null ? null : p.breastfeeding ? 1 : 0,
          journeyChoice: p.journeyChoice,
          ...(p.startedAt !== null ? { startedAt: p.startedAt } : {}),
          ...(p.createdAt !== null ? { createdAt: p.createdAt } : {}),
        })
        .returning({ id: pregnancies.id })
        .all();

      for (const v of visits) {
        tx.insert(pregnancyVisits)
          .values({
            pregnancyId: created.id,
            date: v.date,
            kind: v.kind,
            title: v.title,
            weightKg: v.weightKg,
            systolic: v.systolic,
            diastolic: v.diastolic,
            notes: v.notes,
            ...(v.createdAt !== null ? { createdAt: v.createdAt } : {}),
          })
          .run();
      }

      for (const m of moments) {
        const hasPhoto = m.photoFileName !== null && photos.has(m.photoFileName);
        if (hasPhoto) photoNames.push(m.photoFileName!);
        tx.insert(pregnancyMoments)
          .values({
            pregnancyId: created.id,
            date: m.date,
            kind: m.kind,
            text: m.text,
            photoFileName: hasPhoto ? m.photoFileName : null,
            ...(m.createdAt !== null ? { createdAt: m.createdAt } : {}),
          })
          .run();
      }
    }

    if (plan.settingsToApply) {
      const { showStarSign, ...rest } = plan.settingsToApply;
      tx.update(settings)
        .set({ ...rest, showStarSign: showStarSign ? 1 : 0 })
        .where(eq(settings.id, SETTINGS_ID))
        .run();
    }
  });

  const missingPhotos = plan.pregnanciesToAdd
    .flatMap((r) => r.moments)
    .filter((m) => m.photoFileName !== null && !photos.has(m.photoFileName)).length;

  if (photoNames.length > 0) {
    const dir = photoDirectory();
    if (!dir.exists) dir.create({ intermediates: true });
    for (const name of photoNames) {
      const file = new File(dir, name);
      // Same name means the same photo (names are unique ids), so an
      // existing copy is kept rather than overwritten.
      if (file.exists) continue;
      file.create();
      await file.write(photos.get(name)!);
    }
  }

  return { missingPhotos };
}

/**
 * Deletes every period, daily log, pregnancy, visit, moment and photo,
 * and resets the settings, in one transaction. The language is kept:
 * someone who reads the app in English shouldn't be dropped into French
 * by the act of deleting their data. App lock and reminders are switched
 * off, which also cancels any scheduled reminder through
 * RemindersProvider.
 */
export function deleteAllData(): void {
  db.transaction((tx) => {
    // The always-true WHERE is load-bearing. A bare DELETE lets SQLite
    // use its truncate optimisation, which skips the per-row change
    // notifications the live queries listen for: the rows were gone from
    // the database while every screen kept showing them, and a restore
    // straight afterwards reported everything as "already on this phone".
    tx.delete(pregnancyMoments).where(isNotNull(pregnancyMoments.id)).run();
    tx.delete(pregnancyVisits).where(isNotNull(pregnancyVisits.id)).run();
    tx.delete(pregnancies).where(isNotNull(pregnancies.id)).run();
    tx.delete(dailyLogs).where(isNotNull(dailyLogs.id)).run();
    tx.delete(periods).where(isNotNull(periods.id)).run();
    tx.update(settings)
      .set({
        calendarType: 'gregorian',
        fallbackCycleDays: DEFAULT_CYCLE_DAYS,
        periodDurationDays: DEFAULT_PERIOD_DURATION_DAYS,
        theme: 'system',
        appLockEnabled: 0,
        remindersEnabled: 0,
        showStarSign: 1,
        pregnancyPromptDismissedFor: null,
      })
      .where(eq(settings.id, SETTINGS_ID))
      .run();
  });

  const dir = photoDirectory();
  if (dir.exists) dir.delete();
}

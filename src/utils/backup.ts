/**
 * Backup file format, validation and restore planning.
 *
 * Pure functions only — no database or file access — so the rules that
 * decide what a restore does can be tested directly. Settings writes the
 * file and the restore service executes the plan.
 *
 * Compatibility rules, which every future format change must keep:
 *  - A newer app reads every older `formatVersion`.
 *  - An older app refuses a newer file with a clear message and changes
 *    nothing, rather than guessing at fields it doesn't know.
 *  - Unknown extra fields are ignored, so adding optional data does not
 *    need a new version.
 */

import {
  MAX_CYCLE_DAYS,
  MAX_PERIOD_DURATION_DAYS,
  MIN_CYCLE_DAYS,
  MIN_PERIOD_DURATION_DAYS,
} from '@/constants/cycle';
import type { DailyLog, FlowLevel, Period, Settings } from '@/db/schema';
import { findPeriodCovering } from './cycle';
import { parseISODate, toISODate } from './date';

export const BACKUP_APP_ID = 'lumi';
export const BACKUP_FORMAT_VERSION = 1;

export type BackupPeriod = {
  startDate: string;
  endDate: string | null;
  notes: string | null;
  createdAt: number | null;
};

export type BackupDailyLog = {
  date: string;
  flow: FlowLevel | null;
  symptoms: string[];
  mood: string | null;
  notes: string | null;
  createdAt: number | null;
  updatedAt: number | null;
};

/**
 * The settings worth carrying to another phone. App lock and reminders
 * are left out on purpose: both depend on this phone's own permissions
 * (biometrics enrolled, notifications allowed), so the user turns them
 * on again where they can actually work.
 */
export type BackupSettings = {
  language: 'fr' | 'en';
  calendarType: 'gregorian' | 'hijri';
  fallbackCycleDays: number;
  periodDurationDays: number;
  theme: 'system' | 'light' | 'dark';
};

export type Backup = {
  app: typeof BACKUP_APP_ID;
  formatVersion: number;
  /** ISO timestamp of when the file was written. */
  exportedAt: string;
  periods: BackupPeriod[];
  dailyLogs: BackupDailyLog[];
  settings: BackupSettings | null;
};

const FLOW_LEVELS: readonly FlowLevel[] = ['spotting', 'light', 'medium', 'heavy'];

export function buildBackup(
  periodList: Period[],
  logList: DailyLog[],
  currentSettings: Settings | null,
  now: Date,
): Backup {
  return {
    app: BACKUP_APP_ID,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: now.toISOString(),
    periods: [...periodList]
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map((p) => ({
        startDate: p.startDate,
        endDate: p.endDate ?? null,
        notes: p.notes ?? null,
        createdAt: p.createdAt ?? null,
      })),
    dailyLogs: [...logList]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((l) => ({
        date: l.date,
        flow: (l.flow as FlowLevel | null) ?? null,
        symptoms: l.symptoms ?? [],
        mood: l.mood ?? null,
        notes: l.notes ?? null,
        createdAt: l.createdAt ?? null,
        updatedAt: l.updatedAt ?? null,
      })),
    settings: currentSettings
      ? {
          language: currentSettings.language as BackupSettings['language'],
          calendarType: currentSettings.calendarType as BackupSettings['calendarType'],
          fallbackCycleDays: currentSettings.fallbackCycleDays,
          periodDurationDays: currentSettings.periodDurationDays,
          theme: currentSettings.theme as BackupSettings['theme'],
        }
      : null,
  };
}

export function serializeBackup(backup: Backup): string {
  return JSON.stringify(backup, null, 2);
}

/** `lumi-backup-2026-11-21.json`, dated by the phone's local calendar. */
export function backupFileName(now: Date): string {
  return `lumi-backup-${toISODate(now)}.json`;
}

export type BackupParseError =
  /** Not JSON at all — probably the wrong file. */
  | 'not_json'
  /** JSON, but not a Lumi backup. */
  | 'not_lumi'
  /** Written by a newer version of the app than this one. */
  | 'newer_version'
  /** A Lumi backup, but damaged or edited into something unreadable. */
  | 'invalid';

export type BackupParseResult =
  | { ok: true; backup: Backup }
  | { ok: false; error: BackupParseError };

/**
 * Reads and checks a backup file's text. Rejects the whole file rather
 * than importing part of it when anything essential is wrong: a restore
 * that silently drops half the records is worse than one that refuses.
 * Duplicate dates inside the file keep their first occurrence.
 */
export function parseBackup(text: string): BackupParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'not_json' };
  }

  if (!isObject(raw) || raw.app !== BACKUP_APP_ID) {
    return { ok: false, error: 'not_lumi' };
  }
  if (typeof raw.formatVersion !== 'number' || !Number.isInteger(raw.formatVersion) || raw.formatVersion < 1) {
    return { ok: false, error: 'invalid' };
  }
  if (raw.formatVersion > BACKUP_FORMAT_VERSION) {
    return { ok: false, error: 'newer_version' };
  }
  if (!Array.isArray(raw.periods) || !Array.isArray(raw.dailyLogs)) {
    return { ok: false, error: 'invalid' };
  }

  const periodList: BackupPeriod[] = [];
  const seenStarts = new Set<string>();
  for (const item of raw.periods) {
    const period = readPeriod(item);
    if (!period) return { ok: false, error: 'invalid' };
    if (seenStarts.has(period.startDate)) continue;
    seenStarts.add(period.startDate);
    periodList.push(period);
  }

  const logList: BackupDailyLog[] = [];
  const seenDays = new Set<string>();
  for (const item of raw.dailyLogs) {
    const log = readDailyLog(item);
    if (!log) return { ok: false, error: 'invalid' };
    if (seenDays.has(log.date)) continue;
    seenDays.add(log.date);
    logList.push(log);
  }

  return {
    ok: true,
    backup: {
      app: BACKUP_APP_ID,
      formatVersion: raw.formatVersion,
      exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
      periods: periodList.sort((a, b) => a.startDate.localeCompare(b.startDate)),
      dailyLogs: logList.sort((a, b) => a.date.localeCompare(b.date)),
      // Settings are a convenience, not data: a damaged settings block
      // drops the settings, not the whole restore.
      settings: readSettings(raw.settings),
    },
  };
}

export type BackupSummary = {
  periodCount: number;
  logCount: number;
  /** Earliest and latest dated record in the file, or null when empty. */
  firstDate: string | null;
  lastDate: string | null;
};

export function summarizeBackup(backup: Backup): BackupSummary {
  const dates = [
    ...backup.periods.map((p) => p.startDate),
    ...backup.dailyLogs.map((l) => l.date),
  ].sort();

  return {
    periodCount: backup.periods.length,
    logCount: backup.dailyLogs.length,
    firstDate: dates[0] ?? null,
    lastDate: dates[dates.length - 1] ?? null,
  };
}

export type RestorePlan = {
  periodsToAdd: BackupPeriod[];
  logsToAdd: BackupDailyLog[];
  /** Records left out because this phone already has its own version. */
  skippedPeriods: number;
  skippedLogs: number;
  /** Settings are only taken from the file on a phone with no data yet. */
  settingsToApply: BackupSettings | null;
};

/**
 * Decides what a restore adds. Nothing already on the phone is changed:
 *
 *  - A day this phone already has a log for keeps the phone's log.
 *  - A period is skipped when the phone has one starting the same day,
 *    when its start falls inside a period the phone already has, or when
 *    one of the phone's periods starts inside it. Adding it anyway would
 *    create two starts a few days apart — exactly the double-logged
 *    period that drags the average cycle down to two days.
 *  - Settings come from the file only when the phone has no periods and
 *    no logs, i.e. a new phone. Otherwise the user has already set this
 *    phone up the way they want it.
 */
export function planRestore(
  existing: {
    periods: { startDate: string; endDate: string | null }[];
    logs: { date: string }[];
  },
  backup: Backup,
): RestorePlan {
  const periodsToAdd: BackupPeriod[] = [];
  let skippedPeriods = 0;

  for (const period of backup.periods) {
    const clashes =
      existing.periods.some((p) => p.startDate === period.startDate) ||
      findPeriodCovering(existing.periods, period.startDate) !== null ||
      existing.periods.some((p) => findPeriodCovering([period], p.startDate) !== null);

    if (clashes) {
      skippedPeriods++;
    } else {
      periodsToAdd.push(period);
    }
  }

  const loggedDays = new Set(existing.logs.map((l) => l.date));
  const logsToAdd = backup.dailyLogs.filter((l) => !loggedDays.has(l.date));

  const phoneIsEmpty = existing.periods.length === 0 && existing.logs.length === 0;

  return {
    periodsToAdd,
    logsToAdd,
    skippedPeriods,
    skippedLogs: backup.dailyLogs.length - logsToAdd.length,
    settingsToApply: phoneIsEmpty ? backup.settings : null,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A real calendar day in YYYY-MM-DD form — rejects 2026-02-30. */
function isISODate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    toISODate(parseISODate(value)) === value
  );
}

function optionalString(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  return typeof value === 'string' ? value : undefined;
}

function optionalTimestamp(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readPeriod(item: unknown): BackupPeriod | null {
  if (!isObject(item) || !isISODate(item.startDate)) return null;

  const notes = optionalString(item.notes);
  if (notes === undefined) return null;

  // An end date that isn't a real day, or falls before the start, is
  // dropped rather than rejecting the period: the period itself is still
  // real, and without an end its length is inferred as it always was.
  const endDate =
    isISODate(item.endDate) && item.endDate >= item.startDate ? item.endDate : null;

  return {
    startDate: item.startDate,
    endDate,
    notes,
    createdAt: optionalTimestamp(item.createdAt),
  };
}

function readDailyLog(item: unknown): BackupDailyLog | null {
  if (!isObject(item) || !isISODate(item.date)) return null;

  let flow: FlowLevel | null = null;
  if (item.flow !== undefined && item.flow !== null) {
    if (!FLOW_LEVELS.includes(item.flow as FlowLevel)) return null;
    flow = item.flow as FlowLevel;
  }

  let symptoms: string[] = [];
  if (item.symptoms !== undefined && item.symptoms !== null) {
    if (!Array.isArray(item.symptoms) || !item.symptoms.every((s) => typeof s === 'string')) {
      return null;
    }
    symptoms = item.symptoms as string[];
  }

  const mood = optionalString(item.mood);
  const notes = optionalString(item.notes);
  if (mood === undefined || notes === undefined) return null;

  return {
    date: item.date,
    flow,
    symptoms,
    mood,
    notes,
    createdAt: optionalTimestamp(item.createdAt),
    updatedAt: optionalTimestamp(item.updatedAt),
  };
}

function readSettings(value: unknown): BackupSettings | null {
  if (!isObject(value)) return null;

  const { language, calendarType, fallbackCycleDays, periodDurationDays, theme } = value;
  if (language !== 'fr' && language !== 'en') return null;
  if (calendarType !== 'gregorian' && calendarType !== 'hijri') return null;
  if (theme !== 'system' && theme !== 'light' && theme !== 'dark') return null;
  if (!Number.isInteger(fallbackCycleDays) || !Number.isInteger(periodDurationDays)) return null;

  // Held to the same ranges the Settings sliders allow, so an edited file
  // can't set a 300-day default cycle the app has no way to show.
  return {
    language,
    calendarType,
    fallbackCycleDays: clamp(fallbackCycleDays as number, MIN_CYCLE_DAYS, MAX_CYCLE_DAYS),
    periodDurationDays: clamp(
      periodDurationDays as number,
      MIN_PERIOD_DURATION_DAYS,
      MAX_PERIOD_DURATION_DAYS,
    ),
    theme,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

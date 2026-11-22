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
 *
 * Version 2 adds pregnancies, their visits and moments, and the
 * star-sign setting. A version 1 file reads as having none of them.
 * Version 2 files travel inside a zip with the Journey photos (see
 * backup-archive.ts); the JSON itself is the same either way.
 */

import {
  MAX_CYCLE_DAYS,
  MAX_PERIOD_DURATION_DAYS,
  MIN_CYCLE_DAYS,
  MIN_PERIOD_DURATION_DAYS,
} from '@/constants/cycle';
import type {
  DailyLog,
  FlowLevel,
  MomentKind,
  Period,
  Pregnancy,
  PregnancyMoment,
  PregnancyOutcome,
  PregnancyVisit,
  FastMadeUp,
  RamadanOwed,
  Settings,
  VisitKind,
} from '@/db/schema';
import { findPeriodCovering } from './cycle';
import { parseISODate, toISODate } from './date';

export const BACKUP_APP_ID = 'lumi';
export const BACKUP_FORMAT_VERSION = 2;

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
  /** Version 2. Files without it read as true, the app's default. */
  showStarSign: boolean;
  /** The Islamic option's school; absent in older files, read as off. */
  school: 'maliki' | null;
};

/** A Ramadan where she set the number of fasts owed herself. */
export type BackupRamadanOwed = { hijriYear: number; owedDays: number };
export type BackupFastMadeUp = { hijriYear: number; date: string; createdAt: number | null };

/**
 * `key` links visits and moments to their pregnancy inside the file. It
 * is the id on the phone that wrote it; a restore gives every pregnancy
 * a fresh id and re-links by key.
 */
export type BackupPregnancy = {
  key: string;
  lastPeriodDate: string;
  scanDueDate: string | null;
  endedOn: string | null;
  outcome: PregnancyOutcome | null;
  babyName: string | null;
  breastfeeding: boolean | null;
  /** 'kept' | 'deleted' after a loss; absent in older version 2 files. */
  journeyChoice: 'kept' | 'deleted' | null;
  startedAt: number | null;
  createdAt: number | null;
};

export type BackupVisit = {
  pregnancyKey: string;
  date: string;
  kind: VisitKind;
  title: string | null;
  weightKg: number | null;
  systolic: number | null;
  diastolic: number | null;
  notes: string | null;
  createdAt: number | null;
};

export type BackupMoment = {
  pregnancyKey: string;
  date: string;
  kind: MomentKind;
  text: string | null;
  /** Name of the photo inside the archive's photos/ folder. */
  photoFileName: string | null;
  createdAt: number | null;
};

export type Backup = {
  app: typeof BACKUP_APP_ID;
  formatVersion: number;
  /** ISO timestamp of when the file was written. */
  exportedAt: string;
  periods: BackupPeriod[];
  dailyLogs: BackupDailyLog[];
  settings: BackupSettings | null;
  pregnancies: BackupPregnancy[];
  visits: BackupVisit[];
  moments: BackupMoment[];
  /** Optional additions to version 2; empty in files written before them. */
  ramadanOwed: BackupRamadanOwed[];
  fastsMadeUp: BackupFastMadeUp[];
};

const FLOW_LEVELS: readonly FlowLevel[] = ['spotting', 'light', 'medium', 'heavy'];
const OUTCOMES: readonly PregnancyOutcome[] = ['birth', 'loss'];
const VISIT_KINDS: readonly VisitKind[] = ['checkup', 'ultrasound', 'blood_test', 'other'];
const MOMENT_KINDS: readonly MomentKind[] = ['positive_test', 'kick', 'due_date_change', 'photo', 'note'];

export type PregnancyData = {
  pregnancies: Pregnancy[];
  visits: PregnancyVisit[];
  moments: PregnancyMoment[];
  ramadanOwed?: RamadanOwed[];
  fastsMadeUp?: FastMadeUp[];
};

export function buildBackup(
  periodList: Period[],
  logList: DailyLog[],
  currentSettings: Settings | null,
  now: Date,
  pregnancyData: PregnancyData = { pregnancies: [], visits: [], moments: [] },
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
          showStarSign: currentSettings.showStarSign !== 0,
          school: currentSettings.school === 'maliki' ? 'maliki' : null,
        }
      : null,
    pregnancies: [...pregnancyData.pregnancies]
      .sort((a, b) => a.lastPeriodDate.localeCompare(b.lastPeriodDate))
      .map((p) => ({
        key: p.id,
        lastPeriodDate: p.lastPeriodDate,
        scanDueDate: p.scanDueDate ?? null,
        endedOn: p.endedOn ?? null,
        outcome: (p.outcome as PregnancyOutcome | null) ?? null,
        babyName: p.babyName ?? null,
        breastfeeding: p.breastfeeding === null || p.breastfeeding === undefined ? null : p.breastfeeding === 1,
        journeyChoice: p.journeyChoice === 'kept' || p.journeyChoice === 'deleted' ? p.journeyChoice : null,
        startedAt: p.startedAt ?? null,
        createdAt: p.createdAt ?? null,
      })),
    visits: [...pregnancyData.visits]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((v) => ({
        pregnancyKey: v.pregnancyId,
        date: v.date,
        kind: v.kind as VisitKind,
        title: v.title ?? null,
        weightKg: v.weightKg ?? null,
        systolic: v.systolic ?? null,
        diastolic: v.diastolic ?? null,
        notes: v.notes ?? null,
        createdAt: v.createdAt ?? null,
      })),
    moments: [...pregnancyData.moments]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((m) => ({
        pregnancyKey: m.pregnancyId,
        date: m.date,
        kind: m.kind as MomentKind,
        text: m.text ?? null,
        photoFileName: m.photoFileName ?? null,
        createdAt: m.createdAt ?? null,
      })),
    ramadanOwed: (pregnancyData.ramadanOwed ?? []).map((o) => ({
      hijriYear: o.hijriYear,
      owedDays: o.owedDays,
    })),
    fastsMadeUp: (pregnancyData.fastsMadeUp ?? []).map((f) => ({
      hijriYear: f.hijriYear,
      date: f.date,
      createdAt: f.createdAt ?? null,
    })),
  };
}

export function serializeBackup(backup: Backup): string {
  return JSON.stringify(backup, null, 2);
}

/** `lumi-backup-2026-11-21.zip`, dated by the phone's local calendar. */
export function backupFileName(now: Date): string {
  return `lumi-backup-${toISODate(now)}.zip`;
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

  // Version 1 files have no pregnancy data; version 2 files without a
  // list simply have none of that kind.
  const pregnancyList: BackupPregnancy[] = [];
  const keys = new Set<string>();
  for (const item of arrayOrEmpty(raw.pregnancies)) {
    const pregnancy = readPregnancy(item);
    if (!pregnancy || keys.has(pregnancy.key)) return { ok: false, error: 'invalid' };
    keys.add(pregnancy.key);
    pregnancyList.push(pregnancy);
  }

  const visitList: BackupVisit[] = [];
  for (const item of arrayOrEmpty(raw.visits)) {
    const visit = readVisit(item);
    // A visit pointing at a pregnancy the file doesn't contain is damage,
    // not something to guess about.
    if (!visit || !keys.has(visit.pregnancyKey)) return { ok: false, error: 'invalid' };
    visitList.push(visit);
  }

  const momentList: BackupMoment[] = [];
  for (const item of arrayOrEmpty(raw.moments)) {
    const moment = readMoment(item);
    if (!moment || !keys.has(moment.pregnancyKey)) return { ok: false, error: 'invalid' };
    momentList.push(moment);
  }

  const owedList: BackupRamadanOwed[] = [];
  for (const item of arrayOrEmpty(raw.ramadanOwed)) {
    if (
      !isObject(item) ||
      !Number.isInteger(item.hijriYear) ||
      !Number.isInteger(item.owedDays) ||
      (item.owedDays as number) < 0 ||
      (item.owedDays as number) > 30
    ) {
      return { ok: false, error: 'invalid' };
    }
    owedList.push({ hijriYear: item.hijriYear as number, owedDays: item.owedDays as number });
  }

  const madeUpList: BackupFastMadeUp[] = [];
  for (const item of arrayOrEmpty(raw.fastsMadeUp)) {
    if (!isObject(item) || !Number.isInteger(item.hijriYear) || !isISODate(item.date)) {
      return { ok: false, error: 'invalid' };
    }
    madeUpList.push({
      hijriYear: item.hijriYear as number,
      date: item.date,
      createdAt: optionalTimestamp(item.createdAt),
    });
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
      pregnancies: pregnancyList.sort((a, b) => a.lastPeriodDate.localeCompare(b.lastPeriodDate)),
      visits: visitList,
      moments: momentList,
      ramadanOwed: owedList,
      fastsMadeUp: madeUpList,
    },
  };
}

export type BackupSummary = {
  periodCount: number;
  logCount: number;
  pregnancyCount: number;
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
    pregnancyCount: backup.pregnancies.length,
    firstDate: dates[0] ?? null,
    lastDate: dates[dates.length - 1] ?? null,
  };
}

export type RestorePregnancy = {
  pregnancy: BackupPregnancy;
  visits: BackupVisit[];
  moments: BackupMoment[];
};

export type RestorePlan = {
  periodsToAdd: BackupPeriod[];
  logsToAdd: BackupDailyLog[];
  /** Each pregnancy to add, carrying its own visits and moments. */
  pregnanciesToAdd: RestorePregnancy[];
  /** Records left out because this phone already has its own version. */
  skippedPeriods: number;
  skippedLogs: number;
  /** Pregnancies overlapping one already on the phone, skipped together
   * with their visits and moments. */
  skippedPregnancies: number;
  /** Owed counts for years the phone has no number of its own for. */
  ramadanOwedToAdd: BackupRamadanOwed[];
  /** Made-up fasts the phone doesn't already have (same year and date). */
  fastsMadeUpToAdd: BackupFastMadeUp[];
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
 *  - A pregnancy whose dates overlap one already on the phone is skipped,
 *    with its visits and moments. Two overlapping pregnancies can't both
 *    be real, and the phone's own record wins as everywhere else.
 *  - Settings come from the file only when the phone has no periods, no
 *    logs and no pregnancies, i.e. a new phone. Otherwise the user has
 *    already set this phone up the way they want it.
 */
export function planRestore(
  existing: {
    periods: { startDate: string; endDate: string | null }[];
    logs: { date: string }[];
    pregnancies?: { lastPeriodDate: string; endedOn: string | null }[];
    ramadanOwed?: { hijriYear: number }[];
    fastsMadeUp?: { hijriYear: number; date: string }[];
  },
  backup: Backup,
): RestorePlan {
  const existingPregnancies = existing.pregnancies ?? [];
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

  const pregnanciesToAdd: RestorePregnancy[] = [];
  let skippedPregnancies = 0;
  for (const pregnancy of backup.pregnancies) {
    const start = pregnancy.lastPeriodDate;
    const end = pregnancy.endedOn ?? OPEN_ENDED;
    const overlaps = existingPregnancies.some(
      (p) => start <= (p.endedOn ?? OPEN_ENDED) && p.lastPeriodDate <= end,
    );
    if (overlaps) {
      skippedPregnancies++;
      continue;
    }
    pregnanciesToAdd.push({
      pregnancy,
      visits: backup.visits.filter((v) => v.pregnancyKey === pregnancy.key),
      moments: backup.moments.filter((m) => m.pregnancyKey === pregnancy.key),
    });
  }

  const phoneIsEmpty =
    existing.periods.length === 0 &&
    existing.logs.length === 0 &&
    existingPregnancies.length === 0;

  return {
    periodsToAdd,
    logsToAdd,
    pregnanciesToAdd,
    skippedPeriods,
    skippedLogs: backup.dailyLogs.length - logsToAdd.length,
    skippedPregnancies,
    ramadanOwedToAdd: backup.ramadanOwed.filter(
      (o) => !(existing.ramadanOwed ?? []).some((e) => e.hijriYear === o.hijriYear),
    ),
    fastsMadeUpToAdd: backup.fastsMadeUp.filter(
      (f) => !(existing.fastsMadeUp ?? []).some((e) => e.hijriYear === f.hijriYear && e.date === f.date),
    ),
    settingsToApply: phoneIsEmpty ? backup.settings : null,
  };
}

/** Stands in for "still going" when comparing date ranges. */
const OPEN_ENDED = '9999-12-31';

function arrayOrEmpty(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function optionalISODate(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  return isISODate(value) ? value : undefined;
}

function optionalNumber(value: unknown): number | null | undefined {
  if (value === undefined || value === null) return null;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** A plain file name: no folders, so a crafted file can't write outside
 * the photo folder on restore. */
function optionalFileName(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  return typeof value === 'string' && /^[A-Za-z0-9._-]+$/.test(value) && !value.startsWith('.')
    ? value
    : undefined;
}

function readPregnancy(item: unknown): BackupPregnancy | null {
  if (!isObject(item) || typeof item.key !== 'string' || item.key === '') return null;
  if (!isISODate(item.lastPeriodDate)) return null;
  const scanDueDate = optionalISODate(item.scanDueDate);
  const endedOn = optionalISODate(item.endedOn);
  const babyName = optionalString(item.babyName);
  if (scanDueDate === undefined || endedOn === undefined || babyName === undefined) return null;
  if (endedOn !== null && endedOn <= item.lastPeriodDate) return null;

  let outcome: PregnancyOutcome | null = null;
  if (item.outcome !== undefined && item.outcome !== null) {
    if (!OUTCOMES.includes(item.outcome as PregnancyOutcome)) return null;
    outcome = item.outcome as PregnancyOutcome;
  }
  // An ended pregnancy must say how it ended, and an open one mustn't.
  if ((endedOn === null) !== (outcome === null)) return null;

  return {
    key: item.key,
    lastPeriodDate: item.lastPeriodDate,
    scanDueDate,
    endedOn,
    outcome,
    babyName,
    breastfeeding: typeof item.breastfeeding === 'boolean' ? item.breastfeeding : null,
    journeyChoice:
      item.journeyChoice === 'kept' || item.journeyChoice === 'deleted' ? item.journeyChoice : null,
    startedAt: optionalTimestamp(item.startedAt),
    createdAt: optionalTimestamp(item.createdAt),
  };
}

function readVisit(item: unknown): BackupVisit | null {
  if (!isObject(item) || typeof item.pregnancyKey !== 'string' || !isISODate(item.date)) return null;
  if (!VISIT_KINDS.includes(item.kind as VisitKind)) return null;
  const title = optionalString(item.title);
  const notes = optionalString(item.notes);
  const weightKg = optionalNumber(item.weightKg);
  const systolic = optionalNumber(item.systolic);
  const diastolic = optionalNumber(item.diastolic);
  if ([title, notes, weightKg, systolic, diastolic].includes(undefined)) return null;
  return {
    pregnancyKey: item.pregnancyKey,
    date: item.date,
    kind: item.kind as VisitKind,
    title: title as string | null,
    weightKg: weightKg as number | null,
    systolic: systolic as number | null,
    diastolic: diastolic as number | null,
    notes: notes as string | null,
    createdAt: optionalTimestamp(item.createdAt),
  };
}

function readMoment(item: unknown): BackupMoment | null {
  if (!isObject(item) || typeof item.pregnancyKey !== 'string' || !isISODate(item.date)) return null;
  if (!MOMENT_KINDS.includes(item.kind as MomentKind)) return null;
  const text = optionalString(item.text);
  const photoFileName = optionalFileName(item.photoFileName);
  if (text === undefined || photoFileName === undefined) return null;
  return {
    pregnancyKey: item.pregnancyKey,
    date: item.date,
    kind: item.kind as MomentKind,
    text,
    photoFileName,
    createdAt: optionalTimestamp(item.createdAt),
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

  const { language, calendarType, fallbackCycleDays, periodDurationDays, theme, showStarSign } =
    value;
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
    showStarSign: typeof showStarSign === 'boolean' ? showStarSign : true,
    school: value.school === 'maliki' ? 'maliki' : null,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

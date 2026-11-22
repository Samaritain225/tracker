/**
 * Database schema for the Cycle Tracker app.
 * All dates stored as Gregorian ISO strings (YYYY-MM-DD).
 * The calendar_type setting only affects display, never storage.
 * IDs use text UUIDs for portability.
 */

import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Generates a UUID v4 string.
 * Uses crypto.randomUUID when available, falls back to manual generation.
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const periods = sqliteTable('periods', {
  id: text('id').primaryKey().$defaultFn(generateId),
  startDate: text('start_date').notNull().unique(),
  /**
   * Nullable: null means the period's actual length is unknown and
   * getDayType should fall back to the settings default duration.
   * Derived from consecutive daily_logs.flow entries when available.
   */
  endDate: text('end_date'),
  notes: text('notes'),
  createdAt: integer('created_at').$defaultFn(() => Date.now()),
});

export const settings = sqliteTable('settings', {
  id: text('id').primaryKey().$defaultFn(generateId),
  language: text('language').notNull().default('fr'),
  calendarType: text('calendar_type').notNull().default('gregorian'),
  fallbackCycleDays: integer('fallback_cycle_days').notNull().default(28),
  periodDurationDays: integer('period_duration_days').notNull().default(5),
  theme: text('theme').notNull().default('system'),
  appLockEnabled: integer('app_lock_enabled').notNull().default(0),
  remindersEnabled: integer('reminders_enabled').notNull().default(0),
  /** Whether pregnancy screens show the baby's likely star sign. */
  showStarSign: integer('show_star_sign').notNull().default(1),
  /**
   * The period start date the user answered "Not pregnant" for, so the
   * late-period prompt stays hidden for that cycle and comes back for
   * the next one. Null when never dismissed.
   */
  pregnancyPromptDismissedFor: text('pregnancy_prompt_dismissed_for'),
  /**
   * The school of Islamic jurisprudence whose reference limits are shown
   * ('maliki'), or null when the Islamic option is off.
   */
  school: text('school'),
});

export const dailyLogs = sqliteTable('daily_logs', {
  id: text('id').primaryKey().$defaultFn(generateId),
  date: text('date').notNull().unique(), // ISO string YYYY-MM-DD
  flow: text('flow'), // enum: spotting, light, medium, heavy
  symptoms: text('symptoms', { mode: 'json' }).$type<string[]>(),
  mood: text('mood'),
  notes: text('notes'),
  createdAt: integer('created_at').$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').$defaultFn(() => Date.now()),
});

/**
 * One row per pregnancy. Active while `endedOn` is null. Dates are
 * Gregorian ISO strings like everything else; the effective due date is
 * `scanDueDate` when set, otherwise last period date + 280 days.
 */
export const pregnancies = sqliteTable('pregnancies', {
  id: text('id').primaryKey().$defaultFn(generateId),
  lastPeriodDate: text('last_period_date').notNull(),
  scanDueDate: text('scan_due_date'),
  startedAt: integer('started_at').$defaultFn(() => Date.now()),
  endedOn: text('ended_on'),
  /** 'birth' | 'loss', null while the pregnancy is active. */
  outcome: text('outcome'),
  babyName: text('baby_name'),
  /** Asked during recovery after a birth; null until answered. */
  breastfeeding: integer('breastfeeding'),
  /**
   * After a loss, whether she chose to keep the Journey ('kept') or
   * delete it ('deleted' — visits, moments and photos removed, the
   * pregnancy itself kept so cycle maths still leaves it out). Null
   * until asked; never asked after a birth.
   */
  journeyChoice: text('journey_choice'),
  /**
   * Her usual cycle length when the pregnancy was set up, used to shift
   * the due date for cycles longer or shorter than 28 days. Stored, not
   * recomputed, so cycles logged after the pregnancy never move its
   * dates. Null for pregnancies set up before this existed, or when her
   * cycles gave nothing reliable: no adjustment.
   */
  cycleLengthDays: integer('cycle_length_days'),
  createdAt: integer('created_at').$defaultFn(() => Date.now()),
});

export const pregnancyVisits = sqliteTable('pregnancy_visits', {
  id: text('id').primaryKey().$defaultFn(generateId),
  pregnancyId: text('pregnancy_id')
    .notNull()
    .references(() => pregnancies.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  /** 'checkup' | 'ultrasound' | 'blood_test' | 'other' */
  kind: text('kind').notNull(),
  title: text('title'),
  weightKg: real('weight_kg'),
  systolic: integer('systolic'),
  diastolic: integer('diastolic'),
  notes: text('notes'),
  createdAt: integer('created_at').$defaultFn(() => Date.now()),
});

export const pregnancyMoments = sqliteTable('pregnancy_moments', {
  id: text('id').primaryKey().$defaultFn(generateId),
  pregnancyId: text('pregnancy_id')
    .notNull()
    .references(() => pregnancies.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  /** 'positive_test' | 'kick' | 'due_date_change' | 'photo' | 'note' */
  kind: text('kind').notNull(),
  text: text('text'),
  /** File name inside the app's pregnancy-photos folder. */
  photoFileName: text('photo_file_name'),
  createdAt: integer('created_at').$defaultFn(() => Date.now()),
});

/**
 * The number of Ramadan fasts owed for a Hijri year, only where she
 * changed the app's suggestion. With no row, the suggestion stands.
 */
export const ramadanOwed = sqliteTable('ramadan_owed', {
  hijriYear: integer('hijri_year').primaryKey(),
  owedDays: integer('owed_days').notNull(),
  updatedAt: integer('updated_at').$defaultFn(() => Date.now()),
});

/** One row per Ramadan fast she has made up. */
export const fastsMadeUp = sqliteTable('fasts_made_up', {
  id: text('id').primaryKey().$defaultFn(generateId),
  hijriYear: integer('hijri_year').notNull(),
  date: text('date').notNull(),
  createdAt: integer('created_at').$defaultFn(() => Date.now()),
});

/**
 * Symptoms she added herself. A daily log stores `custom:<id>` among its
 * symptom keys, so a rename shows on every past day. Hidden ones leave
 * the day sheet but keep their name for the days already logged; rows
 * are never deleted while she keeps her data.
 */
export const customSymptoms = sqliteTable('custom_symptoms', {
  id: text('id').primaryKey().$defaultFn(generateId),
  label: text('label').notNull(),
  hidden: integer('hidden').notNull().default(0),
  createdAt: integer('created_at').$defaultFn(() => Date.now()),
});

/** Inferred types for use throughout the app */
export type Period = typeof periods.$inferSelect;
export type NewPeriod = typeof periods.$inferInsert;
export type Settings = typeof settings.$inferSelect;
export type DailyLog = typeof dailyLogs.$inferSelect;
export type NewDailyLog = typeof dailyLogs.$inferInsert;
export type Pregnancy = typeof pregnancies.$inferSelect;
export type PregnancyVisit = typeof pregnancyVisits.$inferSelect;
export type PregnancyMoment = typeof pregnancyMoments.$inferSelect;
export type PregnancyOutcome = 'birth' | 'loss';
export type VisitKind = 'checkup' | 'ultrasound' | 'blood_test' | 'other';
export type RamadanOwed = typeof ramadanOwed.$inferSelect;
export type FastMadeUp = typeof fastsMadeUp.$inferSelect;
export type CustomSymptom = typeof customSymptoms.$inferSelect;
export type MomentKind = 'positive_test' | 'kick' | 'due_date_change' | 'photo' | 'note';

/** dailyLogs.flow vocabulary — see schema comment on that column. */
export type FlowLevel = 'spotting' | 'light' | 'medium' | 'heavy';

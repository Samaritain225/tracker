/**
 * Database schema for the Cycle Tracker app.
 * All dates stored as Gregorian ISO strings (YYYY-MM-DD).
 * The calendar_type setting only affects display, never storage.
 * IDs use text UUIDs for portability.
 */

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
});

export const dailyLogs = sqliteTable('daily_logs', {
  id: text('id').primaryKey().$defaultFn(generateId),
  date: text('date').notNull().unique(), // ISO string YYYY-MM-DD
  flow: text('flow'), // enum: light, medium, heavy
  symptoms: text('symptoms', { mode: 'json' }).$type<string[]>(),
  mood: text('mood'),
  notes: text('notes'),
  createdAt: integer('created_at').$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').$defaultFn(() => Date.now()),
});

/** Inferred types for use throughout the app */
export type Period = typeof periods.$inferSelect;
export type NewPeriod = typeof periods.$inferInsert;
export type Settings = typeof settings.$inferSelect;
export type DailyLog = typeof dailyLogs.$inferSelect;
export type NewDailyLog = typeof dailyLogs.$inferInsert;

/**
 * Patterns in her own logs: symptoms and moods that keep landing in the
 * same part of her cycle. Pure, so every threshold is tested directly.
 *
 * Only completed cycles count (a later period has started), so "the days
 * before your period" are known rather than predicted. A gap that holds
 * a pregnancy, or one too short or long to be a cycle, is left out, as
 * it is from the averages.
 *
 * A pattern is only ever a description of what she logged, with the
 * count behind it. Nothing here names a condition.
 */

import { MAX_PLAUSIBLE_CYCLE_GAP_DAYS, MIN_PLAUSIBLE_CYCLE_GAP_DAYS } from '@/constants/cycle';
import { computePeriodDuration } from './cycle';
import { addDays, daysBetween, parseISODate, toISODate } from './date';
import type { DateSpan } from './pregnancy';

/** The part of a cycle a logged day falls in. */
export type CycleWindow = 'period' | 'before' | 'rest';

/** How many days before the next period count as "before your period". */
export const BEFORE_DAYS = 3;
/** A symptom or mood needs this many logged days before it can be a pattern. */
export const MIN_DAYS = 4;
/** ...spread over at least this many cycles. */
export const MIN_CYCLES = 2;
/** ...with at least this share of those days in one window. */
export const MIN_SHARE = 0.6;
/** At most this many sentences on the card. */
export const MAX_PATTERNS = 5;

export type Pattern = {
  kind: 'symptom' | 'mood';
  key: string;
  /** Only 'period' or 'before': most days falling in "the rest of the cycle" says nothing. */
  window: Exclude<CycleWindow, 'rest'>;
  /** Days logged in that window. */
  days: number;
  /** Days logged across all completed cycles. */
  total: number;
};

export type PatternResult =
  /** Fewer completed cycles than patterns need; `cycles` is how many there are. */
  | { status: 'not_enough'; cycles: number }
  | { status: 'none'; cycles: number }
  | { status: 'found'; cycles: number; patterns: Pattern[] };

type PeriodLike = { startDate: string; endDate: string | null };
type LogLike = { date: string; symptoms: string[] | null; mood: string | null };

export type CompletedCycle = { start: string; next: string; periodDays: number };

/**
 * Completed cycles: from one period's start to the next one's, leaving
 * out a gap that holds a pregnancy or isn't a plausible cycle length.
 */
export function completedCycles(
  periods: PeriodLike[],
  flowDates: Set<string>,
  defaultDurationDays: number,
  spans: DateSpan[] = [],
): CompletedCycle[] {
  const sorted = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const cycles: CompletedCycle[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i].startDate;
    const next = sorted[i + 1].startDate;
    if (spans.some((s) => start <= s.end && next > s.start)) continue;
    const length = daysBetween(parseISODate(start), parseISODate(next));
    if (length < MIN_PLAUSIBLE_CYCLE_GAP_DAYS || length > MAX_PLAUSIBLE_CYCLE_GAP_DAYS) continue;
    const { days } = computePeriodDuration(sorted[i], flowDates, defaultDurationDays);
    cycles.push({ start, next, periodDays: Math.min(days, length) });
  }
  return cycles;
}

/** Which window a date falls in within a completed cycle. The period wins an overlap. */
export function windowOf(date: string, cycle: CompletedCycle): CycleWindow {
  const day = daysBetween(parseISODate(cycle.start), parseISODate(date));
  if (day < cycle.periodDays) return 'period';
  const beforeStart = toISODate(addDays(parseISODate(cycle.next), -BEFORE_DAYS));
  return date >= beforeStart ? 'before' : 'rest';
}

type Tally = { kind: Pattern['kind']; key: string; byWindow: Record<CycleWindow, number>; cycles: Set<string> };

export function findPatterns(input: {
  periods: PeriodLike[];
  logs: LogLike[];
  flowDates: Set<string>;
  defaultDurationDays: number;
  spans?: DateSpan[];
}): PatternResult {
  const cycles = completedCycles(input.periods, input.flowDates, input.defaultDurationDays, input.spans);
  if (cycles.length < MIN_CYCLES) return { status: 'not_enough', cycles: cycles.length };

  const tallies = new Map<string, Tally>();
  const add = (kind: Pattern['kind'], key: string, window: CycleWindow, cycleStart: string) => {
    const id = `${kind}:${key}`;
    const tally = tallies.get(id) ?? { kind, key, byWindow: { period: 0, before: 0, rest: 0 }, cycles: new Set() };
    tally.byWindow[window]++;
    tally.cycles.add(cycleStart);
    tallies.set(id, tally);
  };

  for (const log of input.logs) {
    const cycle = cycles.find((c) => log.date >= c.start && log.date < c.next);
    if (!cycle) continue;
    const window = windowOf(log.date, cycle);
    for (const key of new Set(log.symptoms ?? [])) add('symptom', key, window, cycle.start);
    if (log.mood) add('mood', log.mood, window, cycle.start);
  }

  const patterns: Pattern[] = [];
  for (const tally of tallies.values()) {
    const total = tally.byWindow.period + tally.byWindow.before + tally.byWindow.rest;
    if (total < MIN_DAYS || tally.cycles.size < MIN_CYCLES) continue;
    const window = tally.byWindow.before > tally.byWindow.period ? 'before' : 'period';
    const days = tally.byWindow[window];
    if (days / total < MIN_SHARE) continue;
    patterns.push({ kind: tally.kind, key: tally.key, window, days, total });
  }

  patterns.sort((a, b) => b.days - a.days || b.days / b.total - a.days / a.total);
  return patterns.length > 0
    ? { status: 'found', cycles: cycles.length, patterns: patterns.slice(0, MAX_PATTERNS) }
    : { status: 'none', cycles: cycles.length };
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * One pattern as a sentence with its evidence, shared by the Insights
 * card and the doctor summary so both say exactly the same thing.
 */
export function patternSentence(pattern: Pattern, t: Translate, labelOf: (key: string) => string): string {
  const name = pattern.kind === 'mood' ? t('patterns.mood', { mood: t(`day_details.mood_${pattern.key}`) }) : labelOf(pattern.key);
  const when =
    pattern.window === 'period' ? t('patterns.during_period') : t('patterns.before_period', { count: BEFORE_DAYS });
  return t('patterns.sentence', { name, when, days: pattern.days, total: pattern.total });
}

/**
 * The Journey: one timeline for a pregnancy, built from visits, moments
 * and daily logs. Pure, so the order and grouping are tested directly.
 *
 * Newest first, with upcoming visits at the top and today marked between
 * the future and the past while the pregnancy is in progress.
 */

import { addDays, parseISODate, toISODate } from './date';
import { gestationStartDate, gestationalAge } from './pregnancy';
import type { PregnancyLike } from './pregnancy';

type VisitLike = { id: string; date: string };
type MomentLike = { id: string; date: string; createdAt: number | null };
type LogLike = { date: string; symptoms: string[] | null };

export type WeekSummary = {
  week: number;
  /** First day of that gestational week. */
  startDate: string;
  daysLogged: number;
  /** Most frequent first; ties keep the order they were first seen. */
  symptoms: { key: string; days: number }[];
};

export type JourneyEntry<V extends VisitLike, M extends MomentLike> =
  | { type: 'visit'; date: string; visit: V; upcoming: boolean }
  | { type: 'moment'; date: string; moment: M }
  | { type: 'week'; date: string; summary: WeekSummary }
  | { type: 'milestone'; date: string; week: number; label: string }
  | { type: 'today'; date: string }
  | { type: 'ended'; date: string; outcome: 'birth' | 'loss' };

/** How many of the most frequent symptoms a week's summary names. */
const SUMMARY_SYMPTOMS = 3;

/**
 * One summary per gestational week that has a logged symptom, counting
 * on how many days of that week each symptom was logged.
 */
export function summarizeWeeks(
  pregnancy: Pick<PregnancyLike, 'lastPeriodDate' | 'scanDueDate' | 'cycleLengthDays' | 'endedOn'>,
  logs: LogLike[],
): WeekSummary[] {
  const start = gestationStartDate(pregnancy);
  const end = pregnancy.endedOn ?? '9999-12-31';
  const byWeek = new Map<number, { days: number; counts: Map<string, number> }>();

  for (const log of logs) {
    if (log.date <= start || log.date > end) continue;
    const symptoms = log.symptoms ?? [];
    if (symptoms.length === 0) continue;
    const { weeks } = gestationalAge(pregnancy, log.date);
    const bucket = byWeek.get(weeks) ?? { days: 0, counts: new Map<string, number>() };
    bucket.days++;
    for (const s of symptoms) bucket.counts.set(s, (bucket.counts.get(s) ?? 0) + 1);
    byWeek.set(weeks, bucket);
  }

  return [...byWeek.entries()]
    .sort(([a], [b]) => a - b)
    .map(([week, { days, counts }]) => ({
      week,
      startDate: toISODate(addDays(parseISODate(start), week * 7)),
      daysLogged: days,
      symptoms: [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, SUMMARY_SYMPTOMS)
        .map(([key, d]) => ({ key, days: d })),
    }));
}

export function buildJourney<V extends VisitLike, M extends MomentLike>(
  pregnancy: Pick<PregnancyLike, 'lastPeriodDate' | 'scanDueDate' | 'cycleLengthDays' | 'endedOn' | 'outcome'>,
  visits: V[],
  moments: M[],
  logs: LogLike[],
  todayISO: string,
  milestones: { week: number; label: string }[] = [],
): JourneyEntry<V, M>[] {
  const entries: JourneyEntry<V, M>[] = [];

  // Milestones appear once reached, and never after a loss: "Halfway
  // there" on the timeline of a pregnancy that ended is the opposite of
  // what the loss path promises.
  if (pregnancy.outcome !== 'loss') {
    const start = parseISODate(gestationStartDate(pregnancy));
    const reachedBy = pregnancy.endedOn ?? todayISO;
    for (const m of milestones) {
      const date = toISODate(addDays(start, m.week * 7));
      if (date <= reachedBy) entries.push({ type: 'milestone', date, week: m.week, label: m.label });
    }
  }

  for (const visit of visits) {
    entries.push({ type: 'visit', date: visit.date, visit, upcoming: visit.date > todayISO });
  }
  for (const moment of moments) {
    entries.push({ type: 'moment', date: moment.date, moment });
  }
  for (const summary of summarizeWeeks(pregnancy, logs)) {
    entries.push({ type: 'week', date: summary.startDate, summary });
  }

  if (pregnancy.endedOn) {
    entries.push({
      type: 'ended',
      date: pregnancy.endedOn,
      outcome: pregnancy.outcome === 'birth' ? 'birth' : 'loss',
    });
  } else {
    entries.push({ type: 'today', date: todayISO });
  }

  // Newest first. On the same day: the ending or today first, then
  // visits, then moments (latest added first), then the week summary,
  // which describes the days after its start date.
  const rank = { ended: 0, today: 0, milestone: 1, visit: 2, moment: 3, week: 4 } as const;
  return entries.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    if (rank[a.type] !== rank[b.type]) return rank[a.type] - rank[b.type];
    if (a.type === 'moment' && b.type === 'moment') {
      return (b.moment.createdAt ?? 0) - (a.moment.createdAt ?? 0);
    }
    return 0;
  });
}

export type SymptomGrid = {
  /** Every gestational week from the first logged one to `upToWeek`. */
  weeks: number[];
  /** One row per symptom, most logged first; counts are days per week. */
  rows: { key: string; counts: number[] }[];
};

/**
 * Symptoms by week for pregnancy Insights: how many days of each week
 * each symptom was logged. Weeks with nothing logged stay in the grid as
 * zeros, so gaps are visible rather than closed up.
 */
export function symptomGridByWeek(
  pregnancy: Pick<PregnancyLike, 'lastPeriodDate' | 'scanDueDate' | 'cycleLengthDays' | 'endedOn'>,
  logs: LogLike[],
  upToWeek: number,
  maxRows: number = 8,
): SymptomGrid {
  const start = gestationStartDate(pregnancy);
  const end = pregnancy.endedOn ?? '9999-12-31';
  const perWeek = new Map<number, Map<string, number>>();
  const totals = new Map<string, number>();

  for (const log of logs) {
    if (log.date <= start || log.date > end) continue;
    const { weeks } = gestationalAge(pregnancy, log.date);
    for (const key of log.symptoms ?? []) {
      const week = perWeek.get(weeks) ?? new Map<string, number>();
      week.set(key, (week.get(key) ?? 0) + 1);
      perWeek.set(weeks, week);
      totals.set(key, (totals.get(key) ?? 0) + 1);
    }
  }

  if (perWeek.size === 0) return { weeks: [], rows: [] };

  const first = Math.min(...perWeek.keys());
  const weeks = Array.from({ length: Math.max(0, upToWeek - first + 1) }, (_, i) => first + i);
  const keys = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxRows)
    .map(([key]) => key);

  return {
    weeks,
    rows: keys.map((key) => ({ key, counts: weeks.map((w) => perWeek.get(w)?.get(key) ?? 0) })),
  };
}

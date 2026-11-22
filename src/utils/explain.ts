/**
 * "How Lumi works it out": each calculation the app makes, as a plain
 * rule, her own numbers run through it, and what it can't know.
 *
 * Every number in the rules comes from the same constants and functions
 * the calculations use, so the explanation can't drift from what the app
 * actually does. Pure, so the numbers she is shown are tested.
 *
 * The result is translation keys with their values; the screen renders
 * them.
 */

import {
  DEFAULT_PERIOD_DURATION_DAYS,
  FERTILE_DAYS_AFTER_OVULATION,
  FERTILE_DAYS_BEFORE_OVULATION,
  LATE_TEST_SUGGESTION_DAYS,
  MAX_PLAUSIBLE_CYCLE_GAP_DAYS,
  MIN_PLAUSIBLE_CYCLE_GAP_DAYS,
  OVULATION_OFFSET_FROM_END,
  RECENT_CYCLE_WINDOW,
} from '@/constants/cycle';
import {
  computeAveragePeriodLength,
  computeCycleLength,
  computeCycleVariance,
  computeFertileWindow,
  computeNextPeriod,
  computeOvulationDay,
  recentPlausibleGaps,
} from './cycle';
import { daysBetween, parseISODate, toISODate } from './date';
import { BEFORE_DAYS, MIN_CYCLES, MIN_DAYS, MIN_SHARE } from './patterns';
import {
  MAX_DATING_CYCLE_DAYS,
  MIN_DATING_CYCLE_DAYS,
  PREGNANCY_LENGTH_DAYS,
  STANDARD_CYCLE_DAYS,
  cycleAdjustmentDays,
  effectiveDueDate,
  findActivePregnancy,
  gestationalAge,
  pregnancySpans,
} from './pregnancy';

export type SectionId = 'cycle' | 'late' | 'ovulation' | 'period' | 'pregnancy' | 'patterns' | 'ramadan';

/**
 * A translation key and the values it takes. `dates` are ISO strings the
 * screen formats in her calendar and passes as date1, date2, date3.
 */
export type Line = { key: string; values?: Record<string, string | number>; dates?: string[] };

export type ExplainSection = {
  id: SectionId;
  /** The rule, in general terms. */
  rule: Line;
  /** Her own numbers through the rule, when there are any. */
  yours: Line | null;
  /** What the rule can't know. */
  limit: Line | null;
};

type PeriodLike = { startDate: string; endDate: string | null };
type LogLike = { date: string; flow: string | null };
type PregnancyLike = {
  id: string;
  lastPeriodDate: string;
  scanDueDate: string | null;
  endedOn: string | null;
  outcome: string | null;
  cycleLengthDays?: number | null;
};

export function explainSections(input: {
  periods: PeriodLike[];
  logs: LogLike[];
  pregnancies: PregnancyLike[];
  fallbackCycleDays: number;
  periodDurationDays: number;
  islamicOn: boolean;
  todayISO: string;
}): ExplainSection[] {
  const { todayISO } = input;
  const sortedDates = input.periods.map((p) => p.startDate).sort();
  const spans = pregnancySpans(input.pregnancies);
  const gaps = recentPlausibleGaps(sortedDates, spans);
  const cycleLength = computeCycleLength(sortedDates, input.fallbackCycleDays, spans);
  const variance = computeCycleVariance(sortedDates, spans);
  const lastPeriod = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : null;
  const active = findActivePregnancy(input.pregnancies);

  const sections: ExplainSection[] = [];

  // How long a cycle is, and when the next period is expected.
  const nextISO = lastPeriod ? toISODate(computeNextPeriod(lastPeriod, cycleLength)) : null;
  sections.push({
    id: 'cycle',
    rule: {
      key: 'how.cycle_rule',
      values: {
        window: RECENT_CYCLE_WINDOW,
        min: MIN_PLAUSIBLE_CYCLE_GAP_DAYS,
        max: MAX_PLAUSIBLE_CYCLE_GAP_DAYS,
        fallback: input.fallbackCycleDays,
      },
    },
    yours:
      gaps && lastPeriod && nextISO
        ? {
            key: 'how.cycle_yours',
            values: { gaps: gaps.join(', '), count: gaps.length, length: cycleLength },
            dates: [lastPeriod, nextISO],
          }
        : lastPeriod && nextISO
          ? { key: 'how.cycle_yours_fallback', values: { length: cycleLength }, dates: [lastPeriod, nextISO] }
          : { key: 'how.cycle_yours_none', values: { length: cycleLength } },
    limit: variance !== null && variance > 0
      ? { key: 'how.cycle_limit_variance', values: { count: variance } }
      : { key: 'how.cycle_limit' },
  });

  // Late, and the pregnancy question.
  const daysLate = nextISO && !active ? Math.max(0, daysBetween(parseISODate(nextISO), parseISODate(todayISO))) : 0;
  sections.push({
    id: 'late',
    rule: { key: 'how.late_rule', values: { count: LATE_TEST_SUGGESTION_DAYS } },
    yours: daysLate > 0 ? { key: 'how.late_yours', values: { count: daysLate }, dates: [nextISO!] } : null,
    limit: { key: 'how.late_limit' },
  });

  // Ovulation and fertile days.
  let ovulationYours: Line | null = null;
  if (lastPeriod && !active) {
    const ovulation = computeOvulationDay(lastPeriod, cycleLength);
    const fertile = computeFertileWindow(ovulation);
    ovulationYours = {
      key: 'how.ovulation_yours',
      values: { length: cycleLength, offset: OVULATION_OFFSET_FROM_END },
      dates: [toISODate(ovulation), toISODate(fertile.start), toISODate(fertile.end)],
    };
  }
  sections.push({
    id: 'ovulation',
    rule: {
      key: 'how.ovulation_rule',
      values: {
        offset: OVULATION_OFFSET_FROM_END,
        before: FERTILE_DAYS_BEFORE_OVULATION,
        after: FERTILE_DAYS_AFTER_OVULATION,
      },
    },
    yours: ovulationYours,
    limit: { key: 'how.ovulation_limit' },
  });

  // How long a period lasted.
  const flowDates = new Set(input.logs.filter((l) => l.flow).map((l) => l.date));
  const averagePeriod = computeAveragePeriodLength(input.periods, flowDates, input.periodDurationDays, todayISO);
  sections.push({
    id: 'period',
    rule: { key: 'how.period_rule', values: { days: input.periodDurationDays || DEFAULT_PERIOD_DURATION_DAYS } },
    yours: averagePeriod !== null ? { key: 'how.period_yours', values: { count: averagePeriod } } : null,
    limit: null,
  });

  // Pregnancy weeks and due date.
  let pregnancyYours: Line | null = null;
  if (active) {
    const age = gestationalAge(active, todayISO);
    const shift = cycleAdjustmentDays(active.cycleLengthDays);
    pregnancyYours = active.scanDueDate
      ? {
          key: 'how.pregnancy_yours_scan',
          values: { weeks: age.weeks, days: age.days },
          dates: [effectiveDueDate(active)],
        }
      : {
          key: shift === 0 ? 'how.pregnancy_yours' : 'how.pregnancy_yours_adjusted',
          values: { weeks: age.weeks, days: age.days, length: active.cycleLengthDays ?? STANDARD_CYCLE_DAYS, shift },
          dates: [active.lastPeriodDate, effectiveDueDate(active)],
        };
  }
  sections.push({
    id: 'pregnancy',
    rule: {
      key: 'how.pregnancy_rule',
      values: {
        days: PREGNANCY_LENGTH_DAYS,
        standard: STANDARD_CYCLE_DAYS,
        min: MIN_DATING_CYCLE_DAYS,
        max: MAX_DATING_CYCLE_DAYS,
      },
    },
    yours: pregnancyYours,
    limit: { key: 'how.pregnancy_limit' },
  });

  sections.push({
    id: 'patterns',
    rule: {
      key: 'how.patterns_rule',
      values: { before: BEFORE_DAYS, days: MIN_DAYS, cycles: MIN_CYCLES, share: Math.round(MIN_SHARE * 100) },
    },
    yours: null,
    limit: { key: 'how.patterns_limit' },
  });

  if (input.islamicOn) {
    sections.push({ id: 'ramadan', rule: { key: 'how.ramadan_rule' }, yours: null, limit: { key: 'how.ramadan_limit' } });
  }

  return sections;
}

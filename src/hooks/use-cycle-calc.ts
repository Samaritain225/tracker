/**
 * Hook for derived cycle calculations.
 * All computation is memoized and depends on periods + daily logs +
 * settings + today. Returns everything the UI needs for calendar
 * coloring and metric display.
 */

import { useMemo } from 'react';

import { DEFAULT_CYCLE_DAYS, DEFAULT_PERIOD_DURATION_DAYS } from '@/constants/cycle';
import type { DailyLog, Period, Settings } from '@/db/schema';
import {
  buildCycleWindows,
  computeCycleLength,
  isPeriodOngoing,
} from '@/utils/cycle';
import type { CycleWindow } from '@/utils/cycle';
import { computePhase } from '@/utils/phase';
import type { PhaseInfo } from '@/utils/phase';
import { daysBetween, parseISODate } from '@/utils/date';

export type CycleInfo = {
  cycleLength: number;
  cycleSource: 'calculated' | 'fallback';
  lastPeriod: string | null;
  /**
   * The full past+future cycle series, for calendar rendering across
   * any month — not just whatever is "next" from today.
   */
  cycles: CycleWindow[];
  /** Convenience getters derived from `cycles`, for callers (metric
   * cards, reminders) that only care about the nearest upcoming cycle. */
  nextPeriod: Date | null;
  ovulationDay: Date | null;
  fertileWindow: { start: Date; end: Date } | null;
  daysUntilNextPeriod: number | null;
  daysUntilOvulation: number | null;
  currentPhase: PhaseInfo | null;
  /**
   * The period currently in progress, if any — set while the user has
   * logged a start but not yet marked an end. Drives the "Day N of your
   * period" banner and the prompt to confirm the end once bleeding runs
   * past the user's typical duration.
   */
  ongoingPeriod: OngoingPeriod | null;
};

export type OngoingPeriod = {
  id: string;
  startDate: string;
  /** 1-based day of bleeding, so the first day reads as "Day 1". */
  dayOfPeriod: number;
  /** True once this has run longer than the user's configured typical
   * duration — the moment it is worth asking whether it has stopped. */
  exceedsTypical: boolean;
};

export function useCycleCalc(
  periodList: Period[],
  dailyLogList: DailyLog[],
  currentSettings: Settings | null,
  todayISO: string,
): CycleInfo {
  return useMemo(() => {
    const fallback = currentSettings?.fallbackCycleDays ?? DEFAULT_CYCLE_DAYS;
    const periodDuration = currentSettings?.periodDurationDays ?? DEFAULT_PERIOD_DURATION_DAYS;

    const sortedPeriods = [...periodList].sort((a, b) => a.startDate.localeCompare(b.startDate));
    const sortedDates = sortedPeriods.map((p) => p.startDate);

    const cycleLength = computeCycleLength(sortedDates, fallback);
    const cycleSource: 'calculated' | 'fallback' =
      sortedDates.length >= 2 ? 'calculated' : 'fallback';

    const lastPeriod = sortedPeriods.length > 0
      ? sortedPeriods[sortedPeriods.length - 1].startDate
      : null;

    if (!lastPeriod) {
      return {
        cycleLength,
        cycleSource,
        lastPeriod: null,
        cycles: [],
        nextPeriod: null,
        ovulationDay: null,
        fertileWindow: null,
        daysUntilNextPeriod: null,
        daysUntilOvulation: null,
        currentPhase: null,
        ongoingPeriod: null,
      };
    }

    const flowLoggedDates = new Set(
      dailyLogList.filter((l) => l.flow).map((l) => l.date),
    );

    const cycles = buildCycleWindows(sortedPeriods, flowLoggedDates, cycleLength, periodDuration);

    // The nearest predicted cycle is the "next period" convenience
    // value everything else (CycleSummary, reminders) reads — cycles
    // is chronological, so the first isPrediction entry is it.
    const nextCycle = cycles.find((c) => c.isPrediction) ?? null;
    const nextPeriod = nextCycle ? parseISODate(nextCycle.start) : null;
    const ovulationDay = nextCycle ? parseISODate(nextCycle.ovulation) : null;
    const fertileWindow = nextCycle
      ? { start: parseISODate(nextCycle.fertileStart), end: parseISODate(nextCycle.fertileEnd) }
      : null;

    const today = parseISODate(todayISO);
    const daysUntilNextPeriod = nextPeriod ? daysBetween(today, nextPeriod) : null;
    const daysUntilOvulation = ovulationDay ? daysBetween(today, ovulationDay) : null;
    const currentPhase = computePhase(lastPeriod, cycleLength, periodDuration, today);

    // Only the most recent period can be in progress; anything earlier is
    // settled whether or not its end was ever confirmed.
    const latest = sortedPeriods[sortedPeriods.length - 1];
    const dayOfPeriod = daysBetween(parseISODate(latest.startDate), today) + 1;
    const ongoingPeriod: OngoingPeriod | null = isPeriodOngoing(latest, todayISO)
      ? {
          id: latest.id,
          startDate: latest.startDate,
          dayOfPeriod,
          exceedsTypical: dayOfPeriod > periodDuration,
        }
      : null;

    return {
      cycleLength,
      cycleSource,
      lastPeriod,
      cycles,
      nextPeriod,
      ovulationDay,
      fertileWindow,
      daysUntilNextPeriod,
      daysUntilOvulation,
      currentPhase,
      ongoingPeriod,
    };
  }, [periodList, dailyLogList, currentSettings, todayISO]);
}

/**
 * Hook for derived cycle calculations.
 * All computation is memoized and depends on periods + settings.
 * Returns everything the UI needs for calendar coloring and metric display.
 */

import { useMemo } from 'react';

import type { Period, Settings } from '@/db/schema';
import {
  computeCycleLength,
  computeFertileWindow,
  computeNextPeriod,
  computeOvulationDay,
} from '@/utils/cycle';
import { computePhase } from '@/utils/phase';
import type { PhaseInfo } from '@/utils/phase';
import { daysBetween } from '@/utils/date';

export type CycleInfo = {
  cycleLength: number;
  cycleSource: 'calculated' | 'fallback';
  lastPeriod: string | null;
  nextPeriod: Date | null;
  ovulationDay: Date | null;
  fertileWindow: { start: Date; end: Date } | null;
  daysUntilNextPeriod: number | null;
  daysUntilOvulation: number | null;
  currentPhase: PhaseInfo | null;
};

export function useCycleCalc(
  periodList: Period[],
  currentSettings: Settings | null,
): CycleInfo {
  return useMemo(() => {
    const fallback = currentSettings?.fallbackCycleDays ?? 28;
    const sortedDates = periodList
      .map((p) => p.startDate)
      .sort();

    const cycleLength = computeCycleLength(sortedDates, fallback);
    const cycleSource: 'calculated' | 'fallback' =
      sortedDates.length >= 2 ? 'calculated' : 'fallback';

    const lastPeriod = sortedDates.length > 0
      ? sortedDates[sortedDates.length - 1]
      : null;

    const periodDuration = currentSettings?.periodDurationDays ?? 5;

    if (!lastPeriod) {
      return {
        cycleLength,
        cycleSource,
        lastPeriod: null,
        nextPeriod: null,
        ovulationDay: null,
        fertileWindow: null,
        daysUntilNextPeriod: null,
        daysUntilOvulation: null,
        currentPhase: null,
      };
    }

    const nextPeriod = computeNextPeriod(lastPeriod, cycleLength);
    const ovulationDay = computeOvulationDay(lastPeriod, cycleLength);
    const fertileWindow = computeFertileWindow(ovulationDay);
    const today = new Date();
    const daysUntilNextPeriod = daysBetween(today, nextPeriod);
    const daysUntilOvulation = daysBetween(today, ovulationDay);
    const currentPhase = computePhase(lastPeriod, cycleLength, periodDuration);

    return {
      cycleLength,
      cycleSource,
      lastPeriod,
      nextPeriod,
      ovulationDay,
      fertileWindow,
      daysUntilNextPeriod,
      daysUntilOvulation,
      currentPhase,
    };
  }, [periodList, currentSettings]);
}

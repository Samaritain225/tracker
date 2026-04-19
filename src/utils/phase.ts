/**
 * Hormonal phase computation.
 * Determines the current phase of the menstrual cycle based on
 * last period date, cycle length, and period duration.
 *
 * Phases:
 *   Menstrual  — Day 1 → period duration
 *   Follicular — End of period → ovulation - 2
 *   Ovulatory  — Ovulation ± 1 day
 *   Luteal     — Post-ovulatory → next period
 */

import { OVULATION_OFFSET_FROM_END } from '@/constants/cycle';
import { daysBetween, parseISODate } from './date';

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';

export type PhaseInfo = {
  phase: CyclePhase;
  dayInPhase: number;
  totalPhaseDays: number;
  dayInCycle: number;
  emoji: string;
};

const PHASE_EMOJI: Record<CyclePhase, string> = {
  menstrual: '🩸',
  follicular: '🌱',
  ovulatory: '🌸',
  luteal: '🌙',
};

/**
 * Computes the current hormonal phase from cycle data.
 * Returns null if no last period is available.
 */
export function computePhase(
  lastPeriodDate: string,
  cycleLength: number,
  periodDurationDays: number,
): PhaseInfo | null {
  const lastPeriod = parseISODate(lastPeriodDate);
  const today = new Date();
  const dayInCycle = daysBetween(lastPeriod, today) + 1; // 1-based

  // If we've passed the cycle length, the user hasn't logged a new period yet.
  // Wrap around to show where they'd be in a new cycle.
  const effectiveDay = ((dayInCycle - 1) % cycleLength) + 1;

  const ovulationDay = cycleLength - OVULATION_OFFSET_FROM_END;

  // Phase boundaries (all 1-based day numbers)
  const menstrualEnd = periodDurationDays;
  const ovulationStart = ovulationDay - 1;
  const ovulationEnd = ovulationDay + 1;

  let phase: CyclePhase;
  let dayInPhase: number;
  let totalPhaseDays: number;

  if (effectiveDay <= menstrualEnd) {
    phase = 'menstrual';
    dayInPhase = effectiveDay;
    totalPhaseDays = menstrualEnd;
  } else if (effectiveDay < ovulationStart) {
    phase = 'follicular';
    dayInPhase = effectiveDay - menstrualEnd;
    totalPhaseDays = ovulationStart - menstrualEnd - 1;
  } else if (effectiveDay <= ovulationEnd) {
    phase = 'ovulatory';
    dayInPhase = effectiveDay - ovulationStart + 1;
    totalPhaseDays = ovulationEnd - ovulationStart + 1;
  } else {
    phase = 'luteal';
    dayInPhase = effectiveDay - ovulationEnd;
    totalPhaseDays = cycleLength - ovulationEnd;
  }

  return {
    phase,
    dayInPhase,
    totalPhaseDays,
    dayInCycle: effectiveDay,
    emoji: PHASE_EMOJI[phase],
  };
}

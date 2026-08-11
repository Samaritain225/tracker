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
 *
 * When today is past the expected cycle length with no new period
 * logged, the phase holds at luteal instead of wrapping into a phantom
 * new cycle — see `isLate` / `daysLate` below.
 */

import { OVULATION_OFFSET_FROM_END } from '@/constants/cycle';
import { daysBetween, parseISODate } from './date';

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';

export type PhaseInfo = {
  phase: CyclePhase;
  dayInPhase: number;
  totalPhaseDays: number;
  /** True cycle day, not wrapped — can exceed cycleLength when late. */
  dayInCycle: number;
  emoji: string;
  /** True once dayInCycle has passed cycleLength with no new period logged. */
  isLate: boolean;
  /** 0 when not late, otherwise dayInCycle - cycleLength. */
  daysLate: number;
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
 *
 * `today` defaults to `new Date()` but callers that need "today" to stay
 * fresh across midnight / app backgrounding (see useToday) should pass
 * it explicitly rather than relying on the default.
 */
export function computePhase(
  lastPeriodDate: string,
  cycleLength: number,
  periodDurationDays: number,
  today: Date = new Date(),
): PhaseInfo | null {
  const lastPeriod = parseISODate(lastPeriodDate);
  const dayInCycle = daysBetween(lastPeriod, today) + 1; // 1-based, may exceed cycleLength

  const ovulationDay = cycleLength - OVULATION_OFFSET_FROM_END;

  // Phase boundaries (all 1-based day numbers)
  const menstrualEnd = periodDurationDays;
  const ovulationStart = ovulationDay - 1;
  const ovulationEnd = ovulationDay + 1;

  const isLate = dayInCycle > cycleLength;
  const daysLate = isLate ? dayInCycle - cycleLength : 0;

  let phase: CyclePhase;
  let dayInPhase: number;
  let totalPhaseDays: number;

  if (isLate) {
    // Past the expected cycle length with no new period logged yet.
    // The most useful thing to communicate here is "how late", not a
    // fabricated new cycle — hold at luteal, the phase that precedes
    // the next period.
    phase = 'luteal';
    dayInPhase = dayInCycle - ovulationEnd;
    totalPhaseDays = cycleLength - ovulationEnd;
  } else if (dayInCycle <= menstrualEnd) {
    phase = 'menstrual';
    dayInPhase = dayInCycle;
    totalPhaseDays = menstrualEnd;
  } else if (dayInCycle < ovulationStart) {
    phase = 'follicular';
    dayInPhase = dayInCycle - menstrualEnd;
    totalPhaseDays = ovulationStart - menstrualEnd - 1;
  } else if (dayInCycle <= ovulationEnd) {
    phase = 'ovulatory';
    dayInPhase = dayInCycle - ovulationStart + 1;
    totalPhaseDays = ovulationEnd - ovulationStart + 1;
  } else {
    phase = 'luteal';
    dayInPhase = dayInCycle - ovulationEnd;
    totalPhaseDays = cycleLength - ovulationEnd;
  }

  return {
    phase,
    dayInPhase,
    totalPhaseDays,
    dayInCycle,
    emoji: PHASE_EMOJI[phase],
    isLate,
    daysLate,
  };
}

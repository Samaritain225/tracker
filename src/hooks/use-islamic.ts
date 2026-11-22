/**
 * The Islamic option's state for a given day: the rules in force (null
 * when the option is off) and what the reference card may say.
 */

import { useMemo } from 'react';

import { DEFAULT_PERIOD_DURATION_DAYS } from '@/constants/cycle';
import type { DailyLog, Period, Pregnancy, Settings } from '@/db/schema';
import { rulesFor } from '@/utils/fiqh';
import type { SchoolRules } from '@/utils/fiqh';
import { islamicStatus } from '@/utils/fiqh/bleeding';
import type { IslamicStatus } from '@/utils/fiqh/bleeding';
import type { AppMode } from '@/utils/pregnancy';

export function useIslamicStatus(input: {
  settings: Settings | null;
  periods: Period[];
  logs: DailyLog[];
  pregnancies: Pregnancy[];
  mode: AppMode<Pregnancy>['kind'];
  recoveryOutcome?: 'birth' | 'loss';
  dateISO: string;
}): { rules: SchoolRules | null; status: IslamicStatus } {
  const { settings, periods, logs, pregnancies, mode, recoveryOutcome, dateISO } = input;
  return useMemo(() => {
    const rules = rulesFor(settings?.school);
    const status = islamicStatus({
      rules,
      mode,
      recoveryOutcome,
      periods,
      flowDates: new Set(logs.filter((l) => l.flow).map((l) => l.date)),
      defaultDurationDays: settings?.periodDurationDays ?? DEFAULT_PERIOD_DURATION_DAYS,
      pregnancies,
      todayISO: dateISO,
    });
    return { rules, status };
  }, [settings, periods, logs, pregnancies, mode, recoveryOutcome, dateISO]);
}

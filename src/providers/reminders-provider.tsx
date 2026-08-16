/**
 * RemindersProvider — schedules/cancels local notifications based on
 * settings and cycle predictions.
 *
 * Mounted at the app root rather than inside the Home screen: reminders
 * used to only get (re)scheduled when the Home tab was visited, so
 * toggling them on in Settings and never opening Home meant nothing
 * was ever scheduled. This has no UI of its own — it's a pure
 * side-effect component sitting above the tab navigator.
 */

import React from 'react';

import { useCycleCalc } from '@/hooks/use-cycle-calc';
import { useDailyLogs } from '@/hooks/use-daily-logs';
import { usePeriods } from '@/hooks/use-periods';
import { useReminders } from '@/hooks/use-reminders';
import { useSettings } from '@/hooks/use-settings';
import { useToday } from '@/hooks/use-today';

type Props = {
  children: React.ReactNode;
};

export function RemindersProvider({ children }: Props) {
  const { periods } = usePeriods();
  const { logs } = useDailyLogs();
  const { settings } = useSettings();
  const todayISO = useToday();
  const cycleInfo = useCycleCalc(periods, logs, settings, todayISO);

  useReminders({
    remindersEnabled: !!settings?.remindersEnabled,
    cycleInfo,
  });

  return <>{children}</>;
}

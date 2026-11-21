/**
 * Hook for managing smart reminders.
 * Watches settings and cycle predictions, auto-schedules/cancels notifications.
 */

import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { CycleInfo } from '@/hooks/use-cycle-calc';
import {
  cancelAllReminders,
  scheduleDailyLogReminder,
  schedulePeriodReminders,
} from '@/services/notifications';
import { computePeriodReminderDates } from '@/utils/reminders';

type Props = {
  remindersEnabled: boolean;
  cycleInfo: CycleInfo;
};

export function useReminders({ remindersEnabled, cycleInfo }: Props): void {
  const { t } = useTranslation();

  // A string key rather than the cycles array itself: the array is a new
  // object on every recalculation, and rescheduling on identity alone
  // would cancel and recreate every reminder on each render.
  const predictedStartsKey = useMemo(
    () =>
      cycleInfo.cycles
        .filter((c) => c.isPrediction)
        .map((c) => c.start)
        .join(','),
    [cycleInfo.cycles],
  );

  useEffect(() => {
    if (!remindersEnabled) {
      cancelAllReminders();
      return;
    }

    const predictedStarts = predictedStartsKey ? predictedStartsKey.split(',') : [];
    schedulePeriodReminders(
      computePeriodReminderDates(predictedStarts, new Date()),
      t('notifications.period_title'),
      t('notifications.period_body'),
    );

    scheduleDailyLogReminder(
      t('notifications.log_title'),
      t('notifications.log_body'),
    );
  }, [remindersEnabled, predictedStartsKey, t]);
}

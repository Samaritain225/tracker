/**
 * Hook for managing smart reminders.
 * Watches settings and cycle predictions, auto-schedules/cancels notifications.
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import type { CycleInfo } from '@/hooks/use-cycle-calc';
import {
  cancelAllReminders,
  scheduleDailyLogReminder,
  schedulePeriodReminder,
} from '@/services/notifications';

type Props = {
  remindersEnabled: boolean;
  cycleInfo: CycleInfo;
};

export function useReminders({ remindersEnabled, cycleInfo }: Props): void {
  const { t } = useTranslation();

  useEffect(() => {
    if (!remindersEnabled) {
      cancelAllReminders();
      return;
    }

    // Schedule period reminder if we have a prediction
    if (cycleInfo.nextPeriod) {
      schedulePeriodReminder(
        cycleInfo.nextPeriod,
        t('notifications.period_title'),
        t('notifications.period_body'),
      );
    }

    // Schedule daily log reminder
    scheduleDailyLogReminder(
      t('notifications.log_title'),
      t('notifications.log_body'),
    );
  }, [remindersEnabled, cycleInfo.nextPeriod, t]);
}

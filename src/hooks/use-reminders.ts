/**
 * Hook for managing smart reminders.
 * Watches settings and cycle predictions, auto-schedules/cancels notifications.
 */

import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { CycleInfo } from '@/hooks/use-cycle-calc';
import type { PregnancyVisit } from '@/db/schema';
import {
  cancelAllReminders,
  scheduleDailyLogReminder,
  schedulePeriodReminders,
  scheduleVisitReminders,
} from '@/services/notifications';
import { computePeriodReminderDates, computeVisitReminderDates } from '@/utils/reminders';

type Props = {
  remindersEnabled: boolean;
  cycleInfo: CycleInfo;
  /** Visits of the pregnancy in progress; empty outside one. */
  visits: PregnancyVisit[];
};

export function useReminders({ remindersEnabled, cycleInfo, visits }: Props): void {
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
  const visitsKey = useMemo(
    () => visits.map((v) => `${v.date}|${v.kind}`).sort().join(','),
    [visits],
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

    const visitList = visitsKey ? visitsKey.split(',').map((entry) => entry.split('|')) : [];
    const kindByDate = new Map(visitList.map(([date, kind]) => [date, kind]));
    scheduleVisitReminders(
      computeVisitReminderDates([...kindByDate.keys()], new Date()).map(({ visitDate, remindAt }) => ({
        remindAt,
        title: t('notifications.visit_title'),
        body: t('notifications.visit_body', { kind: t(`journey.visit_${kindByDate.get(visitDate)}`) }),
      })),
    );

    scheduleDailyLogReminder(
      t('notifications.log_title'),
      t('notifications.log_body'),
    );
  }, [remindersEnabled, predictedStartsKey, visitsKey, t]);
}

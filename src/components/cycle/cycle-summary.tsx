/**
 * CycleSummary — row of metric cards showing key cycle stats.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Spacing } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import type { CycleInfo } from '@/hooks/use-cycle-calc';
import { MetricCard } from '@/components/ui/metric-card';

type Props = {
  cycleInfo: CycleInfo;
};

export function CycleSummary({ cycleInfo }: Props) {
  const { t } = useTranslation();

  const nextPeriodValue = formatDaysLabel(cycleInfo.daysUntilNextPeriod, t);
  const ovulationValue = formatDaysLabel(cycleInfo.daysUntilOvulation, t);
  const cycleLengthSub = cycleInfo.cycleSource === 'calculated'
    ? t('home.calculated')
    : t('home.estimated');

  return (
    <View style={styles.row}>
      <MetricCard
        label={t('home.next_period')}
        value={nextPeriodValue}
        accent
      />
      <MetricCard
        label={t('home.ovulation')}
        value={ovulationValue}
      />
      <MetricCard
        label={t('home.cycle_length')}
        value={`${cycleInfo.cycleLength}`}
        sub={cycleLengthSub}
      />
    </View>
  );
}

function formatDaysLabel(
  days: number | null,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (days === null) return '—';
  if (days === 0) return t('home.today');
  if (days > 0) return t('home.in_days', { count: days });
  return t('home.days_ago', { count: Math.abs(days) });
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
});

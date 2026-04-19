/**
 * Insights Dashboard.
 * Calculates and displays cycle averages, variances, and common symptoms.
 */

import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/providers/theme-provider';
import { Card } from '@/components/ui/card';
import { MetricCard } from '@/components/ui/metric-card';
import { SymptomHeatmap } from '@/components/insights/symptom-heatmap';
import { usePeriods } from '@/hooks/use-periods';
import { useDailyLogs } from '@/hooks/use-daily-logs';
import { useSettings } from '@/hooks/use-settings';
import { computeCycleLength } from '@/utils/cycle';
import { daysBetween, parseISODate } from '@/utils/date';

export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { periods } = usePeriods();
  const { logs } = useDailyLogs();
  const { settings } = useSettings();
  const { colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  const fallbackCycle = settings?.fallbackCycleDays ?? 28;

  const sortedDates = useMemo(
    () => periods.map((p) => p.startDate).sort(),
    [periods],
  );
  const computedCycleLength = useMemo(() => {
    return computeCycleLength(sortedDates, fallbackCycle);
  }, [sortedDates, fallbackCycle]);

  // 1. Average Cycle Length & Variance
  const { avgCycle, variance } = useMemo(() => {
    if (sortedDates.length < 2) return { avgCycle: null, variance: null };

    const lengths: number[] = [];
    for (let i = 1; i < sortedDates.length; i++) {
       const gap = daysBetween(parseISODate(sortedDates[i - 1]), parseISODate(sortedDates[i]));
       lengths.push(gap);
    }
    
    // Use last 6 cycles at most for relevance
    const recent = lengths.slice(-6);
    const avg = Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
    
    // Simple variance (average absolute deviation)
    const deviation = recent.reduce((sum, val) => sum + Math.abs(val - avg), 0) / recent.length;
    const roundedVariance = Math.round(deviation);

    return { avgCycle: avg, variance: roundedVariance };
  }, [sortedDates]);

  // 2. Average Period Length (using flow data)
  const avgPeriodLength = useMemo(() => {
    const flowLogs = logs.filter((l) => l.flow !== null).sort((a, b) => a.date.localeCompare(b.date));
    if (flowLogs.length === 0) return null;

    let periodCount = 0;
    let totalDays = 0;
    let currentPeriodDays = 0;
    let lastDate: Date | null = null;

    for (const log of flowLogs) {
      const d = parseISODate(log.date);
      if (!lastDate) {
        currentPeriodDays = 1;
        periodCount = 1;
      } else {
        const gap = daysBetween(lastDate, d);
        if (gap === 1) {
           currentPeriodDays++;
        } else {
           // New period block
           totalDays += currentPeriodDays;
           currentPeriodDays = 1;
           periodCount++;
        }
      }
      lastDate = d;
    }
    totalDays += currentPeriodDays;

    return periodCount > 0 ? Math.round(totalDays / periodCount) : null;
  }, [logs]);

  // 3. Most Common Symptoms
  const topSymptoms = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const log of logs) {
      for (const sym of log.symptoms || []) {
        counts[sym] = (counts[sym] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([sym]) => sym);
  }, [logs]);

  return (
    <View style={styles.container}>
      <View style={{ height: insets.top, backgroundColor: colors.background }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Spacing.lg, paddingBottom: insets.bottom + Spacing.xxl },
        ]}
      >
      <Animated.View entering={FadeInDown.duration(600).delay(100).springify()}>
        <Text style={styles.screenTitle}>{t('insights.title')}</Text>
      </Animated.View>

      {sortedDates.length < 2 && logs.length === 0 ? (
        <Animated.View entering={FadeInDown.duration(600).delay(200).springify()}>
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t('insights.no_data')}</Text>
          </Card>
        </Animated.View>
      ) : (
        <>
          <Animated.View entering={FadeInDown.duration(600).delay(200).springify()}>
            <View style={styles.row}>
              <MetricCard
                label={t('insights.avg_cycle')}
                value={avgCycle ? t('insights.days', { count: avgCycle }) : '—'}
                accent
              />
              <MetricCard
                label={t('insights.variance')}
                value={variance !== null ? t('insights.days_variance', { count: variance }) : '—'}
              />
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(600).delay(300).springify()}>
            <Card style={styles.card}>
              <Text style={styles.sectionLabel}>{t('insights.avg_period')}</Text>
              <Text style={styles.statValue}>
                {avgPeriodLength ? t('insights.days', { count: avgPeriodLength }) : '—'}
              </Text>
            </Card>
          </Animated.View>

          {topSymptoms.length > 0 && (
            <Animated.View entering={FadeInDown.duration(600).delay(400).springify()}>
              <Card style={styles.card}>
                <Text style={styles.sectionLabel}>{t('insights.most_common_symptoms')}</Text>
                <View style={styles.chipGroup}>
                  {topSymptoms.map((sym) => (
                    <View key={sym} style={styles.chip}>
                      <Text style={styles.chipText}>{t(`day_details.symptom_${sym}`)}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            </Animated.View>
          )}

          {/* Symptom Heatmap */}
          <Animated.View entering={FadeInDown.duration(600).delay(500).springify()}>
            <SymptomHeatmap
              periods={periods}
              logs={logs}
              cycleLength={computedCycleLength}
            />
          </Animated.View>
        </>
      )}
    </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
  },
  screenTitle: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.bold,
    color: colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  card: {
    gap: Spacing.xs,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyText: {
    fontSize: Typography.sizes.md,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  sectionLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 100, // Radii.full
    backgroundColor: colors.surfaceAlt,
  },
  chipText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: colors.textPrimary,
  },
});

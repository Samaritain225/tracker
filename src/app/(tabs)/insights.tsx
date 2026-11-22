/**
 * Insights Dashboard.
 * Calculates and displays cycle averages, variances, and common symptoms.
 */

import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/providers/theme-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PatternsCard } from '@/components/insights/patterns-card';
import { HowLink } from '@/components/ui/how-link';
import { useCustomSymptoms } from '@/hooks/use-custom-symptoms';
import { findPatterns } from '@/utils/patterns';
import { mostLoggedSymptoms } from '@/utils/symptoms';
import { MetricCard } from '@/components/ui/metric-card';
import { SymptomHeatmap } from '@/components/insights/symptom-heatmap';
import { usePeriods } from '@/hooks/use-periods';
import { useDailyLogs } from '@/hooks/use-daily-logs';
import { useSettings } from '@/hooks/use-settings';
import { usePregnancies } from '@/hooks/use-pregnancies';
import { pregnancySpans, resolveMode } from '@/utils/pregnancy';
import { PregnancyInsights } from '@/components/pregnancy/pregnancy-insights';
import { usePregnancyVisits } from '@/hooks/use-pregnancy-visits';
import { useToday } from '@/hooks/use-today';
import { DEFAULT_PERIOD_DURATION_DAYS } from '@/constants/cycle';
import {
  computeAveragePeriodLength,
  computeCycleLength,
  computeCycleVariance,
  hasPlausibleCycleData,
} from '@/utils/cycle';

export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { periods } = usePeriods();
  const { logs } = useDailyLogs();
  const { visits } = usePregnancyVisits();
  const { settings } = useSettings();
  const { pregnancies: pregnancyList } = usePregnancies();
  const { colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const todayISO = useToday();
  const { labelOf } = useCustomSymptoms();
  const router = useRouter();

  const fallbackCycle = settings?.fallbackCycleDays ?? 28;
  // Gaps that contain a pregnancy aren't cycles, so they are left out of
  // every average here exactly as on Home.
  const spans = useMemo(() => pregnancySpans(pregnancyList), [pregnancyList]);

  const sortedDates = useMemo(
    () => periods.map((p) => p.startDate).sort(),
    [periods],
  );
  const computedCycleLength = useMemo(() => {
    return computeCycleLength(sortedDates, fallbackCycle, spans);
  }, [sortedDates, fallbackCycle, spans]);

  // 1. Average Cycle Length & Variance
  // Delegates to the same computeCycleLength/computeCycleVariance the
  // Home screen's prediction uses (via useCycleCalc), so this card and
  // the Home metrics can never disagree.
  // Show a dash rather than the settings default dressed up as a
  // measurement — the same reasoning computeAveragePeriodLength applies
  // when it refuses to average a defaulted period length.
  const avgCycle = hasPlausibleCycleData(sortedDates, spans) ? computedCycleLength : null;
  const variance = useMemo(() => computeCycleVariance(sortedDates, spans), [sortedDates, spans]);

  // 2. Average Period Length.
  // Delegates to computeAveragePeriodLength so this uses the same
  // resolution ladder as the calendar — an end date the user confirmed
  // moves this number, which a scan over raw flow logs would ignore.
  const flowLoggedDates = useMemo(
    () => new Set(logs.filter((l) => l.flow).map((l) => l.date)),
    [logs],
  );
  const avgPeriodLength = useMemo(
    () =>
      computeAveragePeriodLength(
        periods,
        flowLoggedDates,
        settings?.periodDurationDays ?? DEFAULT_PERIOD_DURATION_DAYS,
        todayISO,
      ),
    [periods, flowLoggedDates, settings?.periodDurationDays, todayISO],
  );

  // 3. Most Common Symptoms
  const topSymptoms = useMemo(() => mostLoggedSymptoms(logs, 3).map((s) => s.key), [logs]);

  const mode = resolveMode(pregnancyList, sortedDates);

  const patterns = useMemo(
    () =>
      findPatterns({
        periods,
        logs,
        flowDates: flowLoggedDates,
        defaultDurationDays: settings?.periodDurationDays ?? DEFAULT_PERIOD_DURATION_DAYS,
        spans,
      }),
    [periods, logs, flowLoggedDates, settings?.periodDurationDays, spans],
  );

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

      {mode.kind === 'pregnant' ? (
        <Animated.View entering={FadeInDown.duration(600).delay(200).springify()}>
          <PregnancyInsights
            pregnancy={mode.pregnancy}
            visits={visits}
            logs={logs}
            todayISO={todayISO}
            language={(settings?.language as 'en' | 'fr') ?? 'fr'}
            calendarType={(settings?.calendarType as 'gregorian' | 'hijri') ?? 'gregorian'}
          />
        </Animated.View>
      ) : sortedDates.length < 2 && logs.length === 0 ? (
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

          <HowLink section="cycle" />

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
                      <Text style={styles.chipText}>{labelOf(sym)}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.duration(600).delay(450).springify()}>
            <PatternsCard result={patterns} labelOf={labelOf} />
          </Animated.View>

          {/* Symptom Heatmap */}
          <Animated.View entering={FadeInDown.duration(600).delay(500).springify()}>
            <SymptomHeatmap
              periods={periods}
              logs={logs}
              cycleLength={computedCycleLength}
            />
          </Animated.View>
          <Animated.View entering={FadeInDown.duration(600).delay(600).springify()}>
            <Button
              label={t('summary.title')}
              icon="medkit-outline"
              onPress={() => router.push('/summary')}
              variant="secondary"
              fullWidth
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

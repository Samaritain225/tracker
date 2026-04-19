/**
 * Home screen — calendar, metrics, legend, and period logging form.
 */

import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useRouter } from 'expo-router';

import { Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/providers/theme-provider';
import { CalendarGrid } from '@/components/calendar/calendar-grid';
import { CalendarLegend } from '@/components/calendar/calendar-legend';
import { CycleSummary } from '@/components/cycle/cycle-summary';
import { PhaseBanner } from '@/components/cycle/phase-banner';
import { useCycleCalc } from '@/hooks/use-cycle-calc';
import { useDailyLogs } from '@/hooks/use-daily-logs';
import { usePeriods } from '@/hooks/use-periods';
import { useSettings } from '@/hooks/use-settings';
import { useReminders } from '@/hooks/use-reminders';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { periods, error } = usePeriods();
  const { settings } = useSettings();
  const { logs } = useDailyLogs();
  const { colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const cycleInfo = useCycleCalc(periods, settings);

  // Schedule/cancel notifications reactively
  useReminders({
    remindersEnabled: !!settings?.remindersEnabled,
    cycleInfo,
  });

  const now = new Date();
  const periodDates = periods.map((p) => p.startDate);
  const calendarType = settings?.calendarType as 'gregorian' | 'hijri' ?? 'gregorian';
  const language = settings?.language as 'en' | 'fr' ?? 'fr';
  const periodDuration = settings?.periodDurationDays ?? 5;

  const handleDayPress = useCallback(
    (isoDate: string) => {
      router.push(`/day/${isoDate}`);
    },
    [router],
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
        <View style={styles.header}>
          <Text style={styles.title}>{t('app.name')}</Text>
          <Text style={styles.subtitle}>{t('app.tagline')}</Text>
        </View>
      </Animated.View>

      {/* Phase banner */}
      {cycleInfo.currentPhase && (
        <Animated.View entering={FadeInDown.duration(600).delay(200).springify()}>
          <PhaseBanner phaseInfo={cycleInfo.currentPhase} />
        </Animated.View>
      )}

      {/* Metric cards */}
      <Animated.View entering={FadeInDown.duration(600).delay(300).springify()}>
        <CycleSummary cycleInfo={cycleInfo} />
      </Animated.View>

      {/* Calendar */}
      <Animated.View entering={FadeInDown.duration(600).delay(400).springify()}>
        <CalendarGrid
          year={now.getFullYear()}
          month={now.getMonth()}
          periods={periodDates}
          cycleInfo={cycleInfo}
          dailyLogs={logs}
          periodDurationDays={periodDuration}
          calendarType={calendarType}
          language={language}
          onDayPress={handleDayPress}
        />
      </Animated.View>

      {/* Legend */}
      <Animated.View entering={FadeInDown.duration(600).delay(500).springify()}>
        <CalendarLegend />
      </Animated.View>
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
    gap: Spacing.xl,
  },
  header: {
    marginBottom: -Spacing.sm, // pull slightly closer to the first card
  },
  title: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: Typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: Spacing.xs,
  },
});

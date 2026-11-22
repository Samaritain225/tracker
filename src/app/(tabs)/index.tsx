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
import { PregnancyOverview } from '@/components/pregnancy/pregnancy-overview';
import { RecoveryOverview } from '@/components/pregnancy/recovery-overview';
import { LATE_TEST_SUGGESTION_DAYS } from '@/constants/cycle';
import { useCycleCalc } from '@/hooks/use-cycle-calc';
import { useDailyLogs } from '@/hooks/use-daily-logs';
import { usePeriods } from '@/hooks/use-periods';
import { usePregnancies } from '@/hooks/use-pregnancies';
import { usePregnancyVisits } from '@/hooks/use-pregnancy-visits';
import { useIslamicStatus } from '@/hooks/use-islamic';
import { useRamadanFasts } from '@/hooks/use-ramadan-fasts';
import { IslamicCard } from '@/components/islamic/islamic-card';
import { Card } from '@/components/ui/card';
import { DEFAULT_PERIOD_DURATION_DAYS } from '@/constants/cycle';
import { useSettings } from '@/hooks/use-settings';
import { useToday } from '@/hooks/use-today';
import { addDays, parseISODate, toISODate } from '@/utils/date';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { periods, error, setPeriodEnd } = usePeriods();
  const { settings, dismissPregnancyPrompt } = useSettings();
  const { logs } = useDailyLogs();
  const { pregnancies, setBreastfeeding } = usePregnancies();
  const { visits } = usePregnancyVisits();
  const { colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const todayISO = useToday();
  // Reminder scheduling itself lives in RemindersProvider (mounted at
  // the app root) so it stays in sync without requiring a visit to this
  // screen — see providers/reminders-provider.tsx.
  const cycleInfo = useCycleCalc(periods, logs, settings, todayISO, pregnancies);
  const mode = cycleInfo.mode;
  const recoveryOutcome = mode.kind === 'recovery' ? mode.outcome : undefined;
  const islamic = useIslamicStatus({
    settings,
    periods,
    logs,
    pregnancies,
    mode: mode.kind,
    recoveryOutcome,
    dateISO: todayISO,
  });
  const fasts = useRamadanFasts({
    periods,
    logs,
    pregnancies,
    defaultDurationDays: settings?.periodDurationDays ?? DEFAULT_PERIOD_DURATION_DAYS,
    todayISO,
  });
  // Nothing religious after a loss, not even the fasts summary; the
  // fasts screen stays reachable from Settings.
  const showFastsCard =
    islamic.rules !== null && fasts.outstanding > 0 && recoveryOutcome !== 'loss';

  const now = parseISODate(todayISO);
  const calendarType = settings?.calendarType as 'gregorian' | 'hijri' ?? 'gregorian';
  const language = settings?.language as 'en' | 'fr' ?? 'fr';

  const handleDayPress = useCallback(
    (isoDate: string) => {
      router.push(`/day/${isoDate}`);
    },
    [router],
  );

  // Confirming from the banner records yesterday as the last day of
  // bleeding: the prompt only appears once the period has already run
  // past its typical length, so "it has stopped" means it stopped before
  // today rather than today.
  // Asked once the period is a week late — the same point the banner
  // starts suggesting a test — until answered for this cycle.
  const lastPeriod = cycleInfo.lastPeriod;
  const showPregnancyPrompt =
    mode.kind === 'cycle' &&
    cycleInfo.daysLate >= LATE_TEST_SUGGESTION_DAYS &&
    lastPeriod !== null &&
    settings?.pregnancyPromptDismissedFor !== lastPeriod;
  const pregnancyPrompt = showPregnancyPrompt
    ? {
        onPregnant: () => router.push('/pregnancy/setup'),
        onNotPregnant: () => dismissPregnancyPrompt(lastPeriod!),
      }
    : null;

  const ongoingPeriodId = cycleInfo.ongoingPeriod?.id ?? null;
  const handleConfirmPeriodEnded = useCallback(() => {
    if (!ongoingPeriodId) return;
    setPeriodEnd(ongoingPeriodId, toISODate(addDays(parseISODate(todayISO), -1)));
  }, [ongoingPeriodId, setPeriodEnd, todayISO]);

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

      {mode.kind === 'pregnant' ? (
        <Animated.View entering={FadeInDown.duration(600).delay(200).springify()}>
          <PregnancyOverview
            pregnancy={mode.pregnancy}
            todayISO={todayISO}
            language={language}
            calendarType={calendarType}
            showStarSign={settings?.showStarSign !== 0}
            nextVisit={
              visits.find((v) => v.pregnancyId === mode.pregnancy.id && v.date >= todayISO) ?? null
            }
            onLogToday={() => handleDayPress(todayISO)}
            onOpenVisit={(v) => router.push(`/pregnancy/visit?id=${v.id}`)}
          />
        </Animated.View>
      ) : mode.kind === 'recovery' ? (
        <Animated.View entering={FadeInDown.duration(600).delay(200).springify()}>
          <RecoveryOverview
            pregnancy={mode.pregnancy}
            outcome={mode.outcome}
            todayISO={todayISO}
            onSetBreastfeeding={(value) => setBreastfeeding(mode.pregnancy.id, value)}
            onPeriodBack={() => router.push(`/day/${todayISO}?periodReturn=1`)}
          />
          {islamic.rules ? (
            <View style={{ marginTop: Spacing.md }}>
              <IslamicCard status={islamic.status} rules={islamic.rules} />
            </View>
          ) : null}
        </Animated.View>
      ) : (
        <>
          {/* Phase banner */}
          {cycleInfo.currentPhase && (
            <Animated.View entering={FadeInDown.duration(600).delay(200).springify()}>
              <PhaseBanner
                phaseInfo={cycleInfo.currentPhase}
                ongoingPeriod={cycleInfo.ongoingPeriod}
                onConfirmPeriodEnded={handleConfirmPeriodEnded}
                pregnancyPrompt={pregnancyPrompt}
              />
            </Animated.View>
          )}

          {islamic.rules ? (
            <Animated.View entering={FadeInDown.duration(600).delay(250).springify()}>
              <IslamicCard status={islamic.status} rules={islamic.rules} />
            </Animated.View>
          ) : null}

          {/* Metric cards */}
          <Animated.View entering={FadeInDown.duration(600).delay(300).springify()}>
            <CycleSummary cycleInfo={cycleInfo} />
          </Animated.View>
        </>
      )}

      {showFastsCard ? (
        <Card onPress={() => router.push('/islamic/fasts')}>
          <Text style={styles.fastsText}>
            🌙 {t('islamic.fasts_card', { count: fasts.outstanding })} ›
          </Text>
        </Card>
      ) : null}

      {/* Calendar */}
      <Animated.View entering={FadeInDown.duration(600).delay(400).springify()}>
        <CalendarGrid
          year={now.getFullYear()}
          month={now.getMonth()}
          cycleInfo={cycleInfo}
          dailyLogs={logs}
          calendarType={calendarType}
          language={language}
          todayISO={todayISO}
          onDayPress={handleDayPress}
        />
      </Animated.View>

      {/* Legend — only cycle mode has predictions and fertile days to explain. */}
      {mode.kind === 'cycle' && (
        <Animated.View entering={FadeInDown.duration(600).delay(500).springify()}>
          <CalendarLegend />
        </Animated.View>
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
  fastsText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semibold,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: Typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: Spacing.xs,
  },
});

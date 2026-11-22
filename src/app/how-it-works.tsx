/**
 * "How Lumi works it out": the rule behind each date and number, her
 * own numbers run through it, and what it can't know. Opened from
 * Settings, or from a link next to a number with `?section=` to land on
 * the matching part.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent, ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LoadingScreen } from '@/components/ui/loading-screen';
import { DEFAULT_CYCLE_DAYS, DEFAULT_PERIOD_DURATION_DAYS } from '@/constants/cycle';
import { Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useDailyLogs } from '@/hooks/use-daily-logs';
import { usePeriods } from '@/hooks/use-periods';
import { usePregnancies } from '@/hooks/use-pregnancies';
import { useSettings } from '@/hooks/use-settings';
import { useToday } from '@/hooks/use-today';
import { useTheme } from '@/providers/theme-provider';
import { formatDisplayDate, parseISODate } from '@/utils/date';
import { explainSections } from '@/utils/explain';
import type { ExplainSection, Line, SectionId } from '@/utils/explain';

export default function HowItWorksScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { section } = useLocalSearchParams<{ section?: SectionId }>();

  const { periods, isLoading: periodsLoading } = usePeriods();
  const { logs, isLoading: logsLoading } = useDailyLogs();
  const { pregnancies, isLoading: pregnanciesLoading } = usePregnancies();
  const { settings } = useSettings();
  const todayISO = useToday();

  const language = (settings?.language as 'en' | 'fr') ?? 'fr';
  const calendarType = (settings?.calendarType as 'gregorian' | 'hijri') ?? 'gregorian';

  const sections = useMemo(
    () =>
      explainSections({
        periods,
        logs,
        pregnancies,
        fallbackCycleDays: settings?.fallbackCycleDays ?? DEFAULT_CYCLE_DAYS,
        periodDurationDays: settings?.periodDurationDays ?? DEFAULT_PERIOD_DURATION_DAYS,
        islamicOn: settings?.school != null,
        todayISO,
      }),
    [periods, logs, pregnancies, settings, todayISO],
  );

  const render = useCallback(
    (line: Line) => {
      const dates = Object.fromEntries(
        (line.dates ?? []).map((iso, i) => [
          `date${i + 1}`,
          formatDisplayDate(parseISODate(iso), language, calendarType),
        ]),
      );
      return t(line.key, { ...line.values, ...dates });
    },
    [t, language, calendarType],
  );

  // Land on the section a link asked for, once it has been laid out.
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrolled = useRef(false);
  const handleSectionLayout = useCallback(
    (id: SectionId) => (e: LayoutChangeEvent) => {
      if (id !== section || scrolled.current) return;
      scrolled.current = true;
      scrollRef.current?.scrollTo({ y: e.nativeEvent.layout.y - Spacing.md, animated: false });
    },
    [section],
  );

  if (periodsLoading || logsLoading || pregnanciesLoading) return <LoadingScreen />;

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xxl },
        ]}
      >
        <Text style={styles.title}>{t('how.title')}</Text>
        <Text style={styles.body}>{t('how.intro')}</Text>

        {sections.map((s) => (
          <View key={s.id} onLayout={handleSectionLayout(s.id)}>
            <SectionCard section={s} render={render} styles={styles} />
          </View>
        ))}

        <Button label={t('common.close')} onPress={() => router.back()} variant="ghost" fullWidth />
      </ScrollView>
    </View>
  );
}

function SectionCard({
  section,
  render,
  styles,
}: {
  section: ExplainSection;
  render: (line: Line) => string;
  styles: Styles;
}) {
  const { t } = useTranslation();
  return (
    <Card style={styles.card}>
      <Text style={styles.sectionTitle}>{t(`how.title_${section.id}`)}</Text>
      <Text style={styles.paragraph}>{render(section.rule)}</Text>
      {section.yours && (
        <View style={styles.yours}>
          <Text style={styles.label}>{t('how.label_yours')}</Text>
          <Text style={styles.paragraph}>{render(section.yours)}</Text>
        </View>
      )}
      {section.limit && <Text style={styles.limit}>{render(section.limit)}</Text>}
    </Card>
  );
}

type Styles = ReturnType<typeof makeStyles>;

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: Spacing.lg, gap: Spacing.lg },
    title: { fontSize: Typography.sizes.xxl, fontWeight: Typography.weights.bold, color: colors.textPrimary },
    body: { fontSize: Typography.sizes.md, color: colors.textSecondary, lineHeight: 22 },
    card: { gap: Spacing.sm },
    sectionTitle: {
      fontSize: Typography.sizes.lg,
      fontWeight: Typography.weights.semibold,
      color: colors.textPrimary,
    },
    paragraph: { fontSize: Typography.sizes.md, color: colors.textPrimary, lineHeight: 22 },
    yours: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 12,
      padding: Spacing.md,
      gap: Spacing.xs,
    },
    label: {
      fontSize: Typography.sizes.xs,
      fontWeight: Typography.weights.semibold,
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    limit: { fontSize: Typography.sizes.sm, color: colors.textSecondary, lineHeight: 20, fontStyle: 'italic' },
  });

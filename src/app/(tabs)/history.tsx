/**
 * History screen — list of logged periods with delete confirmation.
 */

import { useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/providers/theme-provider';
import { HistoryItem } from '@/components/cycle/history-item';
import { Icon } from '@/components/ui/icon';
import { usePeriods } from '@/hooks/use-periods';
import { useDailyLogs } from '@/hooks/use-daily-logs';
import { usePregnancies } from '@/hooks/use-pregnancies';
import { usePregnancyMoments } from '@/hooks/use-pregnancy-moments';
import { usePregnancyVisits } from '@/hooks/use-pregnancy-visits';
import { useToday } from '@/hooks/use-today';
import { JourneyView } from '@/components/pregnancy/journey-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { effectiveDueDate, resolveMode } from '@/utils/pregnancy';
import { useSettings } from '@/hooks/use-settings';
import { daysBetween, formatDisplayDate, parseISODate } from '@/utils/date';
import type { Period, Pregnancy } from '@/db/schema';

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const router = useRouter();
  const { periods, removePeriod } = usePeriods();
  const { settings } = useSettings();
  const { pregnancies, keepJourney, deleteJourney } = usePregnancies();
  const { visits } = usePregnancyVisits();
  const { moments } = usePregnancyMoments();
  const { logs } = useDailyLogs();
  const todayISO = useToday();
  const { colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  const calendarType = (settings?.calendarType as 'gregorian' | 'hijri') ?? 'gregorian';
  const language = (settings?.language as 'en' | 'fr') ?? 'fr';

  // Sort most recent first
  const sortedPeriods = useMemo(
    () => [...periods].sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [periods],
  );

  const handleDelete = useCallback(
    (id: string) => {
      Alert.alert(
        t('history.delete'),
        t('history.delete_confirm'),
        [
          { text: t('history.cancel'), style: 'cancel' },
          {
            text: t('history.delete'),
            style: 'destructive',
            onPress: () => removePeriod(id),
          },
        ],
      );
    },
    [t, removePeriod],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Period; index: number }) => {
      const formattedDate = formatDisplayDate(
        parseISODate(item.startDate),
        language,
        calendarType,
      );

      // Cycle gap: difference between this period and the next one (older)
      const nextItem = sortedPeriods[index + 1];
      let cycleGap: number | null = null;
      // A gap that contains a pregnancy isn't a cycle, so no length is
      // shown for it — "400-day cycle" next to the first period after a
      // birth would be both wrong and jarring.
      const spansPregnancy =
        nextItem !== undefined &&
        pregnancies.some(
          (p) => nextItem.startDate <= (p.endedOn ?? '9999-12-31') && item.startDate > p.lastPeriodDate,
        );
      if (nextItem && !spansPregnancy) {
        cycleGap = daysBetween(
          parseISODate(nextItem.startDate),
          parseISODate(item.startDate),
        );
      }

      const isFirst = index === sortedPeriods.length - 1;

      return (
        <HistoryItem
          id={item.id}
          formattedDate={formattedDate}
          cycleGap={cycleGap}
          isFirst={isFirst}
          onDelete={handleDelete}
        />
      );
    },
    [sortedPeriods, language, calendarType, handleDelete, pregnancies],
  );

  const mode = resolveMode(pregnancies, periods.map((p) => p.startDate).sort());

  // Finished pregnancies whose Journey still exists, newest first.
  const pastPregnancies = useMemo(
    () =>
      pregnancies
        .filter((p) => p.endedOn !== null && p.journeyChoice !== 'deleted')
        .sort((a, b) => b.endedOn!.localeCompare(a.endedOn!)),
    [pregnancies],
  );

  const handleDeleteJourney = useCallback(
    (id: string) => {
      Alert.alert(t('journey.delete_journey_title'), t('journey.delete_journey_body'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('journey.delete'), style: 'destructive', onPress: () => deleteJourney(id) },
      ]);
    },
    [t, deleteJourney],
  );

  if (mode.kind === 'pregnant') {
    return (
      <View style={styles.container}>
        <View style={{ height: insets.top, backgroundColor: colors.background }} />
        <ScrollView
          contentContainerStyle={{
            paddingTop: Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xxl,
            paddingHorizontal: Spacing.lg,
          }}
        >
          <JourneyView
            pregnancy={mode.pregnancy}
            visits={visits}
            moments={moments}
            logs={logs}
            todayISO={todayISO}
            language={language}
            calendarType={calendarType}
            showStarSign={settings?.showStarSign !== 0}
            onAddMoment={() => router.push('/pregnancy/moment')}
            onAddVisit={() => router.push('/pregnancy/visit')}
            onOpenVisit={(v) => router.push(`/pregnancy/visit?id=${v.id}`)}
            onOpenMoment={(m) => router.push(`/pregnancy/moment?id=${m.id}`)}
          />
        </ScrollView>
      </View>
    );
  }

  const pastHeader =
    pastPregnancies.length > 0 ? (
      <View style={styles.pastSection}>
        <Text style={styles.sectionLabel}>{t('journey.past_title')}</Text>
        {pastPregnancies.map((p) => (
          <PastPregnancyCard
            key={p.id}
            pregnancy={p}
            formatDate={(iso) => formatDisplayDate(parseISODate(iso), language, calendarType)}
            onOpen={() => router.push(`/pregnancy/journey/${p.id}`)}
            onKeep={() => keepJourney(p.id)}
            onDelete={() => handleDeleteJourney(p.id)}
            styles={styles}
          />
        ))}
      </View>
    ) : null;

  if (sortedPeriods.length === 0 && pastPregnancies.length === 0) {
    return (
      <View style={[styles.empty, { paddingTop: insets.top + Spacing.xxl }]}>
        <Icon name="calendar-outline" size={48} color={colors.textMuted} />
        <Text style={styles.emptyText}>{t('history.empty')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={{ height: insets.top, backgroundColor: colors.background }} />
      <FlatList
        data={sortedPeriods}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={pastHeader ?? undefined}
        style={styles.list}
        contentContainerStyle={{
          paddingTop: Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xxl,
          paddingHorizontal: Spacing.lg,
          gap: Spacing.sm,
        }}
      />
    </View>
  );
}

/**
 * A finished pregnancy in the History list. After a loss, until she has
 * answered, it asks once whether to keep the Journey — here, and only
 * here, rather than on Home where it would greet her every day.
 */
function PastPregnancyCard({
  pregnancy,
  formatDate,
  onOpen,
  onKeep,
  onDelete,
  styles,
}: {
  pregnancy: Pregnancy;
  formatDate: (iso: string) => string;
  onOpen: () => void;
  onKeep: () => void;
  onDelete: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  const { t } = useTranslation();
  const asking = pregnancy.outcome === 'loss' && pregnancy.journeyChoice === null;
  const title =
    pregnancy.outcome === 'birth'
      ? pregnancy.babyName
        ? `${pregnancy.babyName} · ${t('journey.past_born', { date: formatDate(pregnancy.endedOn!) })}`
        : t('journey.past_born', { date: formatDate(pregnancy.endedOn!) })
      : t('journey.past_ended', { date: formatDate(pregnancy.endedOn!) });

  return (
    <Card style={styles.pastCard}>
      <Pressable onPress={onOpen} accessibilityRole="button">
        <Text style={styles.pastTitle}>{title}</Text>
        {/* No due date after a loss: a date the baby would have been due
            is exactly the kind of reminder the loss path keeps away. */}
        {pregnancy.outcome === 'birth' ? (
          <Text style={styles.pastSub}>
            {t('journey.past_due', { date: formatDate(effectiveDueDate(pregnancy)) })}
          </Text>
        ) : null}
      </Pressable>
      {asking ? (
        <View style={styles.pastQuestion}>
          <Text style={styles.pastSub}>{t('journey.keep_question')}</Text>
          <View style={styles.pastButtons}>
            <View style={{ flex: 1 }}>
              <Button label={t('journey.keep')} onPress={onKeep} variant="secondary" size="sm" fullWidth />
            </View>
            <View style={{ flex: 1 }}>
              <Button label={t('journey.delete_journey')} onPress={onDelete} variant="ghost" size="sm" fullWidth />
            </View>
          </View>
        </View>
      ) : null}
    </Card>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  pastSection: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pastCard: {
    gap: Spacing.sm,
  },
  pastTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semibold,
    color: colors.textPrimary,
  },
  pastSub: {
    fontSize: Typography.sizes.sm,
    color: colors.textSecondary,
  },
  pastQuestion: {
    gap: Spacing.sm,
  },
  pastButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    flex: 1,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    gap: Spacing.lg,
    padding: Spacing.xl,
  },
  emptyText: {
    fontSize: Typography.sizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: Typography.sizes.md * Typography.lineHeights.relaxed,
  },
});

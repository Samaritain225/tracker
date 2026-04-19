/**
 * History screen — list of logged periods with delete confirmation.
 */

import React, { useCallback, useMemo } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/providers/theme-provider';
import { HistoryItem } from '@/components/cycle/history-item';
import { Icon } from '@/components/ui/icon';
import { usePeriods } from '@/hooks/use-periods';
import { useSettings } from '@/hooks/use-settings';
import { daysBetween, formatDisplayDate, parseISODate } from '@/utils/date';
import type { Period } from '@/db/schema';

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { periods, removePeriod } = usePeriods();
  const { settings } = useSettings();
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
      if (nextItem) {
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
    [sortedPeriods, language, calendarType, handleDelete],
  );

  if (sortedPeriods.length === 0) {
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

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
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

/**
 * "Fasts to make up": for each Ramadan in her history, the suggested
 * number of missed fasts with the dates behind it, a number she can
 * change, and the fasts she has made up.
 */

import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LoadingScreen } from '@/components/ui/loading-screen';
import { DEFAULT_PERIOD_DURATION_DAYS } from '@/constants/cycle';
import { Radii, Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useDailyLogs } from '@/hooks/use-daily-logs';
import { usePeriods } from '@/hooks/use-periods';
import { usePregnancies } from '@/hooks/use-pregnancies';
import { useRamadanFasts } from '@/hooks/use-ramadan-fasts';
import type { RamadanRow } from '@/hooks/use-ramadan-fasts';
import { useSettings } from '@/hooks/use-settings';
import { useToday } from '@/hooks/use-today';
import { useTheme } from '@/providers/theme-provider';
import { formatDisplayDate, parseISODate } from '@/utils/date';

export default function FastsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const todayISO = useToday();
  const { settings, isLoading: sLoading } = useSettings();
  const { periods, isLoading: pLoading } = usePeriods();
  const { logs, isLoading: lLoading } = useDailyLogs();
  const { pregnancies, isLoading: gLoading } = usePregnancies();
  const { rows, setOwed, addMadeUp, removeMadeUp } = useRamadanFasts({
    periods,
    logs,
    pregnancies,
    defaultDurationDays: settings?.periodDurationDays ?? DEFAULT_PERIOD_DURATION_DAYS,
    todayISO,
  });

  if (sLoading || pLoading || lLoading || gLoading) return <LoadingScreen />;

  const language = (settings?.language as 'en' | 'fr') ?? 'fr';
  const calendarType = (settings?.calendarType as 'gregorian' | 'hijri') ?? 'gregorian';
  const formatDate = (iso: string) => formatDisplayDate(parseISODate(iso), language, calendarType);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{t('islamic.fasts_title')}</Text>
        <Text style={styles.body}>{t('islamic.fasts_intro')}</Text>
        <Text style={styles.note}>{t('islamic.fasts_calendar_note')}</Text>
        <Text style={styles.note}>{t('islamic.fasts_excluded_note')}</Text>

        {rows.length === 0 ? <Text style={styles.body}>{t('islamic.fasts_empty')}</Text> : null}

        {rows.map((row) => (
          <RamadanCard
            key={row.range.hijriYear}
            row={row}
            todayISO={todayISO}
            formatDate={formatDate}
            onSetOwed={(n) => setOwed(row.range.hijriYear, n)}
            onMadeUp={() => addMadeUp(row.range.hijriYear, todayISO)}
            onRemove={(id) => removeMadeUp(id)}
            styles={styles}
          />
        ))}

        <Button label={t('common.close')} onPress={() => router.back()} variant="ghost" fullWidth />
      </ScrollView>
    </View>
  );
}

function RamadanCard({
  row,
  formatDate,
  onSetOwed,
  onMadeUp,
  onRemove,
  styles,
}: {
  row: RamadanRow;
  todayISO: string;
  formatDate: (iso: string) => string;
  onSetOwed: (n: number | null) => void;
  onMadeUp: () => void;
  onRemove: (id: string) => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(String(row.owed));
  const remaining = Math.max(0, row.owed - row.madeUp.length);

  const commit = () => {
    const n = parseInt(draft, 10);
    if (Number.isNaN(n) || n < 0 || n > 30) {
      setDraft(String(row.owed));
      return;
    }
    if (n !== row.owed) onSetOwed(n);
  };

  return (
    <Card style={styles.card}>
      <Text style={styles.year}>{t('islamic.ramadan_year', { year: row.range.hijriYear })}</Text>
      <Text style={styles.small}>
        {formatDate(row.range.start)} – {formatDate(row.range.end)}
      </Text>
      <Text style={styles.body}>
        {row.suggestedDates.length > 0
          ? t('islamic.suggested', { count: row.suggestedDates.length })
          : t('islamic.suggested_none')}
      </Text>
      {row.suggestedDates.length > 0 ? (
        <Text style={styles.small}>{row.suggestedDates.map(formatDate).join(', ')}</Text>
      ) : null}

      <View style={styles.owedRow}>
        <Text style={styles.body}>{t('islamic.fasts_title')}</Text>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onEndEditing={commit}
          onSubmitEditing={commit}
          keyboardType="number-pad"
          maxLength={2}
          style={styles.input}
          accessibilityLabel={t('islamic.fasts_title')}
        />
      </View>
      {row.setByHer ? (
        <View style={styles.owedRow}>
          <Text style={styles.small}>{t('islamic.set_by_you')}</Text>
          <Pressable
            onPress={() => {
              setDraft(String(row.suggestedDates.length));
              onSetOwed(null);
            }}
            accessibilityRole="button"
          >
            <Text style={styles.link}>{t('islamic.use_suggestion')}</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.progress}>
        {t('islamic.made_up_progress', { done: row.madeUp.length, owed: row.owed })}
      </Text>
      {row.madeUp.map((m) => (
        <View key={m.id} style={styles.owedRow}>
          <Text style={styles.small}>{t('islamic.made_up_on', { date: formatDate(m.date) })}</Text>
          <Pressable onPress={() => onRemove(m.id)} accessibilityRole="button">
            <Text style={styles.link}>{t('islamic.remove')}</Text>
          </Pressable>
        </View>
      ))}
      {remaining > 0 ? (
        <Button label={t('islamic.made_up_today')} icon="checkmark" onPress={onMadeUp} variant="secondary" fullWidth />
      ) : null}
    </Card>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
    title: { fontSize: Typography.sizes.xxl, fontWeight: Typography.weights.bold, color: colors.textPrimary },
    body: { fontSize: Typography.sizes.md, color: colors.textSecondary, lineHeight: 22 },
    note: { fontSize: Typography.sizes.sm, color: colors.textMuted, fontStyle: 'italic' },
    card: { gap: Spacing.sm },
    year: { fontSize: Typography.sizes.lg, fontWeight: Typography.weights.bold, color: colors.textPrimary },
    small: { fontSize: Typography.sizes.sm, color: colors.textMuted },
    owedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
    input: {
      width: 64,
      textAlign: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.md,
      paddingVertical: Spacing.sm,
      fontSize: Typography.sizes.lg,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
    },
    progress: { fontSize: Typography.sizes.md, fontWeight: Typography.weights.semibold, color: colors.primary },
    link: { fontSize: Typography.sizes.sm, color: colors.primary, fontWeight: Typography.weights.semibold },
  });

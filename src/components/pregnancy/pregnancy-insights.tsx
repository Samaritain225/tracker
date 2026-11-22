/**
 * Insights while pregnant: symptoms by week, weight from visits, and
 * visits so far. Shown in the Insights tab in place of the cycle view.
 */

import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { useCustomSymptoms } from '@/hooks/use-custom-symptoms';
import { Radii, Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import type { DailyLog, Pregnancy, PregnancyVisit } from '@/db/schema';
import { useTheme } from '@/providers/theme-provider';
import { formatDisplayDate, parseISODate } from '@/utils/date';
import { symptomGridByWeek } from '@/utils/journey';
import { gestationalAge } from '@/utils/pregnancy';

type Props = {
  pregnancy: Pregnancy;
  visits: PregnancyVisit[];
  logs: DailyLog[];
  todayISO: string;
  language: 'en' | 'fr';
  calendarType: 'gregorian' | 'hijri';
};

const CELL = 22;

export function PregnancyInsights({ pregnancy, visits, logs, todayISO, language, calendarType }: Props) {
  const { t } = useTranslation();
  const { labelOf } = useCustomSymptoms();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const formatDate = (iso: string) => formatDisplayDate(parseISODate(iso), language, calendarType);

  const currentWeek = gestationalAge(pregnancy, todayISO).weeks;
  const grid = useMemo(
    () => symptomGridByWeek(pregnancy, logs, currentWeek),
    [pregnancy, logs, currentWeek],
  );

  const own = visits.filter((v) => v.pregnancyId === pregnancy.id);
  const past = own.filter((v) => v.date <= todayISO);
  const next = own.find((v) => v.date > todayISO) ?? null;
  const weights = past.filter((v) => v.weightKg !== null) as (PregnancyVisit & { weightKg: number })[];

  return (
    <View style={styles.wrap}>
      <Card style={styles.card}>
        <Text style={styles.label}>{t('insights.pregnancy_symptoms')}</Text>
        {grid.rows.length === 0 ? (
          <Text style={styles.empty}>{t('insights.pregnancy_symptoms_empty')}</Text>
        ) : (
          <View style={styles.gridWrap}>
            <View>
              <View style={{ height: CELL }} />
              {grid.rows.map((row) => (
                <Text key={row.key} style={styles.rowLabel} numberOfLines={1}>
                  {labelOf(row.key)}
                </Text>
              ))}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View style={styles.gridRow}>
                  {grid.weeks.map((w) => (
                    <Text key={w} style={styles.weekLabel}>
                      {w}
                    </Text>
                  ))}
                </View>
                {grid.rows.map((row) => (
                  <View key={row.key} style={styles.gridRow}>
                    {row.counts.map((days, i) => (
                      <View
                        key={grid.weeks[i]}
                        style={[
                          styles.cell,
                          {
                            backgroundColor: days === 0 ? colors.surfaceAlt : colors.primary,
                            opacity: days === 0 ? 1 : 0.25 + 0.75 * Math.min(days, 7) / 7,
                          },
                        ]}
                      />
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}
        {grid.rows.length > 0 ? <Text style={styles.note}>{t('insights.pregnancy_symptoms_note')}</Text> : null}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.label}>{t('insights.pregnancy_weight')}</Text>
        {weights.length < 2 ? (
          <Text style={styles.empty}>{t('insights.pregnancy_weight_empty')}</Text>
        ) : (
          <WeightBars weights={weights} formatDate={formatDate} styles={styles} />
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.label}>{t('insights.pregnancy_visits')}</Text>
        <Text style={styles.value}>{t('insights.pregnancy_visits_count', { count: past.length })}</Text>
        {next ? (
          <Text style={styles.note}>
            {t('journey.next_visit')}: {t(`journey.visit_${next.kind}`)} · {formatDate(next.date)}
          </Text>
        ) : null}
      </Card>
    </View>
  );
}

function WeightBars({
  weights,
  formatDate,
  styles,
}: {
  weights: { date: string; weightKg: number }[];
  formatDate: (iso: string) => string;
  styles: ReturnType<typeof makeStyles>;
}) {
  const { t } = useTranslation();
  const min = Math.min(...weights.map((w) => w.weightKg));
  const max = Math.max(...weights.map((w) => w.weightKg));
  const change = weights[weights.length - 1].weightKg - weights[0].weightKg;
  const sign = change > 0 ? '+' : '';

  return (
    <View style={styles.bars}>
      {weights.map((w) => (
        <View key={w.date} style={styles.barRow}>
          <Text style={styles.barDate} numberOfLines={1}>
            {formatDate(w.date)}
          </Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                // Bars start at 30% so the lightest weight is still visible.
                { width: `${30 + (max === min ? 70 : (70 * (w.weightKg - min)) / (max - min))}%` },
              ]}
            />
          </View>
          <Text style={styles.barValue}>{t('journey.weight', { value: w.weightKg })}</Text>
        </View>
      ))}
      <Text style={styles.note}>
        {t('insights.pregnancy_weight_change', { value: `${sign}${change.toFixed(1)}` })}
      </Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { gap: Spacing.lg },
    card: { gap: Spacing.sm },
    label: {
      fontSize: Typography.sizes.sm,
      fontWeight: Typography.weights.semibold,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    empty: { fontSize: Typography.sizes.sm, color: colors.textMuted, fontStyle: 'italic' },
    note: { fontSize: Typography.sizes.xs, color: colors.textMuted },
    value: { fontSize: Typography.sizes.lg, fontWeight: Typography.weights.semibold, color: colors.textPrimary },
    gridWrap: { flexDirection: 'row', gap: Spacing.sm },
    gridRow: { flexDirection: 'row', gap: 3, marginBottom: 3 },
    rowLabel: {
      height: CELL,
      marginBottom: 3,
      fontSize: Typography.sizes.xs,
      color: colors.textSecondary,
      textAlignVertical: 'center',
      maxWidth: 110,
    },
    weekLabel: { width: CELL, height: CELL, textAlign: 'center', fontSize: 10, color: colors.textMuted },
    cell: { width: CELL, height: CELL, borderRadius: Radii.sm },
    bars: { gap: Spacing.xs },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    barDate: { width: 110, fontSize: Typography.sizes.xs, color: colors.textSecondary },
    barTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 5, backgroundColor: colors.primaryLight },
    barValue: { width: 64, textAlign: 'right', fontSize: Typography.sizes.xs, color: colors.textPrimary },
  });

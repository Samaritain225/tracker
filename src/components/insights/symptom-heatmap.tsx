/**
 * SymptomHeatmap — visual grid showing symptom frequency across cycle days.
 * X-axis: day of cycle (1 → cycle length)
 * Y-axis: symptom type
 * Cell opacity scales with how often that symptom occurs on that cycle day.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Radii, Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/providers/theme-provider';
import type { DailyLog, Period } from '@/db/schema';
import { daysBetween, parseISODate } from '@/utils/date';

const SYMPTOM_KEYS = ['cramps', 'headache', 'bloating', 'acne', 'fatigue'];
const CELL_SIZE = 14;
const CELL_GAP = 2;

type Props = {
  periods: Period[];
  logs: DailyLog[];
  cycleLength: number;
};

export function SymptomHeatmap({ periods, logs, cycleLength }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Map each log to its cycle-relative day, then count symptom occurrences per day
  const heatmapData = useMemo(() => {
    if (periods.length === 0 || logs.length === 0) return null;

    const sortedPeriods = [...periods]
      .map((p) => p.startDate)
      .sort();

    // For each log, figure out which cycle day it falls on
    const grid: Record<string, number[]> = {};
    for (const sym of SYMPTOM_KEYS) {
      grid[sym] = new Array(cycleLength).fill(0);
    }

    let maxCount = 0;

    for (const log of logs) {
      if (!log.symptoms || log.symptoms.length === 0) continue;

      // Find the most recent period start before this log's date
      const logDate = parseISODate(log.date);
      let cycleStart: string | null = null;
      for (let i = sortedPeriods.length - 1; i >= 0; i--) {
        if (sortedPeriods[i] <= log.date) {
          cycleStart = sortedPeriods[i];
          break;
        }
      }
      if (!cycleStart) continue;

      const dayInCycle = daysBetween(parseISODate(cycleStart), logDate);
      if (dayInCycle < 0 || dayInCycle >= cycleLength) continue;

      for (const sym of log.symptoms) {
        if (grid[sym]) {
          grid[sym][dayInCycle]++;
          maxCount = Math.max(maxCount, grid[sym][dayInCycle]);
        }
      }
    }

    if (maxCount === 0) return null;
    return { grid, maxCount };
  }, [periods, logs, cycleLength]);

  if (!heatmapData) return null;

  // Show a condensed view: group days into chunks of ~7 (weekly buckets) if cycle is too wide
  const showDays = Math.min(cycleLength, 35);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('insights.symptom_heatmap')}</Text>

      {/* Day labels header */}
      <View style={styles.gridContainer}>
        <View style={styles.labelColumn}>
          <View style={[styles.cell, { backgroundColor: 'transparent' }]} />
          {SYMPTOM_KEYS.map((sym) => (
            <Text key={sym} style={styles.rowLabel} numberOfLines={1}>
              {t(`day_details.symptom_${sym}`)}
            </Text>
          ))}
        </View>

        <View style={styles.heatmapScroll}>
          {/* Column headers — day numbers */}
          <View style={styles.row}>
            {Array.from({ length: showDays }, (_, i) => (
              <View key={`h-${i}`} style={styles.cell}>
                <Text style={styles.dayHeader}>{i + 1}</Text>
              </View>
            ))}
          </View>

          {/* Symptom rows */}
          {SYMPTOM_KEYS.map((sym, index) => (
            <Animated.View 
              key={sym} 
              entering={FadeInDown.duration(400).delay(index * 100).springify()}
              style={styles.row}
            >
              {Array.from({ length: showDays }, (_, dayIdx) => {
                const count = heatmapData.grid[sym][dayIdx] ?? 0;
                const intensity = count / heatmapData.maxCount;
                return (
                  <View
                    key={`${sym}-${dayIdx}`}
                    style={[
                      styles.cell,
                      styles.heatCell,
                      {
                        backgroundColor:
                          intensity > 0
                            ? `${colors.primary}${Math.round(intensity * 200 + 55).toString(16).padStart(2, '0')}`
                            : colors.surfaceAlt,
                      },
                    ]}
                  />
                );
              })}
            </Animated.View>
          ))}
        </View>
      </View>

      <Text style={styles.legend}>
        {t('insights.cycle_day')}
      </Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderCurve: 'continuous',
    gap: Spacing.sm,
  },
  title: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  gridContainer: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  labelColumn: {
    gap: CELL_GAP,
    justifyContent: 'flex-start',
  },
  rowLabel: {
    fontSize: 9,
    color: colors.textMuted,
    height: CELL_SIZE,
    lineHeight: CELL_SIZE,
    width: 52,
  },
  heatmapScroll: {
    flex: 1,
    gap: CELL_GAP,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    gap: CELL_GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heatCell: {
    borderRadius: 3,
  },
  dayHeader: {
    fontSize: 7,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  legend: {
    fontSize: Typography.sizes.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
});

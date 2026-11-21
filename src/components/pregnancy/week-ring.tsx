/**
 * WeekRing — the pregnancy Home centrepiece: forty dots around a circle,
 * one per week, filled as the weeks pass, with the current week in the
 * middle. Built from plain Views so it needs no native drawing library.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Typography } from '@/constants/theme';
import { useTheme } from '@/providers/theme-provider';
import type { GestationalAge, Trimester } from '@/utils/pregnancy';

const WEEKS = 40;
const SIZE = 216;
const DOT = 10;
const RADIUS = SIZE / 2 - DOT;

type Props = {
  age: GestationalAge;
  trimester: Trimester;
};

export function WeekRing({ age, trimester }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <View
      style={styles.ring}
      accessible
      accessibilityLabel={`${t('pregnancy.age', { weeks: age.weeks, days: age.days })}, ${t(`pregnancy.trimester_${trimester}`)}`}
    >
      {Array.from({ length: WEEKS }, (_, i) => {
        // Start at the top and run clockwise.
        const angle = (i / WEEKS) * 2 * Math.PI - Math.PI / 2;
        const isCurrent = i === Math.min(age.weeks, WEEKS - 1);
        const isPast = i < age.weeks;
        return (
          <View
            key={i}
            style={[
              styles.dot,
              {
                left: SIZE / 2 + RADIUS * Math.cos(angle) - DOT / 2,
                top: SIZE / 2 + RADIUS * Math.sin(angle) - DOT / 2,
                backgroundColor: isPast || isCurrent ? colors.primary : colors.surfaceAlt,
                transform: [{ scale: isCurrent ? 1.6 : 1 }],
              },
            ]}
          />
        );
      })}

      <View style={styles.centre}>
        <Text style={[styles.week, { color: colors.textPrimary }]}>
          {t('pregnancy.week_label', { week: age.weeks })}
        </Text>
        <Text style={[styles.days, { color: colors.textSecondary }]}>
          {t('pregnancy.age_short', { days: age.days })}
        </Text>
        <Text style={[styles.trimester, { color: colors.primary }]}>
          {t(`pregnancy.trimester_${trimester}`)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    width: SIZE,
    height: SIZE,
    alignSelf: 'center',
  },
  dot: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
  },
  centre: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  week: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.bold,
  },
  days: {
    fontSize: Typography.sizes.sm,
    fontVariant: ['tabular-nums'],
  },
  trimester: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    marginTop: 4,
  },
});

/**
 * Badge — small colored label using theme color keys.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Radii, Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/providers/theme-provider';

type ColorKey = 'period' | 'fertile' | 'ovulation' | 'predicted' | 'success' | 'danger';

type Props = {
  label: string;
  colorKey: ColorKey;
};

const getColorMap = (colors: ThemeColors): Record<ColorKey, { bg: string; text: string }> => ({
  period: { bg: colors.period, text: colors.periodText },
  fertile: { bg: colors.fertile, text: colors.fertileText },
  ovulation: { bg: colors.ovulation, text: colors.ovulationText },
  predicted: { bg: colors.predicted, text: colors.predictedText },
  success: { bg: colors.success, text: colors.successText },
  danger: { bg: colors.danger, text: colors.dangerText },
});

export function Badge({ label, colorKey }: Props) {
  const { colors: themeColors } = useTheme();
  const colors = getColorMap(themeColors)[colorKey];
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs / 2,
    borderRadius: Radii.full,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
  },
});

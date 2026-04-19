/**
 * MetricCard — displays a label/value pair with optional subtitle.
 * Used in the home screen for cycle metrics.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Radii, Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/providers/theme-provider';

type Props = {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
};

export function MetricCard({ label, value, sub, accent = false }: Props) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  return (
    <View
      style={[
        styles.container,
        accent && styles.accentContainer,
      ]}
    >
      <Text
        style={[styles.label, accent && styles.accentLabel]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text
        style={[styles.value, accent && styles.accentValue]}
        numberOfLines={1}
        selectable
      >
        {value}
      </Text>
      {sub ? (
        <Text
          style={[styles.sub, accent && styles.accentSub]}
          numberOfLines={1}
        >
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderCurve: 'continuous',
    gap: Spacing.xs,
  },
  accentContainer: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  label: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.medium,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  accentLabel: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  value: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  accentValue: {
    color: colors.primaryText,
  },
  sub: {
    fontSize: Typography.sizes.xs,
    color: colors.textSecondary,
  },
  accentSub: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
});

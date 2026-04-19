/**
 * CalendarLegend — colour key for the calendar day types.
 * Labels sourced from i18n translations.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/providers/theme-provider';

type LegendItem = {
  key: string;
  fillColor: string;
  borderColor?: string;
};

const getItems = (colors: ThemeColors): LegendItem[] => [
  { key: 'period', fillColor: colors.period },
  { key: 'fertile', fillColor: colors.fertile + '30', borderColor: colors.fertile },
  { key: 'ovulation', fillColor: colors.ovulation },
  { key: 'predicted', fillColor: colors.predicted + '30', borderColor: colors.predicted },
];

export function CalendarLegend() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const ITEMS = getItems(colors);

  return (
    <View style={styles.container}>
      {ITEMS.map((item) => (
        <View key={item.key} style={styles.item}>
          <View
            style={[
              styles.dot,
              {
                backgroundColor: item.fillColor,
                borderWidth: item.borderColor ? 1.5 : 0,
                borderColor: item.borderColor ?? 'transparent',
              },
            ]}
          />
          <Text style={styles.label}>{t(`legend.${item.key}`)}</Text>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.lg,
    paddingVertical: Spacing.sm,
    justifyContent: 'center',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  label: {
    fontSize: Typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: Typography.weights.medium,
  },
});

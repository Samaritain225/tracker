/**
 * HistoryItem — single row in the period history list.
 * Shows formatted date, cycle gap badge, and delete action.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Radii, Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/providers/theme-provider';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';

type Props = {
  id: string;
  formattedDate: string;
  cycleGap: number | null;
  isFirst: boolean;
  onDelete: (id: string) => void;
};

export function HistoryItem({
  id,
  formattedDate,
  cycleGap,
  isFirst,
  onDelete,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.date} selectable>
          {formattedDate}
        </Text>
        {isFirst ? (
          <Text style={styles.firstLabel}>{t('history.first_entry')}</Text>
        ) : cycleGap !== null ? (
          <Badge
            label={t('history.cycle_gap', { count: cycleGap })}
            colorKey="fertile"
          />
        ) : null}
      </View>

      <Pressable
        onPress={() => onDelete(id)}
        accessibilityLabel={t('history.delete')}
        accessibilityRole="button"
        hitSlop={8}
        style={({ pressed }) => [
          styles.deleteButton,
          { opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Icon name="trash-outline" size={18} color={colors.danger} />
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderCurve: 'continuous',
  },
  content: {
    flex: 1,
    gap: Spacing.xs,
  },
  date: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.medium,
    color: colors.textPrimary,
  },
  firstLabel: {
    fontSize: Typography.sizes.xs,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  deleteButton: {
    padding: Spacing.sm,
  },
});

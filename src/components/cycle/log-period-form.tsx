/**
 * LogPeriodForm — date picker + save button for logging a period start.
 */

import React, { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Radii, Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/providers/theme-provider';
import { toISODate } from '@/utils/date';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';

type Props = {
  onSave: (isoDate: string) => Promise<void>;
  error: string | null;
};

export function LogPeriodForm({ onSave, error }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    await onSave(toISODate(selectedDate));
    setSaving(false);
  }, [onSave, selectedDate]);

  const adjustDate = useCallback((delta: number) => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + delta);
      return next;
    });
  }, []);

  const formattedDate = selectedDate.toLocaleDateString(
    Platform.OS === 'ios' ? undefined : 'fr-FR',
    { day: 'numeric', month: 'long', year: 'numeric' },
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('home.log_period')}</Text>

      <View style={styles.dateRow}>
        <Pressable
          onPress={() => adjustDate(-1)}
          accessibilityLabel="Previous day"
          hitSlop={8}
          style={styles.arrowButton}
        >
          <Icon name="chevron-back" size={20} color={colors.primary} />
        </Pressable>

        <Text style={styles.dateText}>{formattedDate}</Text>

        <Pressable
          onPress={() => adjustDate(1)}
          accessibilityLabel="Next day"
          hitSlop={8}
          style={styles.arrowButton}
        >
          <Icon name="chevron-forward" size={20} color={colors.primary} />
        </Pressable>
      </View>

      {error ? (
        <Text style={styles.error}>{t(`errors.${error}`)}</Text>
      ) : null}

      <Button
        label={t('home.save')}
        onPress={handleSave}
        loading={saving}
        icon="checkmark"
        fullWidth
      />
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
    gap: Spacing.md,
  },
  title: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semibold,
    color: colors.textPrimary,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  arrowButton: {
    padding: Spacing.sm,
    borderRadius: Radii.full,
    backgroundColor: colors.surfaceAlt,
  },
  dateText: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.medium,
    color: colors.textPrimary,
    minWidth: 180,
    textAlign: 'center',
  },
  error: {
    fontSize: Typography.sizes.sm,
    color: colors.danger,
    textAlign: 'center',
  },
});

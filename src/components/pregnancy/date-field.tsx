/**
 * DateField — a labelled date with the app's own calendar underneath for
 * choosing it, ringing the chosen day.
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CalendarGrid } from '@/components/calendar/calendar-grid';
import { Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/providers/theme-provider';
import { formatDisplayDate, parseISODate } from '@/utils/date';

type Props = {
  label: string;
  valueISO: string;
  onChange: (iso: string) => void;
  todayISO: string;
  language: 'en' | 'fr';
  calendarType: 'gregorian' | 'hijri';
};

export function DateField({ label, valueISO, onChange, todayISO, language, calendarType }: Props) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  // The grid browses relative to the month it was opened on. Anchoring it
  // to the current selection instead would shift the browsing position
  // every time a day in another month was picked.
  const [anchor] = useState(() => parseISODate(valueISO));

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>
        {formatDisplayDate(parseISODate(valueISO), language, calendarType)}
      </Text>
      <CalendarGrid
        year={anchor.getFullYear()}
        month={anchor.getMonth()}
        cycleInfo={null}
        calendarType={calendarType}
        language={language}
        todayISO={todayISO}
        markedISO={valueISO}
        onDayPress={onChange}
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      gap: Spacing.xs,
    },
    label: {
      fontSize: Typography.sizes.sm,
      fontWeight: Typography.weights.semibold,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    value: {
      fontSize: Typography.sizes.lg,
      fontWeight: Typography.weights.semibold,
      color: colors.textPrimary,
      marginBottom: Spacing.xs,
    },
  });

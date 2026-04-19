/**
 * CalendarDay — single day cell in the calendar grid.
 *
 * Display choice (Option A): In Hijri mode, show only the Hijri day number.
 * The grid layout itself remains Gregorian, so spatial position gives Gregorian context.
 *
 * Period days receive a `periodPosition` prop so adjacent period days render as
 * a connected pill rather than individual circles.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/providers/theme-provider';
import type { DayType } from '@/utils/cycle';
import { getHijriDay } from '@/utils/hijri';

export type PeriodPosition = 'single' | 'first' | 'middle' | 'last' | 'none';

type Props = {
  gregorianDate: Date;
  type: DayType;
  isToday: boolean;
  hasLog?: boolean;
  calendarType: 'gregorian' | 'hijri';
  periodPosition?: PeriodPosition;
  onPress: () => void;
};

const CELL_SIZE = 38;
const ROW_HEIGHT = 44;

function getDayColors({ type, isToday, colors }: { type: DayType; isToday: boolean; colors: ThemeColors }): { bg: string; text: string } {
  switch (type) {
    case 'period':
      return { bg: colors.period, text: colors.periodText };
    case 'ovulation':
      return { bg: colors.ovulation, text: colors.ovulationText };
    case 'fertile':
      return { bg: colors.fertile + '30', text: colors.fertile };
    case 'predicted':
      return { bg: colors.predicted + '30', text: colors.predicted };
    default:
      return { bg: 'transparent', text: isToday ? colors.primary : colors.textPrimary };
  }
}

export function CalendarDay({
  gregorianDate,
  type,
  isToday,
  hasLog = false,
  calendarType,
  periodPosition = 'none',
  onPress,
}: Props) {
  const { colors: themeColors } = useTheme();

  const dayNumber =
    calendarType === 'hijri'
      ? getHijriDay(gregorianDate)
      : gregorianDate.getDate();

  const dayColors = getDayColors({ type, isToday, colors: themeColors });

  // Period range pill: extend background to fill the gap between adjacent period days
  const isPeriod = type === 'period';
  const showLeftExtension = isPeriod && (periodPosition === 'middle' || periodPosition === 'last');
  const showRightExtension = isPeriod && (periodPosition === 'middle' || periodPosition === 'first');

  // Border radii for the circle based on period position
  const cellBorderRadius = isPeriod
    ? periodPosition === 'first' ? { borderTopLeftRadius: CELL_SIZE / 2, borderBottomLeftRadius: CELL_SIZE / 2, borderTopRightRadius: 4, borderBottomRightRadius: 4 }
    : periodPosition === 'last' ? { borderTopLeftRadius: 4, borderBottomLeftRadius: 4, borderTopRightRadius: CELL_SIZE / 2, borderBottomRightRadius: CELL_SIZE / 2 }
    : periodPosition === 'middle' ? { borderRadius: 4 }
    : { borderRadius: CELL_SIZE / 2 }  // single
    : { borderRadius: CELL_SIZE / 2 };

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`${gregorianDate.toDateString()}, ${type}`}
      accessibilityRole="button"
      style={styles.wrapper}
    >
      {/* Period range background extension — fills the gap between cells */}
      {showLeftExtension && (
        <View style={[styles.rangeExtension, styles.rangeLeft, { backgroundColor: themeColors.period }]} />
      )}
      {showRightExtension && (
        <View style={[styles.rangeExtension, styles.rangeRight, { backgroundColor: themeColors.period }]} />
      )}

      {/* Main cell */}
      <View
        style={[
          styles.cell,
          { backgroundColor: dayColors.bg },
          cellBorderRadius,
          isToday && type === 'none' && { borderWidth: 2, borderColor: themeColors.primary },
        ]}
      >
        <Text
          style={[
            styles.dayText,
            { color: dayColors.text },
            isToday && { fontWeight: Typography.weights.bold },
          ]}
        >
          {dayNumber}
        </Text>
      </View>

      {/* Log indicator dot */}
      {hasLog && (
        <View
          style={[
            styles.logIndicator,
            {
              backgroundColor:
                type === 'none' || type === 'predicted'
                  ? themeColors.primary
                  : themeColors.surface,
            },
          ]}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '14.28%',
    height: ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    fontVariant: ['tabular-nums'],
  },
  logIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    bottom: 3,
  },
  rangeExtension: {
    position: 'absolute',
    top: (ROW_HEIGHT - CELL_SIZE) / 2,
    height: CELL_SIZE,
    width: '50%',
  },
  rangeLeft: {
    left: 0,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  rangeRight: {
    right: 0,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
});

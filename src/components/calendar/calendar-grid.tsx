/**
 * CalendarGrid — month grid with navigation.
 * Grid layout is always Gregorian (7 columns, Sun–Sat).
 * Day numbers and header change based on calendarType.
 *
 * Period days receive positional context (first/middle/last/single)
 * so CalendarDay can render connected range pills.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radii, Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/providers/theme-provider';
import type { CycleInfo } from '@/hooks/use-cycle-calc';
import type { DailyLog } from '@/db/schema';
import { getDayType } from '@/utils/cycle';
import { formatMonthHeader, isSameDay, toISODate } from '@/utils/date';
import { CalendarDay } from './calendar-day';
import type { PeriodPosition } from './calendar-day';
import { Icon } from '@/components/ui/icon';

type Props = {
  year: number;
  month: number;
  periods: string[];
  cycleInfo: CycleInfo | null;
  dailyLogs?: DailyLog[];
  periodDurationDays: number;
  calendarType: 'gregorian' | 'hijri';
  language: 'en' | 'fr';
  onDayPress: (isoDate: string) => void;
};

const WEEKDAY_KEYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_KEYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

export function CalendarGrid({
  year,
  month,
  periods,
  cycleInfo,
  dailyLogs = [],
  periodDurationDays,
  calendarType,
  language,
  onDayPress,
}: Props) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  const [currentYear, setCurrentYear] = useState(year);
  const [currentMonth, setCurrentMonth] = useState(month);

  const weekdays = language === 'fr' ? WEEKDAY_KEYS_FR : WEEKDAY_KEYS_EN;

  const navigateMonth = useCallback((delta: number) => {
    setCurrentMonth((prev) => {
      let newMonth = prev + delta;
      let newYear = currentYear;
      if (newMonth < 0) {
        newMonth = 11;
        newYear -= 1;
      } else if (newMonth > 11) {
        newMonth = 0;
        newYear += 1;
      }
      setCurrentYear(newYear);
      return newMonth;
    });
  }, [currentYear]);

  const headerText = formatMonthHeader(currentYear, currentMonth, language, calendarType);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const startOffset = firstDay.getDay(); // 0=Sun
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const days: (Date | null)[] = [];

    // Padding for days before the 1st
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }

    // Actual days
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(currentYear, currentMonth, d));
    }

    return days;
  }, [currentYear, currentMonth]);

  const today = useMemo(() => new Date(), []);

  // Default fertile window and ovulation for getDayType
  const defaultFertileWindow = cycleInfo?.fertileWindow ?? { start: new Date(0), end: new Date(0) };
  const defaultOvulation = cycleInfo?.ovulationDay ?? new Date(0);
  const defaultNextPeriod = cycleInfo?.nextPeriod ?? new Date(0);

  // Pre-compute day types and period positions for the entire grid
  const dayData = useMemo(() => {
    return calendarDays.map((date) => {
      if (!date) return null;

      const dayType = getDayType(
        date,
        periods,
        periodDurationDays,
        defaultFertileWindow,
        defaultOvulation,
        defaultNextPeriod,
      );
      const isoDate = toISODate(date);
      const hasLog = dailyLogs.some((l) => l.date === isoDate);

      return { date, dayType, isoDate, hasLog };
    });
  }, [calendarDays, periods, periodDurationDays, defaultFertileWindow, defaultOvulation, defaultNextPeriod, dailyLogs]);

  // Compute period positions (first/middle/last/single) for connected range rendering
  const periodPositions = useMemo(() => {
    return dayData.map((entry, index) => {
      if (!entry || entry.dayType !== 'period') return 'none' as PeriodPosition;

      const prevIsPeriod = index > 0 && dayData[index - 1]?.dayType === 'period';
      const nextIsPeriod = index < dayData.length - 1 && dayData[index + 1]?.dayType === 'period';

      // Don't connect across row boundaries (every 7 cells)
      const col = index % 7;
      const prevSameRow = col > 0 && prevIsPeriod;
      const nextSameRow = col < 6 && nextIsPeriod;

      if (prevSameRow && nextSameRow) return 'middle' as PeriodPosition;
      if (prevSameRow) return 'last' as PeriodPosition;
      if (nextSameRow) return 'first' as PeriodPosition;
      return 'single' as PeriodPosition;
    });
  }, [dayData]);

  return (
    <View style={styles.container}>
      {/* Month navigation header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigateMonth(-1)}
          accessibilityLabel="Previous month"
          hitSlop={12}
          style={styles.navButton}
        >
          <Icon name="chevron-back" size={20} color={colors.textSecondary} />
        </Pressable>
        <Text style={styles.headerText}>{headerText}</Text>
        <Pressable
          onPress={() => navigateMonth(1)}
          accessibilityLabel="Next month"
          hitSlop={12}
          style={styles.navButton}
        >
          <Icon name="chevron-forward" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Weekday labels */}
      <View style={styles.weekdayRow}>
        {weekdays.map((day) => (
          <View key={day} style={styles.weekdayCell}>
            <Text style={styles.weekdayText}>{day}</Text>
          </View>
        ))}
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Day grid */}
      <View style={styles.grid}>
        {dayData.map((entry, index) => {
          if (!entry) {
            return <View key={`empty-${index}`} style={styles.emptyCell} />;
          }

          return (
            <CalendarDay
              key={entry.isoDate}
              gregorianDate={entry.date}
              type={entry.dayType}
              isToday={isSameDay(entry.date, today)}
              hasLog={entry.hasLog}
              calendarType={calendarType}
              periodPosition={periodPositions[index]}
              onPress={() => onDayPress(entry.isoDate)}
            />
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: Radii.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderCurve: 'continuous',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.md,
  },
  navButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semibold,
    color: colors.textPrimary,
    textTransform: 'capitalize',
  },
  weekdayRow: {
    flexDirection: 'row',
    paddingBottom: Spacing.xs,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekdayText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginBottom: Spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emptyCell: {
    width: '14.28%',
    height: 44,
  },
});

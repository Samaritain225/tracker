/**
 * PregnancyOverview — the top of Home while pregnant: the week ring, the
 * due date with days to go, the likely star sign, and a quick way to log
 * today. The calendar below it is rendered by the Home screen itself.
 *
 * The weekly baby-development card is added with the week-by-week
 * content in a later pull request.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import type { Pregnancy } from '@/db/schema';
import { useTheme } from '@/providers/theme-provider';
import { formatDisplayDate, parseISODate } from '@/utils/date';
import {
  daysUntilDue,
  effectiveDueDate,
  gestationalAge,
  trimesterFor,
} from '@/utils/pregnancy';
import { STAR_SIGN_SYMBOLS, likelyStarSign } from '@/utils/zodiac';
import { WeekRing } from './week-ring';

type Props = {
  pregnancy: Pregnancy;
  todayISO: string;
  language: 'en' | 'fr';
  calendarType: 'gregorian' | 'hijri';
  showStarSign: boolean;
  onLogToday: () => void;
};

export function PregnancyOverview({
  pregnancy,
  todayISO,
  language,
  calendarType,
  showStarSign,
  onLogToday,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  const age = gestationalAge(pregnancy, todayISO);
  const trimester = trimesterFor(age.weeks);
  const dueISO = effectiveDueDate(pregnancy);
  const toGo = daysUntilDue(pregnancy, todayISO);
  const formatDate = (iso: string) => formatDisplayDate(parseISODate(iso), language, calendarType);

  const countdown =
    toGo > 0
      ? t('pregnancy.days_to_go', { count: toGo })
      : toGo === 0
        ? t('pregnancy.due_today')
        : t('pregnancy.past_due', { count: -toGo });

  const star = likelyStarSign(dueISO);

  return (
    <View style={styles.wrap}>
      <WeekRing age={age} trimester={trimester} />
      <Text style={styles.age}>{t('pregnancy.age', { weeks: age.weeks, days: age.days })}</Text>

      <Card style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.label}>{t('pregnancy.due_date')}</Text>
          <Text style={styles.value}>{formatDate(dueISO)}</Text>
          <Text style={[styles.sub, toGo < 0 && { color: colors.primary }]}>{countdown}</Text>
        </View>
        {showStarSign ? (
          <View style={[styles.half, styles.right]}>
            <Text style={styles.label}>{t('pregnancy.star_sign')}</Text>
            <Text style={styles.value}>
              {STAR_SIGN_SYMBOLS[star.sign]} {t(`pregnancy.sign_${star.sign}`)}
            </Text>
            {star.other ? (
              <Text style={[styles.sub, styles.rightText]}>
                {t(star.other.when === 'after' ? 'pregnancy.star_or_after' : 'pregnancy.star_or_before', {
                  sign: t(`pregnancy.sign_${star.other.sign}`),
                  date: formatDate(star.other.boundary),
                })}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Card>

      <Button
        label={t('pregnancy.log_today')}
        icon="add-circle-outline"
        onPress={onLogToday}
        variant="primary"
        fullWidth
      />

      <Text style={styles.disclaimer}>{t('pregnancy.disclaimer')}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      gap: Spacing.md,
    },
    age: {
      textAlign: 'center',
      fontSize: Typography.sizes.sm,
      color: colors.textSecondary,
      fontVariant: ['tabular-nums'],
      marginTop: -Spacing.xs,
    },
    row: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    half: {
      flex: 1,
      gap: 2,
    },
    right: {
      alignItems: 'flex-end',
    },
    rightText: {
      textAlign: 'right',
    },
    label: {
      fontSize: Typography.sizes.xs,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    value: {
      fontSize: Typography.sizes.md,
      fontWeight: Typography.weights.semibold,
      color: colors.textPrimary,
    },
    sub: {
      fontSize: Typography.sizes.xs,
      color: colors.textSecondary,
    },
    disclaimer: {
      fontSize: Typography.sizes.xs,
      color: colors.textMuted,
      fontStyle: 'italic',
      textAlign: 'center',
    },
  });

/**
 * PregnancyOverview — the top of Home while pregnant: the week ring, the
 * due date with days to go, the likely star sign, and a quick way to log
 * today. The calendar below it is rendered by the Home screen itself.
 *
 * The weekly baby-development card is added with the week-by-week
 * content in a later pull request.
 */

import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import type { Pregnancy, PregnancyVisit } from '@/db/schema';
import { useTheme } from '@/providers/theme-provider';
import { formatDisplayDate, parseISODate } from '@/utils/date';
import {
  daysUntilDue,
  effectiveDueDate,
  gestationalAge,
  trimesterFor,
} from '@/utils/pregnancy';
import { STAR_SIGN_SYMBOLS, likelyStarSign } from '@/utils/zodiac';
import { contentForWeek } from '@/utils/pregnancy-content';
import { WeekRing } from './week-ring';

type Props = {
  pregnancy: Pregnancy;
  todayISO: string;
  language: 'en' | 'fr';
  calendarType: 'gregorian' | 'hijri';
  showStarSign: boolean;
  /** The soonest visit from today on, if one is planned. */
  nextVisit: PregnancyVisit | null;
  onLogToday: () => void;
  onOpenVisit: (visit: PregnancyVisit) => void;
};

export function PregnancyOverview({
  pregnancy,
  todayISO,
  language,
  calendarType,
  showStarSign,
  nextVisit,
  onLogToday,
  onOpenVisit,
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
  const router = useRouter();
  const week = contentForWeek(age.weeks, language);
  const sizeParts = [
    week.size ? t('pregnancy.size_line', { size: week.size }) : null,
    week.lengthCm !== null
      ? `${t('pregnancy.length', { value: week.lengthCm.toLocaleString(language) })}${
          week.measure ? ` (${t(`pregnancy.measure_${week.measure}`)})` : ''
        }`
      : null,
  ].filter(Boolean);

  return (
    <View style={styles.wrap}>
      <WeekRing age={age} trimester={trimester} emoji={week.emoji} />
      <Text style={styles.age}>{t('pregnancy.age', { weeks: age.weeks, days: age.days })}</Text>
      {sizeParts.length > 0 ? <Text style={styles.sizeLine}>{sizeParts.join(' · ')}</Text> : null}

      <Card style={styles.weekCard}>
        <Text style={styles.label}>{t('pregnancy.this_week')}</Text>
        <Text style={styles.weekText}>{week.baby}</Text>
        <Text style={[styles.label, styles.forYou]}>{t('pregnancy.for_you')}</Text>
        <Text style={styles.weekText}>{week.body}</Text>
        <Pressable
          onPress={() => router.push('/pregnancy/sources')}
          accessibilityRole="link"
          hitSlop={8}
        >
          <Text style={styles.link}>{t('pregnancy.about_info')} ›</Text>
        </Pressable>
      </Card>

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

      {nextVisit ? (
        <Card style={styles.row} onPress={() => onOpenVisit(nextVisit)}>
          <View style={styles.half}>
            <Text style={styles.label}>{t('journey.next_visit')}</Text>
            <Text style={styles.value}>
              {t(`journey.visit_${nextVisit.kind}`)}
              {nextVisit.title ? ` — ${nextVisit.title}` : ''}
            </Text>
            <Text style={styles.sub}>{formatDate(nextVisit.date)}</Text>
          </View>
        </Card>
      ) : null}

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
    sizeLine: {
      textAlign: 'center',
      fontSize: Typography.sizes.sm,
      color: colors.textPrimary,
    },
    weekCard: {
      gap: Spacing.xs,
    },
    weekText: {
      fontSize: Typography.sizes.md,
      color: colors.textPrimary,
      lineHeight: 22,
    },
    forYou: {
      marginTop: Spacing.sm,
    },
    link: {
      marginTop: Spacing.sm,
      fontSize: Typography.sizes.sm,
      fontWeight: Typography.weights.semibold,
      color: colors.primary,
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

/**
 * RecoveryOverview — the top of Home after a pregnancy has ended and
 * before the first period comes back.
 *
 * After a birth: days since the birth, a short note on recovery, the
 * breastfeeding question, and the reminder that she can get pregnant
 * again before her first period.
 *
 * After a loss: one quiet card. No baby content, no counts, nothing
 * cheerful.
 *
 * Both end with "My period has come back", the only way a period can be
 * logged while recovering — bleeding after a birth is logged as bleeding
 * on the day and must never become a period by accident.
 */

import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Radii, Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import type { Pregnancy } from '@/db/schema';
import { useTheme } from '@/providers/theme-provider';
import { daysBetween, parseISODate } from '@/utils/date';
import { POSTPARTUM_CONFIRM_DAYS } from '@/utils/pregnancy';

type Props = {
  pregnancy: Pregnancy;
  outcome: 'birth' | 'loss';
  todayISO: string;
  onSetBreastfeeding: (value: boolean) => void;
  /** Opens the day sheet with the "period started" switch allowed. */
  onPeriodBack: () => void;
};

export function RecoveryOverview({
  pregnancy,
  outcome,
  todayISO,
  onSetBreastfeeding,
  onPeriodBack,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  const daysSince = Math.max(
    0,
    daysBetween(parseISODate(pregnancy.endedOn ?? todayISO), parseISODate(todayISO)),
  );

  const handlePeriodBack = () => {
    if (outcome === 'birth' && daysSince < POSTPARTUM_CONFIRM_DAYS) {
      Alert.alert(t('pregnancy.period_back_early_title'), t('pregnancy.period_back_early_body'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('pregnancy.period_back_anyway'), onPress: onPeriodBack },
      ]);
      return;
    }
    onPeriodBack();
  };

  if (outcome === 'loss') {
    return (
      <View style={styles.wrap}>
        <Card style={styles.card}>
          <Text style={styles.lossCard}>{t('pregnancy.loss_card')}</Text>
          <Text style={styles.body}>{t('pregnancy.loss_body')}</Text>
        </Card>
        <Text style={styles.note}>{t('pregnancy.fertility_warning')}</Text>
        <Button
          label={t('pregnancy.period_back')}
          onPress={handlePeriodBack}
          variant="secondary"
          fullWidth
        />
      </View>
    );
  }

  const breastfeeding = pregnancy.breastfeeding;

  return (
    <View style={styles.wrap}>
      <Card style={styles.card}>
        <Text style={styles.title}>{t('pregnancy.recovery_title')}</Text>
        <Text style={styles.count}>
          {pregnancy.babyName
            ? t('pregnancy.since_named', { count: daysSince, name: pregnancy.babyName })
            : t('pregnancy.since_birth', { count: daysSince })}
        </Text>
        <Text style={styles.body}>{t('pregnancy.recovery_body')}</Text>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.warning}>{t('pregnancy.fertility_warning')}</Text>
        {breastfeeding === null ? (
          <View style={styles.questionRow}>
            <Text style={styles.body}>{t('pregnancy.breastfeeding_question')}</Text>
            <View style={styles.chips}>
              <Chip label={t('common.yes')} onPress={() => onSetBreastfeeding(true)} styles={styles} />
              <Chip label={t('common.no')} onPress={() => onSetBreastfeeding(false)} styles={styles} />
            </View>
          </View>
        ) : (
          <Text style={styles.body}>
            {t(breastfeeding ? 'pregnancy.return_breastfeeding' : 'pregnancy.return_not_breastfeeding')}
          </Text>
        )}
      </Card>

      <Button
        label={t('pregnancy.period_back')}
        onPress={handlePeriodBack}
        variant="secondary"
        fullWidth
      />
    </View>
  );
}

function Chip({
  label,
  onPress,
  styles,
}: {
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable onPress={onPress} style={styles.chip} accessibilityRole="button">
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      gap: Spacing.md,
    },
    card: {
      gap: Spacing.sm,
    },
    title: {
      fontSize: Typography.sizes.lg,
      fontWeight: Typography.weights.bold,
      color: colors.textPrimary,
    },
    count: {
      fontSize: Typography.sizes.md,
      color: colors.primary,
      fontWeight: Typography.weights.semibold,
    },
    body: {
      fontSize: Typography.sizes.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    lossCard: {
      fontSize: Typography.sizes.lg,
      color: colors.textPrimary,
    },
    warning: {
      fontSize: Typography.sizes.sm,
      fontWeight: Typography.weights.semibold,
      color: colors.textPrimary,
    },
    note: {
      fontSize: Typography.sizes.xs,
      color: colors.textMuted,
      textAlign: 'center',
    },
    questionRow: {
      gap: Spacing.sm,
    },
    chips: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    chip: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: Radii.full,
      backgroundColor: colors.surfaceAlt,
    },
    chipText: {
      fontSize: Typography.sizes.sm,
      fontWeight: Typography.weights.semibold,
      color: colors.textPrimary,
    },
  });

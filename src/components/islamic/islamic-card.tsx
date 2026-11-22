/**
 * IslamicCard — the Maliki reference beside her own counts. Says what
 * her logs show and what the school's reference limit is, and, past a
 * limit, says so neutrally. It never says what she may or must do.
 */

import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/providers/theme-provider';
import type { SchoolRules } from '@/utils/fiqh';
import type { IslamicStatus } from '@/utils/fiqh/bleeding';

type Props = {
  status: IslamicStatus;
  rules: SchoolRules;
  /** Without the card frame and title, for inside the day sheet. */
  compact?: boolean;
};

export function IslamicCard({ status, rules, compact = false }: Props) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (status.kind === 'none') return null;

  let count: string | null = null;
  let reference: string;
  let notes: string[] = [];

  switch (status.kind) {
    case 'bleeding':
      count = t('islamic.bleeding_day', { count: status.day });
      reference = t('islamic.ref_haid_max', { days: rules.haidMaxDays });
      notes = status.notes.map((n) =>
        n === 'short_purity'
          ? t('islamic.note_short_purity', { days: rules.purityMinDays })
          : t(`islamic.note_${n}`),
      );
      break;
    case 'purity':
      count = t('islamic.purity_days', { count: status.days });
      reference = t('islamic.ref_purity_min', { days: rules.purityMinDays });
      break;
    case 'nifas':
      count = t('islamic.since_birth', { count: status.daysSinceBirth });
      reference = t('islamic.ref_nifas', { days: rules.nifasMaxDays });
      notes = status.notes.map((n) => t(`islamic.note_${n}`));
      break;
    case 'pregnancy_bleeding':
      reference = t('islamic.ref_pregnancy', {
        limits: rules.pregnancyHaidMaxDays
          .map((l) => t('islamic.pregnancy_limit', { month: l.fromMonth, days: l.days }))
          .join(i18n.language === 'fr' ? ' ; ' : '; '),
      });
      break;
  }

  const body = (
    <View style={styles.body}>
      {compact ? null : <Text style={styles.title}>{t('islamic.card_title')}</Text>}
      {count ? <Text style={styles.count}>{count}</Text> : null}
      <Text style={styles.reference}>{reference}</Text>
      {notes.map((n) => (
        <Text key={n} style={styles.note}>
          {n}
        </Text>
      ))}
      {notes.length > 0 ? <Text style={styles.reference}>{t('islamic.ask')}</Text> : null}
      <Pressable onPress={() => router.push('/islamic/sources')} accessibilityRole="link" hitSlop={8}>
        <Text style={styles.link}>
          {t('islamic.sources_link')} › <Text style={styles.small}>{t('islamic.reference_only')}</Text>
        </Text>
      </Pressable>
    </View>
  );

  return compact ? body : <Card>{body}</Card>;
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    body: { gap: Spacing.xs },
    title: {
      fontSize: Typography.sizes.xs,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    count: { fontSize: Typography.sizes.md, fontWeight: Typography.weights.semibold, color: colors.textPrimary },
    reference: { fontSize: Typography.sizes.sm, color: colors.textSecondary, lineHeight: 20 },
    note: { fontSize: Typography.sizes.sm, color: colors.textPrimary, fontWeight: Typography.weights.semibold },
    link: { marginTop: Spacing.xs, fontSize: Typography.sizes.sm, color: colors.primary, fontWeight: Typography.weights.semibold },
    small: { fontSize: Typography.sizes.xs, color: colors.textMuted, fontWeight: Typography.weights.regular },
  });

/**
 * "Patterns": symptoms and moods that keep landing in the same part of
 * her cycle, each with the count behind it. Below the minimum it says how
 * much more logging is needed, rather than staying silent.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { HowLink } from '@/components/ui/how-link';
import { Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/providers/theme-provider';
import { MIN_CYCLES, patternSentence } from '@/utils/patterns';
import type { PatternResult } from '@/utils/patterns';

type Props = {
  result: PatternResult;
  labelOf: (key: string) => string;
};

export function PatternsCard({ result, labelOf }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Card style={styles.card}>
      <Text style={styles.label}>{t('patterns.title')}</Text>
      {result.status === 'found' ? (
        <View style={styles.list}>
          {result.patterns.map((p) => (
            <Text key={`${p.kind}:${p.key}`} style={styles.line}>
              {patternSentence(p, t, labelOf)}
            </Text>
          ))}
        </View>
      ) : result.status === 'none' ? (
        <Text style={styles.empty}>{t('patterns.none', { count: result.cycles })}</Text>
      ) : (
        <Text style={styles.empty}>
          {t('patterns.not_enough', { count: MIN_CYCLES - result.cycles })}
        </Text>
      )}
      <Text style={styles.note}>{t('patterns.note')}</Text>
      <HowLink section="patterns" align="left" />
    </Card>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: { gap: Spacing.sm },
    label: {
      fontSize: Typography.sizes.sm,
      fontWeight: Typography.weights.semibold,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    list: { gap: Spacing.sm },
    line: { fontSize: Typography.sizes.md, color: colors.textPrimary, lineHeight: 22 },
    empty: { fontSize: Typography.sizes.md, color: colors.textSecondary, lineHeight: 22 },
    note: { fontSize: Typography.sizes.xs, color: colors.textMuted },
  });

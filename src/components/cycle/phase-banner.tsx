/**
 * PhaseBanner — displays the current hormonal phase with a progress indicator.
 * Shown on the Home screen to give contextual cycle awareness.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Radii, Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/providers/theme-provider';
import type { PhaseInfo } from '@/utils/phase';
import { useTranslation } from 'react-i18next';

type Props = {
  phaseInfo: PhaseInfo;
};

export function PhaseBanner({ phaseInfo }: Props) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const { t } = useTranslation();

  const progress = Math.min(phaseInfo.dayInPhase / Math.max(phaseInfo.totalPhaseDays, 1), 1);
  const phaseName = t(`phase.${phaseInfo.phase}`);
  const tip = t(`phase.${phaseInfo.phase}_tip`);

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.emoji}>{phaseInfo.emoji}</Text>
        <View style={styles.textBlock}>
          <Text style={styles.phaseName}>{phaseName}</Text>
          <Text style={styles.dayLabel}>
            {t('phase.day_of', { day: phaseInfo.dayInCycle })}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <Text style={styles.tip}>{tip}</Text>
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
    gap: Spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  emoji: {
    fontSize: 32,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  phaseName: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: colors.textPrimary,
  },
  dayLabel: {
    fontSize: Typography.sizes.sm,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
    marginTop: Spacing.xs,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  tip: {
    fontSize: Typography.sizes.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: Spacing.xs,
  },
});

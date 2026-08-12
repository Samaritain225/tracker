/**
 * PhaseBanner — displays the current hormonal phase with a progress indicator.
 * Shown on the Home screen to give contextual cycle awareness.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radii, Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/providers/theme-provider';
import type { PhaseInfo } from '@/utils/phase';
import type { OngoingPeriod } from '@/hooks/use-cycle-calc';
import { useTranslation } from 'react-i18next';

type Props = {
  phaseInfo: PhaseInfo;
  ongoingPeriod?: OngoingPeriod | null;
  /** Invoked when the user confirms their period has stopped, from the
   * prompt shown once bleeding runs past their typical duration. */
  onConfirmPeriodEnded?: () => void;
};

export function PhaseBanner({ phaseInfo, ongoingPeriod, onConfirmPeriodEnded }: Props) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const { t } = useTranslation();

  const progress = Math.min(phaseInfo.dayInPhase / Math.max(phaseInfo.totalPhaseDays, 1), 1);
  const phaseName = t(`phase.${phaseInfo.phase}`);
  const tip = phaseInfo.isLate ? t('phase.late_tip') : t(`phase.${phaseInfo.phase}_tip`);

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.emoji}>{phaseInfo.isLate ? '⏰' : phaseInfo.emoji}</Text>
        <View style={styles.textBlock}>
          <Text style={styles.phaseName}>{phaseName}</Text>
          <Text style={styles.dayLabel}>
            {ongoingPeriod
              ? t('phase.period_day_of', { day: ongoingPeriod.dayOfPeriod })
              : t('phase.day_of', { day: phaseInfo.dayInCycle })}
          </Text>
          {phaseInfo.isLate && (
            <Text style={styles.lateLabel}>
              {t('phase.days_late', { count: phaseInfo.daysLate })}
            </Text>
          )}
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <Text style={styles.tip}>{tip}</Text>

      {/* Asked once bleeding passes the user's typical duration — the
          point at which the answer starts to matter, medically and for
          the duration-sensitive rules built on top of it. */}
      {ongoingPeriod?.exceedsTypical && onConfirmPeriodEnded ? (
        <View style={styles.confirmRow}>
          <Text style={styles.confirmQuestion}>{t('phase.period_ended_question')}</Text>
          <Pressable
            onPress={onConfirmPeriodEnded}
            style={styles.confirmButton}
            accessibilityRole="button"
          >
            <Text style={styles.confirmButtonText}>{t('phase.period_ended_yes')}</Text>
          </Pressable>
        </View>
      ) : null}
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
  lateLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    color: colors.danger,
    marginTop: 2,
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
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginTop: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  confirmQuestion: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: colors.textSecondary,
  },
  confirmButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.full,
    backgroundColor: colors.primary,
  },
  confirmButtonText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    color: colors.primaryText,
  },
});

/**
 * LoadingScreen — centred spinner with optional message, for screens
 * waiting on their own data. App launch uses LaunchSplash instead.
 */

import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/providers/theme-provider';

type Props = {
  message?: string;
};

export function LoadingScreen({ message }: Props) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    gap: Spacing.lg,
    padding: Spacing.xl,
  },
  message: {
    fontSize: Typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

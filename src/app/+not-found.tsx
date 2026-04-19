/**
 * 404 — Not found screen.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';

import { Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/providers/theme-provider';

export default function NotFoundScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>404</Text>
      <Text style={styles.subtitle}>Page not found</Text>
      <Link href="/" style={styles.link}>
        Go home
      </Link>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    gap: Spacing.md,
  },
  title: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: Typography.sizes.md,
    color: colors.textSecondary,
  },
  link: {
    fontSize: Typography.sizes.md,
    color: colors.primary,
    fontWeight: Typography.weights.semibold,
    marginTop: Spacing.lg,
  },
});

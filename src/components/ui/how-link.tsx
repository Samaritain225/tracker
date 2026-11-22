/**
 * A small link to the matching part of "How Lumi works it out", placed
 * next to a number the app calculated.
 */

import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/providers/theme-provider';
import type { SectionId } from '@/utils/explain';

export function HowLink({ section, align = 'center' }: { section: SectionId; align?: 'center' | 'left' }) {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/how-it-works', params: { section } })}
      accessibilityRole="link"
      hitSlop={8}
      style={styles.link}
    >
      <Text style={[styles.text, { color: colors.primary, textAlign: align }]}>{t('how.link')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { paddingVertical: Spacing.xs },
  text: { fontSize: Typography.sizes.sm, fontWeight: Typography.weights.medium },
});

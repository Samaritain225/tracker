/**
 * "About this information": where the weekly notes come from, and what
 * they are not. Reached from the "This week" card on Home.
 */

import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/providers/theme-provider';

const SOURCES = [
  { key: 'source_nhs', url: 'https://www.nhs.uk/best-start-in-life/pregnancy/week-by-week-guide-to-pregnancy/' },
  { key: 'source_nhs_scans', url: 'https://www.nhs.uk/conditions/pregnancy-and-baby/ultrasound-anomaly-baby-scans-pregnant/' },
  { key: 'source_sp', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F963' },
];

export default function SourcesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xxl },
        ]}
      >
        <Text style={styles.title}>{t('pregnancy.sources_title')}</Text>
        <Text style={styles.body}>{t('pregnancy.sources_intro')}</Text>
        <Card>
          <Text style={styles.important}>{t('pregnancy.sources_review')}</Text>
        </Card>
        <Text style={styles.body}>{t('pregnancy.sources_counting')}</Text>

        <View style={styles.list}>
          {SOURCES.map((s) => (
            <Pressable key={s.key} onPress={() => Linking.openURL(s.url)} accessibilityRole="link">
              <Text style={styles.source}>{t(`pregnancy.${s.key}`)}</Text>
              <Text style={styles.url}>{s.url}</Text>
            </Pressable>
          ))}
        </View>

        <Button label={t('common.close')} onPress={() => router.back()} variant="ghost" fullWidth />
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: Spacing.lg, gap: Spacing.lg },
    title: {
      fontSize: Typography.sizes.xxl,
      fontWeight: Typography.weights.bold,
      color: colors.textPrimary,
    },
    body: { fontSize: Typography.sizes.md, color: colors.textSecondary, lineHeight: 22 },
    important: { fontSize: Typography.sizes.md, color: colors.textPrimary, lineHeight: 22 },
    list: { gap: Spacing.md },
    source: { fontSize: Typography.sizes.md, color: colors.primary, fontWeight: Typography.weights.semibold },
    url: { fontSize: Typography.sizes.xs, color: colors.textMuted },
  });

/**
 * "About the Maliki reference": the book every reference line comes
 * from, section by section, and what the references are not.
 *
 * The book is cited by title, translator and section with no link: both
 * translations are under copyright, and the online copies may not be
 * authorised.
 */

import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/providers/theme-provider';
import { rulesFor } from '@/utils/fiqh';
import type { ReferenceTopic } from '@/utils/fiqh';
import { MALIKI } from '@/utils/fiqh/maliki';

export default function IslamicSourcesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { settings } = useSettings();
  // Shown for the school in force, or the Maliki references when the
  // screen is opened while the option is off.
  const rules = rulesFor(settings?.school) ?? MALIKI;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xxl },
        ]}
      >
        <Text style={styles.title}>{t('islamic.sources_title')}</Text>
        <Text style={styles.body}>{t('islamic.sources_intro')}</Text>
        <Card>
          <Text style={styles.important}>{t('islamic.sources_warning')}</Text>
        </Card>
        <View style={styles.list}>
          {(Object.keys(rules.citations) as ReferenceTopic[]).map((topic) => (
            <View key={topic} style={styles.item}>
              <Text style={styles.topic}>{t(`islamic.${rules.id}.topic_${topic}`)}</Text>
              <Text style={styles.section}>{t('islamic.section_ref', { section: rules.citations[topic] })}</Text>
            </View>
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
    title: { fontSize: Typography.sizes.xxl, fontWeight: Typography.weights.bold, color: colors.textPrimary },
    body: { fontSize: Typography.sizes.md, color: colors.textSecondary, lineHeight: 22 },
    important: { fontSize: Typography.sizes.md, color: colors.textPrimary, lineHeight: 22 },
    list: { gap: Spacing.md },
    item: { gap: 2 },
    topic: { fontSize: Typography.sizes.md, color: colors.textPrimary },
    section: { fontSize: Typography.sizes.xs, color: colors.textMuted },
  });

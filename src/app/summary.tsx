/**
 * "Summary for a doctor": a preview of exactly what the PDF holds, and a
 * button to share it. Nothing leaves the phone until she presses Share.
 */

import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LoadingScreen } from '@/components/ui/loading-screen';
import { DEFAULT_PERIOD_DURATION_DAYS } from '@/constants/cycle';
import { Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useCustomSymptoms } from '@/hooks/use-custom-symptoms';
import { useDailyLogs } from '@/hooks/use-daily-logs';
import { usePeriods } from '@/hooks/use-periods';
import { usePregnancies } from '@/hooks/use-pregnancies';
import { usePregnancyVisits } from '@/hooks/use-pregnancy-visits';
import { useSettings } from '@/hooks/use-settings';
import { useToday } from '@/hooks/use-today';
import { useTheme } from '@/providers/theme-provider';
import { sharePdf } from '@/services/user-data';
import { formatDisplayDate, parseISODate } from '@/utils/date';
import { buildDoctorSummary, summaryHtml, summarySections } from '@/utils/summary';
import type { SummarySection } from '@/utils/summary';

export default function SummaryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { periods, isLoading: periodsLoading } = usePeriods();
  const { logs, isLoading: logsLoading } = useDailyLogs();
  const { pregnancies } = usePregnancies();
  const { visits } = usePregnancyVisits();
  const { settings } = useSettings();
  const { labelOf } = useCustomSymptoms();
  const todayISO = useToday();
  const [sharing, setSharing] = useState(false);

  const language = (settings?.language as 'en' | 'fr') ?? 'fr';
  // Always Gregorian: a doctor reads Gregorian dates, whatever calendar
  // the app shows her.
  const formatDate = useCallback(
    (iso: string) => formatDisplayDate(parseISODate(iso), language, 'gregorian'),
    [language],
  );

  const sections = useMemo(() => {
    const summary = buildDoctorSummary({
      periods,
      logs,
      pregnancies,
      visits,
      defaultDurationDays: settings?.periodDurationDays ?? DEFAULT_PERIOD_DURATION_DAYS,
      todayISO,
    });
    return summarySections(summary, t, labelOf, formatDate);
  }, [periods, logs, pregnancies, visits, settings?.periodDurationDays, todayISO, t, labelOf, formatDate]);

  const title = t('summary.doc_title');
  const subtitle = t('summary.made_on', { date: formatDate(todayISO) });
  const footer = t('summary.footer');

  const handleShare = useCallback(async () => {
    setSharing(true);
    try {
      const html = summaryHtml(title, subtitle, sections, footer);
      const outcome = await sharePdf(`lumi-summary-${todayISO}.pdf`, html, t('summary.share'));
      if (outcome === 'unavailable') {
        Alert.alert(t('settings.error_title'), t('settings.share_unavailable'));
      }
    } catch (e) {
      console.error(e);
      Alert.alert(t('settings.error_title'), t('settings.file_error'));
    } finally {
      setSharing(false);
    }
  }, [title, subtitle, sections, footer, todayISO, t]);

  if (periodsLoading || logsLoading) return <LoadingScreen />;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xxl },
        ]}
      >
        <Text style={styles.title}>{t('summary.title')}</Text>
        <Text style={styles.body}>{t('summary.intro')}</Text>

        <Button
          label={t('summary.share')}
          icon="share-outline"
          onPress={handleShare}
          loading={sharing}
          disabled={sharing}
          fullWidth
        />

        <Card style={styles.paper}>
          <Text style={styles.docTitle}>{title}</Text>
          <Text style={styles.docSubtitle}>{subtitle}</Text>
          {sections.map((section) => (
            <SectionView key={section.title} section={section} styles={styles} />
          ))}
          <Text style={styles.footer}>{footer}</Text>
        </Card>

        <Button label={t('common.close')} onPress={() => router.back()} variant="ghost" fullWidth />
      </ScrollView>
    </View>
  );
}

function SectionView({ section, styles }: { section: SummarySection; styles: Styles }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      {section.rows?.map((row, i) => (
        <View key={`r${i}`} style={styles.row}>
          <Text style={styles.rowLabel}>{row.label}</Text>
          <Text style={styles.rowValue}>{row.value}</Text>
        </View>
      ))}
      {section.table && (
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHead]}>
            {section.table.head.map((h) => (
              <Text key={h} style={[styles.cell, styles.headCell]}>
                {h}
              </Text>
            ))}
          </View>
          {section.table.rows.map((row, i) => (
            <View key={`t${i}`} style={styles.tableRow}>
              {row.map((cell, j) => (
                <Text key={j} style={styles.cell}>
                  {cell}
                </Text>
              ))}
            </View>
          ))}
        </View>
      )}
      {section.lines?.map((line, i) => (
        <Text key={`l${i}`} style={styles.line}>
          • {line}
        </Text>
      ))}
    </View>
  );
}

type Styles = ReturnType<typeof makeStyles>;

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: Spacing.lg, gap: Spacing.lg },
    title: { fontSize: Typography.sizes.xxl, fontWeight: Typography.weights.bold, color: colors.textPrimary },
    body: { fontSize: Typography.sizes.md, color: colors.textSecondary, lineHeight: 22 },
    paper: { gap: Spacing.md },
    docTitle: { fontSize: Typography.sizes.lg, fontWeight: Typography.weights.bold, color: colors.textPrimary },
    docSubtitle: { fontSize: Typography.sizes.sm, color: colors.textSecondary, marginTop: -Spacing.sm },
    section: { gap: Spacing.xs },
    sectionTitle: {
      fontSize: Typography.sizes.sm,
      fontWeight: Typography.weights.semibold,
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    row: { flexDirection: 'row', gap: Spacing.md },
    rowLabel: { flex: 1, fontSize: Typography.sizes.sm, color: colors.textSecondary },
    rowValue: { flex: 1, fontSize: Typography.sizes.sm, color: colors.textPrimary },
    table: { marginTop: Spacing.xs },
    tableRow: {
      flexDirection: 'row',
      paddingVertical: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    tableHead: { borderBottomColor: colors.borderStrong },
    cell: { flex: 1, fontSize: Typography.sizes.sm, color: colors.textPrimary, paddingRight: Spacing.xs },
    headCell: { color: colors.textSecondary, fontWeight: Typography.weights.semibold },
    line: { fontSize: Typography.sizes.sm, color: colors.textPrimary, lineHeight: 20 },
    footer: { fontSize: Typography.sizes.xs, color: colors.textMuted, marginTop: Spacing.sm },
  });

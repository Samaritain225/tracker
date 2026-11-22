/**
 * Pregnancy setup — starting a pregnancy, or changing its dates.
 *
 * Asks for the first day of the last period, prefilled with the latest
 * logged period start, and optionally a due date from a scan. Shows the
 * resulting due date and week before anything is saved.
 *
 * Opened with `?edit=1` from Settings to change the dates of the
 * pregnancy in progress.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { DateField } from '@/components/pregnancy/date-field';
import { LoadingScreen } from '@/components/ui/loading-screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { usePeriods } from '@/hooks/use-periods';
import { usePregnancies } from '@/hooks/use-pregnancies';
import { useSettings } from '@/hooks/use-settings';
import { useToday } from '@/hooks/use-today';
import { useTheme } from '@/providers/theme-provider';
import { addDays, daysBetween, formatDisplayDate, parseISODate, toISODate } from '@/utils/date';
import {
  calculatedDueDate,
  effectiveDueDate,
  findActivePregnancy,
  gestationalAge,
} from '@/utils/pregnancy';
import { formatAge } from '@/components/pregnancy/format-age';

/** How far a scan due date may sit from the one worked out from the
 * last period before the two are treated as contradicting each other. */
const SCAN_TOLERANCE_DAYS = 30;

export default function PregnancySetupScreen() {
  const { periods, isLoading: periodsLoading } = usePeriods();
  const { pregnancies, isLoading: pregnanciesLoading } = usePregnancies();

  // The form's starting dates come from this data, so it waits for both
  // queries: mounted earlier, it prefilled "28 days ago" instead of the
  // latest logged period, because the period list was still empty.
  if (periodsLoading || pregnanciesLoading) {
    return <LoadingScreen />;
  }

  const latestPeriod = periods.length > 0 ? periods[periods.length - 1].startDate : null;
  return <PregnancySetupForm latestPeriod={latestPeriod} />;
}

function PregnancySetupForm({ latestPeriod }: { latestPeriod: string | null }) {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const isEdit = edit === '1';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const todayISO = useToday();
  const { settings } = useSettings();
  const { pregnancies, startPregnancy, updatePregnancyDates } = usePregnancies();

  const language = (settings?.language as 'en' | 'fr') ?? 'fr';
  const calendarType = (settings?.calendarType as 'gregorian' | 'hijri') ?? 'gregorian';
  const active = isEdit ? findActivePregnancy(pregnancies) : null;

  const [lastPeriodDate, setLastPeriodDate] = useState(
    () =>
      active?.lastPeriodDate ??
      latestPeriod ??
      toISODate(addDays(parseISODate(todayISO), -28)),
  );
  const [scanDueDate, setScanDueDate] = useState<string | null>(() => active?.scanDueDate ?? null);
  const [editing, setEditing] = useState<'last_period' | 'scan'>('last_period');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const draft = { lastPeriodDate, scanDueDate };
  const dueISO = effectiveDueDate(draft);
  const age = gestationalAge(draft, todayISO);

  const error =
    lastPeriodDate > todayISO
      ? t('pregnancy.error_future')
      : scanDueDate &&
          Math.abs(daysBetween(parseISODate(calculatedDueDate(lastPeriodDate)), parseISODate(scanDueDate))) >
            SCAN_TOLERANCE_DAYS
        ? t('pregnancy.error_scan_range')
        : null;

  const handleSave = async () => {
    setSaving(true);
    setFailed(false);
    const ok = active
      ? await updatePregnancyDates(active.id, draft, todayISO)
      : (await startPregnancy({ ...draft, todayISO })) !== null;
    setSaving(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    router.back();
  };

  const toggleScan = () => {
    if (scanDueDate) {
      setScanDueDate(null);
      setEditing('last_period');
    } else {
      setScanDueDate(calculatedDueDate(lastPeriodDate));
      setEditing('scan');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xxl },
        ]}
      >
        <Text style={styles.title}>{t('pregnancy.title')}</Text>

        {scanDueDate ? (
          <SegmentedControl
            options={[
              { label: t('pregnancy.setup_editing_last_period'), value: 'last_period' as const },
              { label: t('pregnancy.setup_editing_scan'), value: 'scan' as const },
            ]}
            value={editing}
            onChange={setEditing}
          />
        ) : null}

        <Card>
          {editing === 'scan' && scanDueDate ? (
            <DateField
              key="scan"
              label={t('pregnancy.setup_scan')}
              valueISO={scanDueDate}
              onChange={setScanDueDate}
              todayISO={todayISO}
              language={language}
              calendarType={calendarType}
            />
          ) : (
            <DateField
              key="last_period"
              label={t('pregnancy.setup_last_period')}
              valueISO={lastPeriodDate}
              onChange={setLastPeriodDate}
              todayISO={todayISO}
              language={language}
              calendarType={calendarType}
            />
          )}
        </Card>

        <Button
          label={scanDueDate ? t('pregnancy.setup_scan_remove') : t('pregnancy.setup_scan_add')}
          onPress={toggleScan}
          variant="ghost"
          fullWidth
        />

        <Text style={error ? styles.error : styles.result}>
          {error ??
            t('pregnancy.setup_result', {
              date: formatDisplayDate(parseISODate(dueISO), language, calendarType),
              age: formatAge(t, age),
            })}
        </Text>
        {failed ? <Text style={styles.error}>{t('pregnancy.error_save')}</Text> : null}

        <Button
          label={active ? t('pregnancy.setup_save') : t('pregnancy.setup_confirm')}
          onPress={handleSave}
          loading={saving}
          disabled={error !== null || saving}
          fullWidth
        />
        <Button label={t('common.cancel')} onPress={() => router.back()} variant="ghost" fullWidth />
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: Spacing.lg,
      gap: Spacing.lg,
    },
    title: {
      fontSize: Typography.sizes.xxl,
      fontWeight: Typography.weights.bold,
      color: colors.textPrimary,
    },
    result: {
      fontSize: Typography.sizes.md,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    error: {
      fontSize: Typography.sizes.sm,
      color: colors.danger,
      textAlign: 'center',
    },
  });

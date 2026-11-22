/**
 * Settings screen — language, calendar type, cycle defaults, about.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';

import { Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/providers/theme-provider';
import {
  MAX_CYCLE_DAYS,
  MAX_PERIOD_DURATION_DAYS,
  MIN_CYCLE_DAYS,
  MIN_PERIOD_DURATION_DAYS,
} from '@/constants/cycle';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Divider } from '@/components/ui/divider';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useSettings } from '@/hooks/use-settings';
import { usePeriods } from '@/hooks/use-periods';
import { useDailyLogs } from '@/hooks/use-daily-logs';
import { usePregnancies } from '@/hooks/use-pregnancies';
import { usePregnancyVisits } from '@/hooks/use-pregnancy-visits';
import { resolveMode } from '@/utils/pregnancy';
import { useRouter } from 'expo-router';
import { requestNotificationPermissions } from '@/services/notifications';
import {
  applyRestorePlan,
  deleteAllData,
  pickBackupFile,
  readAllData,
  shareBackup,
  shareTextFile,
} from '@/services/user-data';
import { parseBackup, planRestore, summarizeBackup } from '@/utils/backup';
import { buildCsv } from '@/utils/csv';
import { formatDisplayDate, parseISODate, toISODate } from '@/utils/date';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const {
    settings,
    updateLanguage,
    updateCalendarType,
    updateFallbackCycle,
    updatePeriodDuration,
    updateTheme,
    updateAppLock,
    updateReminders,
    updateShowStarSign,
  } = useSettings();
  const router = useRouter();
  const { pregnancies, removePregnancy } = usePregnancies();
  const { visits } = usePregnancyVisits();
  const { colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const { periods } = usePeriods();
  const { logs } = useDailyLogs();
  const [busy, setBusy] = useState<'backup' | 'restore' | 'csv' | null>(null);

  const [localCycleDays, setLocalCycleDays] = useState(
    settings?.fallbackCycleDays ?? 28,
  );
  const [localPeriodDays, setLocalPeriodDays] = useState(
    settings?.periodDurationDays ?? 5,
  );

  // Sync local slider state when DB settings load or change externally
  useEffect(() => {
    if (settings) {
      setLocalCycleDays(settings.fallbackCycleDays);
      setLocalPeriodDays(settings.periodDurationDays);
    }
  }, [settings?.fallbackCycleDays, settings?.periodDurationDays]);

  const handleCycleComplete = useCallback(
    (value: number) => {
      const rounded = Math.round(value);
      setLocalCycleDays(rounded);
      updateFallbackCycle(rounded);
    },
    [updateFallbackCycle],
  );

  const handlePeriodComplete = useCallback(
    (value: number) => {
      const rounded = Math.round(value);
      setLocalPeriodDays(rounded);
      updatePeriodDuration(rounded);
    },
    [updatePeriodDuration],
  );

  const mode = resolveMode(pregnancies, periods.map((p) => p.startDate).sort());
  const activePregnancy = mode.kind === 'pregnant' ? mode.pregnancy : null;
  // Only a pregnancy with nothing recorded against it yet can be removed
  // as a mistake; once visits exist it has clearly happened, and ending
  // it goes through "The pregnancy has ended".
  const canRemovePregnancy =
    activePregnancy !== null && !visits.some((v) => v.pregnancyId === activePregnancy.id);

  const handleRemovePregnancy = useCallback(() => {
    if (!activePregnancy) return;
    Alert.alert(t('pregnancy.remove_confirm_title'), t('pregnancy.remove_confirm_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('pregnancy.remove_confirm'),
        style: 'destructive',
        onPress: () => {
          removePregnancy(activePregnancy.id);
        },
      },
    ]);
  }, [activePregnancy, removePregnancy, t]);

  const locale = (settings?.language as 'fr' | 'en') ?? 'fr';
  const calendarType = (settings?.calendarType as 'gregorian' | 'hijri') ?? 'gregorian';

  /** "3 periods and 40 logged days", in the user's language. */
  const describeCounts = useCallback(
    (periodCount: number, dayCount: number) => ({
      periods: t('settings.periods_count', { count: periodCount }),
      days: t('settings.days_count', { count: dayCount }),
    }),
    [t],
  );

  const shareFile = useCallback(
    async (fileName: string, contents: string, mimeType: string, title: string) => {
      try {
        const outcome = await shareTextFile(fileName, contents, mimeType, title);
        if (outcome === 'unavailable') {
          Alert.alert(t('settings.error_title'), t('settings.share_unavailable'));
        }
      } catch (e) {
        console.error(e);
        Alert.alert(t('settings.error_title'), t('settings.file_error'));
      }
    },
    [t],
  );

  const handleBackup = useCallback(async () => {
    setBusy('backup');
    try {
      const outcome = await shareBackup(new Date(), t('settings.backup'));
      if (outcome === 'unavailable') {
        Alert.alert(t('settings.error_title'), t('settings.share_unavailable'));
      }
    } catch (e) {
      console.error(e);
      Alert.alert(t('settings.error_title'), t('settings.file_error'));
    } finally {
      setBusy(null);
    }
  }, [t]);

  const handleExportCsv = useCallback(async () => {
    setBusy('csv');
    await shareFile(
      `lumi-export-${toISODate(new Date())}.csv`,
      buildCsv(periods, logs),
      'text/csv',
      t('settings.export_csv'),
    );
    setBusy(null);
  }, [periods, logs, shareFile, t]);

  const handleRestore = useCallback(async () => {
    setBusy('restore');
    let picked: Awaited<ReturnType<typeof pickBackupFile>>;
    try {
      picked = await pickBackupFile();
    } catch (e) {
      console.error(e);
      setBusy(null);
      Alert.alert(t('settings.error_title'), t('settings.restore_error_invalid'));
      return;
    }
    setBusy(null);
    if (picked === null) return;
    if (!picked.ok) {
      Alert.alert(t('settings.restore'), t('settings.restore_error_invalid'));
      return;
    }
    const photos = picked.photos;

    const parsed = parseBackup(picked.json);
    if (!parsed.ok) {
      Alert.alert(t('settings.restore'), t(`settings.restore_error_${parsed.error}`));
      return;
    }

    // Planned against what is in the database right now, not what this
    // screen last rendered.
    const existing = readAllData();
    const summary = summarizeBackup(parsed.backup);
    const plan = planRestore(existing, parsed.backup);

    const contents = [
      summary.firstDate && summary.lastDate
        ? t('settings.restore_contents', {
            ...describeCounts(summary.periodCount, summary.logCount),
            from: formatDisplayDate(parseISODate(summary.firstDate), locale, calendarType),
            to: formatDisplayDate(parseISODate(summary.lastDate), locale, calendarType),
          })
        : t('settings.restore_contents_empty'),
      summary.pregnancyCount > 0
        ? t('settings.restore_pregnancies', { count: summary.pregnancyCount })
        : null,
    ]
      .filter(Boolean)
      .join(' ');

    const nothingToAdd =
      plan.periodsToAdd.length === 0 &&
      plan.logsToAdd.length === 0 &&
      plan.pregnanciesToAdd.length === 0 &&
      !plan.settingsToApply;
    if (nothingToAdd) {
      Alert.alert(t('settings.restore'), `${contents}\n\n${t('settings.restore_nothing')}`);
      return;
    }

    const kept = plan.skippedPeriods + plan.skippedLogs + plan.skippedPregnancies;
    const details = [
      contents,
      t('settings.restore_adds', describeCounts(plan.periodsToAdd.length, plan.logsToAdd.length)),
      plan.pregnanciesToAdd.length > 0
        ? t('settings.restore_adds_pregnancies', { count: plan.pregnanciesToAdd.length })
        : null,
      kept > 0 ? t('settings.restore_kept', { count: kept }) : null,
      plan.settingsToApply ? t('settings.restore_settings') : null,
    ]
      .filter(Boolean)
      .join('\n\n');

    Alert.alert(t('settings.restore_title'), details, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.restore_confirm'),
        onPress: async () => {
          try {
            const { missingPhotos } = await applyRestorePlan(plan, photos);
            Alert.alert(
              t('settings.restore'),
              missingPhotos > 0
                ? `${t('settings.restore_done')} ${t('settings.restore_missing_photos', { count: missingPhotos })}`
                : t('settings.restore_done'),
            );
          } catch (e) {
            console.error(e);
            Alert.alert(t('settings.error_title'), t('settings.restore_error_failed'));
          }
        },
      },
    ]);
  }, [locale, calendarType, describeCounts, t]);

  const handleDeleteAll = useCallback(() => {
    Alert.alert(
      t('settings.delete_confirm_title'),
      t('settings.delete_confirm_body', describeCounts(periods.length, logs.length)),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('settings.delete_backup_first'), onPress: handleBackup },
        {
          text: t('settings.delete_confirm'),
          style: 'destructive',
          onPress: () => {
            try {
              deleteAllData();
              Alert.alert(t('settings.delete_title'), t('settings.delete_done'));
            } catch (e) {
              console.error(e);
              Alert.alert(t('settings.error_title'), t('settings.delete_failed'));
            }
          },
        },
      ],
    );
  }, [periods.length, logs.length, describeCounts, handleBackup, t]);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <View style={styles.container}>
      <View style={{ height: insets.top, backgroundColor: colors.background }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Spacing.lg, paddingBottom: insets.bottom + Spacing.xxl },
        ]}
      >
      <Text style={styles.screenTitle}>{t('settings.title')}</Text>

      <Card>
        <Text style={styles.sectionLabel}>{t('settings.language')}</Text>
        <SegmentedControl
          options={[
            { label: 'Français', value: 'fr' as const },
            { label: 'English', value: 'en' as const },
          ]}
          value={(settings?.language as 'fr' | 'en') ?? 'fr'}
          onChange={updateLanguage}
        />
      </Card>

      <Divider />

      {/* Appearance */}
      <Card>
        <Text style={styles.sectionLabel}>{t('settings.theme_title')}</Text>
        <SegmentedControl
          options={[
            { label: t('settings.theme_system'), value: 'system' as const },
            { label: t('settings.theme_light'), value: 'light' as const },
            { label: t('settings.theme_dark'), value: 'dark' as const },
          ]}
          value={(settings?.theme as 'system' | 'light' | 'dark') ?? 'system'}
          onChange={updateTheme}
        />
      </Card>

      <Divider />

      {/* Calendar type */}
      <Card>
        <Text style={styles.sectionLabel}>{t('settings.calendar_type')}</Text>
        <SegmentedControl
          options={[
            { label: t('settings.calendar_gregorian'), value: 'gregorian' as const },
            { label: t('settings.calendar_hijri'), value: 'hijri' as const },
          ]}
          value={(settings?.calendarType as 'gregorian' | 'hijri') ?? 'gregorian'}
          onChange={updateCalendarType}
        />
      </Card>

      <Divider />

      {/* Cycle defaults */}
      <Card style={styles.sliderCard}>
        <Text style={styles.sectionLabel}>{t('settings.cycle_defaults')}</Text>

        <View style={styles.sliderRow}>
          <Text style={styles.sliderLabel}>{t('settings.fallback_cycle')}</Text>
          <Text style={styles.sliderValue}>
            {t('settings.days', { count: localCycleDays })}
          </Text>
        </View>
        <Slider
          minimumValue={MIN_CYCLE_DAYS}
          maximumValue={MAX_CYCLE_DAYS}
          step={1}
          value={localCycleDays}
          onValueChange={setLocalCycleDays}
          onSlidingComplete={handleCycleComplete}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.primary}
          accessibilityLabel={t('settings.fallback_cycle')}
        />
        <Text style={styles.sliderNote}>{t('settings.fallback_note')}</Text>

        <View style={styles.sliderSpacer} />

        <View style={styles.sliderRow}>
          <Text style={styles.sliderLabel}>{t('settings.period_duration')}</Text>
          <Text style={styles.sliderValue}>
            {t('settings.days', { count: localPeriodDays })}
          </Text>
        </View>
        <Slider
          minimumValue={MIN_PERIOD_DURATION_DAYS}
          maximumValue={MAX_PERIOD_DURATION_DAYS}
          step={1}
          value={localPeriodDays}
          onValueChange={setLocalPeriodDays}
          onSlidingComplete={handlePeriodComplete}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.primary}
          accessibilityLabel={t('settings.period_duration')}
        />
      </Card>

      {/* Pregnancy */}
      <Card style={styles.buttonStack}>
        <Text style={styles.sectionLabel}>{t('pregnancy.settings_section')}</Text>
        {activePregnancy ? (
          <>
            <Button
              label={t('pregnancy.settings_edit_dates')}
              icon="calendar-outline"
              onPress={() => router.push('/pregnancy/setup?edit=1')}
              variant="secondary"
              fullWidth
            />
            <View style={styles.sliderRow}>
              <Text style={styles.sliderLabel}>{t('pregnancy.settings_star')}</Text>
              <Switch
                value={settings?.showStarSign !== 0}
                onValueChange={updateShowStarSign}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor={colors.surface}
              />
            </View>
            <Button
              label={t('pregnancy.settings_end')}
              onPress={() => router.push('/pregnancy/end')}
              variant="secondary"
              fullWidth
            />
            {canRemovePregnancy ? (
              <>
                <Button
                  label={t('pregnancy.settings_remove')}
                  onPress={handleRemovePregnancy}
                  variant="ghost"
                  fullWidth
                />
                <Text style={styles.sliderNote}>{t('pregnancy.settings_remove_note')}</Text>
              </>
            ) : null}
          </>
        ) : (
          <Button
            label={t('pregnancy.settings_start')}
            icon="heart-outline"
            onPress={() => router.push('/pregnancy/setup')}
            variant="secondary"
            fullWidth
          />
        )}
      </Card>

      <Divider />

      {/* Your data */}
      <Card style={styles.buttonStack}>
        <Text style={styles.sectionLabel}>{t('settings.data_title')}</Text>
        <Button
          label={t('settings.backup')}
          icon="cloud-upload-outline"
          onPress={handleBackup}
          loading={busy === 'backup'}
          disabled={busy !== null}
          variant="secondary"
          fullWidth
        />
        <Text style={styles.sliderNote}>{t('settings.backup_note')}</Text>
        <Button
          label={t('settings.restore')}
          icon="cloud-download-outline"
          onPress={handleRestore}
          loading={busy === 'restore'}
          disabled={busy !== null}
          variant="secondary"
          fullWidth
        />
        <Button
          label={t('settings.export_csv')}
          icon="document-text-outline"
          onPress={handleExportCsv}
          loading={busy === 'csv'}
          disabled={busy !== null}
          variant="ghost"
          fullWidth
        />
        <Text style={styles.sliderNote}>{t('settings.export_csv_note')}</Text>
      </Card>

      <Divider />

      {/* Security */}
      <Card>
        <Text style={styles.sectionLabel}>{t('settings.security_title')}</Text>
        <View style={styles.sliderRow}>
          <Text style={styles.sliderLabel}>{t('settings.app_lock')}</Text>
          <Switch
            value={!!settings?.appLockEnabled}
            onValueChange={async (value) => {
              if (value) {
                const hasHardware = await LocalAuthentication.hasHardwareAsync();
                const isEnrolled = await LocalAuthentication.isEnrolledAsync();
                if (!hasHardware || !isEnrolled) {
                  Alert.alert(
                    t('settings.app_lock'),
                    t('settings.biometric_unavailable'),
                  );
                  return;
                }
              }
              updateAppLock(value);
            }}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={colors.surface}
          />
        </View>
        <Text style={styles.sliderNote}>{t('settings.app_lock_note')}</Text>
      </Card>

      <Divider />

      {/* Notifications */}
      <Card>
        <Text style={styles.sectionLabel}>{t('settings.notifications_title')}</Text>
        <View style={styles.sliderRow}>
          <Text style={styles.sliderLabel}>{t('settings.reminders')}</Text>
          <Switch
            value={!!settings?.remindersEnabled}
            onValueChange={async (value) => {
              if (value) {
                const granted = await requestNotificationPermissions();
                if (!granted) {
                  Alert.alert(
                    t('settings.reminders'),
                    t('settings.notifications_denied'),
                  );
                  return;
                }
              }
              updateReminders(value);
            }}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={colors.surface}
          />
        </View>
        <Text style={styles.sliderNote}>{t('settings.reminders_note')}</Text>
      </Card>

      <Divider />

      {/* About */}
      <Card>
        <Text style={styles.sectionLabel}>{t('settings.about')}</Text>
        <Text style={styles.aboutText}>{t('app.tagline')}</Text>
        <Text style={styles.versionText}>
          {t('settings.version', { version: appVersion })}
        </Text>
      </Card>
      <Divider />

      {/* Delete everything — last on the screen, away from everyday
          controls, and behind a confirmation that states what goes. */}
      <Card style={styles.buttonStack}>
        <Text style={styles.sectionLabel}>{t('settings.delete_title')}</Text>
        <Text style={styles.sliderNote}>{t('settings.delete_note')}</Text>
        <Button
          label={t('settings.delete_title')}
          icon="trash-outline"
          onPress={handleDeleteAll}
          disabled={busy !== null}
          variant="danger"
          fullWidth
        />
      </Card>
    </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
  },
  screenTitle: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.bold,
    color: colors.textPrimary,
  },
  sectionLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  sliderCard: {
    gap: Spacing.xs,
  },
  buttonStack: {
    gap: Spacing.sm,
  },
  sliderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderLabel: {
    fontSize: Typography.sizes.md,
    color: colors.textPrimary,
  },
  sliderValue: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semibold,
    color: colors.primary,
    fontVariant: ['tabular-nums'],
  },
  sliderNote: {
    fontSize: Typography.sizes.xs,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  sliderSpacer: {
    height: Spacing.md,
  },
  aboutText: {
    fontSize: Typography.sizes.md,
    color: colors.textSecondary,
  },
  versionText: {
    fontSize: Typography.sizes.sm,
    color: colors.textMuted,
    marginTop: Spacing.xs,
  },
});

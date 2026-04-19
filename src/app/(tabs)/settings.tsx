/**
 * Settings screen — language, calendar type, cycle defaults, about.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import { documentDirectory, writeAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
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
import { requestNotificationPermissions } from '@/services/notifications';

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
  } = useSettings();
  const { colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const { periods } = usePeriods();
  const { logs } = useDailyLogs();
  const [exporting, setExporting] = useState(false);

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

  const handleExport = useCallback(async () => {
    try {
      setExporting(true);
      
      let csv = 'Date,Type,Flow,Symptoms,Mood,Notes\n';
      
      // Combine dates
      const allDates = new Set([
        ...periods.map(p => p.startDate),
        ...logs.map(l => l.date)
      ]);
      
      const sortedDates = Array.from(allDates).sort();
      
      for (const d of sortedDates) {
        const isPeriod = periods.some(p => p.startDate === d);
        const log = logs.find(l => l.date === d);
        
        const type = isPeriod ? 'Period Start' : '';
        const flow = log?.flow || '';
        const sym = log?.symptoms?.join(';') || '';
        const mood = log?.mood || '';
        // Escape quotes and wrap notes in quotes for CSV
        const notes = log?.notes ? `"${log.notes.replace(/"/g, '""')}"` : '';
        
        csv += `${d},${type},${flow},${sym},${mood},${notes}\n`;
      }
      if (!documentDirectory) {
        throw new Error('Document directory inside FileSystem is not available');
      }
      
      const filename = `${documentDirectory}cycle_data_export.csv`;
      await writeAsStringAsync(filename, csv, { encoding: 'utf8' });
      
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Error', 'Sharing is not available on this device');
        return;
      }
      
      await Sharing.shareAsync(filename, {
        mimeType: 'text/csv'
      });
      
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to export data');
    } finally {
      setExporting(false);
    }
  }, [periods, logs]);

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

      {/* Data Export */}
      <Card>
        <Text style={styles.sectionLabel}>{t('day_details.export_data')}</Text>
        <Button 
          label={exporting ? t('day_details.saving') : t('day_details.export_data')} 
          icon="download-outline" 
          onPress={handleExport}
          loading={exporting}
          variant="secondary"
          fullWidth
        />
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

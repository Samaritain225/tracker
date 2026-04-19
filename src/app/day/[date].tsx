/**
 * Day Details screen (Modal).
 * Manage periods, flow, symptoms, mood, and notes for a specific day.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radii, Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/providers/theme-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useDailyLogs } from '@/hooks/use-daily-logs';
import { usePeriods } from '@/hooks/use-periods';
import { formatDisplayDate, parseISODate } from '@/utils/date';
import { useSettings } from '@/hooks/use-settings';

const SYMPTOMS = ['cramps', 'headache', 'bloating', 'acne', 'fatigue'];
const MOODS = ['happy', 'sensitive', 'sad', 'anxious'];

export default function DayDetailsScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  const { settings } = useSettings();
  const { periods, addPeriod, removePeriod } = usePeriods();
  const { logs, saveLog } = useDailyLogs();

  const currentLog = logs.find((l) => l.date === date);
  const periodOnDate = periods.find((p) => p.startDate === date);

  const [isPeriodStart, setIsPeriodStart] = useState(!!periodOnDate);
  const [flow, setFlow] = useState<'light' | 'medium' | 'heavy' | null>(
    (currentLog?.flow as 'light' | 'medium' | 'heavy') ?? null,
  );
  const [symptoms, setSymptoms] = useState<string[]>(currentLog?.symptoms ?? []);
  const [mood, setMood] = useState<string | null>(currentLog?.mood ?? null);
  const [notes, setNotes] = useState(currentLog?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setIsPeriodStart(!!periodOnDate);
  }, [periodOnDate]);

  const toggleSymptom = useCallback((symptom: string) => {
    setSymptoms((prev) =>
      prev.includes(symptom)
        ? prev.filter((s) => s !== symptom)
        : [...prev, symptom],
    );
  }, []);

  const handleSave = useCallback(async () => {
    if (!date) return;
    setSaving(true);

    try {
      // Manage period toggle
      if (isPeriodStart && !periodOnDate) {
        await addPeriod(date);
      } else if (!isPeriodStart && periodOnDate) {
        await removePeriod(periodOnDate.id);
      }

      // Save daily log data if there is any to save (or if we are clearing it)
      if (flow || symptoms.length > 0 || mood || notes) {
        await saveLog(date, {
          flow: flow ?? null,
          symptoms,
          mood: mood ?? null,
          notes: notes || null,
        });
      }
    } finally {
      setSaving(false);
      setSaved(true);
      // Wait for a brief moment to show the success state
      setTimeout(() => {
        router.back();
      }, 600);
    }
  }, [date, isPeriodStart, periodOnDate, flow, symptoms, mood, notes, addPeriod, removePeriod, saveLog, router]);

  if (!date) return null;

  const displayDate = formatDisplayDate(
    parseISODate(date),
    (settings?.language as 'en' | 'fr') ?? 'fr',
    (settings?.calendarType as 'gregorian' | 'hijri') ?? 'gregorian',
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? Spacing.sm : insets.top + Spacing.sm }]}>
        <Text style={styles.headerTitle}>{displayDate}</Text>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityLabel={t('common.close')}
          accessibilityRole="button"
        >
          <Icon name="close" size={24} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxl }]}
      >
        <Animated.View entering={FadeInDown.duration(400).delay(100).springify()}>
          <Card style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>{t('day_details.period_started')}</Text>
              <Switch
                value={isPeriodStart}
                onValueChange={setIsPeriodStart}
                trackColor={{ true: colors.period, false: colors.border }}
                thumbColor={colors.surface}
              />
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(150).springify()}>
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>{t('day_details.flow')}</Text>
            <SegmentedControl
              options={[
                { label: t('day_details.flow_light'), value: 'light' },
                { label: t('day_details.flow_medium'), value: 'medium' },
                { label: t('day_details.flow_heavy'), value: 'heavy' },
              ]}
              value={(flow as string) || ''}
              onChange={(val) => setFlow(val as 'light' | 'medium' | 'heavy')}
            />
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(200).springify()}>
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>{t('day_details.symptoms')}</Text>
            <View style={styles.chipGroup}>
              {SYMPTOMS.map((sym) => {
                const active = symptoms.includes(sym);
                return (
                  <Pressable
                    key={sym}
                    onPress={() => toggleSymptom(sym)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {t(`day_details.symptom_${sym}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(250).springify()}>
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>{t('day_details.mood')}</Text>
            <View style={styles.chipGroup}>
              {MOODS.map((m) => {
                const active = mood === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => setMood(active ? null : m)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {t(`day_details.mood_${m}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(300).springify()}>
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>{t('day_details.notes')}</Text>
            <TextInput
              style={styles.textInput}
              value={notes}
              onChangeText={setNotes}
              placeholder={t('day_details.notes')}
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
            />
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(350).springify()}>
          <View style={styles.footer}>
            <Button
              label={saved ? t('day_details.save') : (saving ? t('day_details.saving') : t('day_details.save'))}
              onPress={handleSave}
              loading={saving}
              icon={saved ? 'checkmark' : undefined}
              variant={saved ? 'secondary' : 'primary'}
              fullWidth
            />
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semibold,
    color: colors.textPrimary,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  card: {
    gap: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.medium,
    color: colors.textPrimary,
  },
  sectionTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.full,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: colors.textPrimary,
  },
  chipTextActive: {
    color: colors.primaryText,
  },
  textInput: {
    minHeight: 100,
    backgroundColor: colors.surfaceAlt,
    borderRadius: Radii.sm,
    padding: Spacing.md,
    fontSize: Typography.sizes.md,
    color: colors.textPrimary,
    lineHeight: 24,
  },
  footer: {
    marginTop: Spacing.md,
  },
});

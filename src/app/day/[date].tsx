/**
 * Day Details screen (Modal).
 * Manage periods, flow, symptoms, mood, and notes for a specific day.
 *
 * Split into a data-loading shell (this default export) and an inner
 * form (DayDetailsForm) that owns all editable state. The inner form is
 * only mounted once `periods` and `logs` have resolved from their live
 * queries, and is keyed by `date` — so its useState initializers read
 * real data exactly once instead of racing the async query and silently
 * initializing blank (see plan item 2a).
 */

import React, { useCallback, useState } from 'react';
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
import { LoadingScreen } from '@/components/ui/loading-screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useDailyLogs } from '@/hooks/use-daily-logs';
import { usePeriods } from '@/hooks/use-periods';
import { formatDisplayDate, parseISODate } from '@/utils/date';
import { useSettings } from '@/hooks/use-settings';
import type { DailyLog, FlowLevel } from '@/db/schema';

const SYMPTOMS = ['cramps', 'headache', 'bloating', 'acne', 'fatigue'];
const MOODS = ['happy', 'sensitive', 'sad', 'anxious'];

export default function DayDetailsScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const { settings } = useSettings();
  const {
    periods,
    addPeriod,
    removePeriod,
    error: periodError,
    isLoading: periodsLoading,
  } = usePeriods();
  const { logs, saveLog, isLoading: logsLoading } = useDailyLogs();

  if (!date) return null;

  // Wait for both live queries to resolve before mounting the form, so
  // its initial state is never derived from an empty placeholder array.
  if (periodsLoading || logsLoading) {
    return (
      <View style={{ flex: 1 }}>
        <LoadingScreen />
      </View>
    );
  }

  const currentLog = logs.find((l) => l.date === date) ?? null;
  const periodOnDate = periods.find((p) => p.startDate === date) ?? null;

  return (
    <DayDetailsForm
      key={date}
      date={date}
      language={(settings?.language as 'en' | 'fr') ?? 'fr'}
      calendarType={(settings?.calendarType as 'gregorian' | 'hijri') ?? 'gregorian'}
      initialLog={currentLog}
      initialPeriodId={periodOnDate?.id ?? null}
      periodError={periodError}
      addPeriod={addPeriod}
      removePeriod={removePeriod}
      saveLog={saveLog}
    />
  );
}

type DayDetailsFormProps = {
  date: string;
  language: 'en' | 'fr';
  calendarType: 'gregorian' | 'hijri';
  initialLog: DailyLog | null;
  initialPeriodId: string | null;
  periodError: string | null;
  addPeriod: (date: string) => Promise<void>;
  removePeriod: (id: string) => Promise<void>;
  saveLog: (
    date: string,
    partial: { flow: string | null; symptoms: string[]; mood: string | null; notes: string | null },
  ) => Promise<void>;
};

function DayDetailsForm({
  date,
  language,
  calendarType,
  initialLog,
  initialPeriodId,
  periodError,
  addPeriod,
  removePeriod,
  saveLog,
}: DayDetailsFormProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  const [isPeriodStart, setIsPeriodStart] = useState(!!initialPeriodId);
  const [flow, setFlow] = useState<FlowLevel | null>(
    (initialLog?.flow as FlowLevel) ?? null,
  );
  const [symptoms, setSymptoms] = useState<string[]>(initialLog?.symptoms ?? []);
  const [mood, setMood] = useState<string | null>(initialLog?.mood ?? null);
  const [notes, setNotes] = useState(initialLog?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggleSymptom = useCallback((symptom: string) => {
    setSymptoms((prev) =>
      prev.includes(symptom)
        ? prev.filter((s) => s !== symptom)
        : [...prev, symptom],
    );
  }, []);

  const handleFlowChange = useCallback((val: string) => {
    // Tapping the already-active option deselects it, since
    // SegmentedControl always fires onChange with the pressed value.
    setFlow((prev) => (prev === val ? null : (val as FlowLevel)));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);

    try {
      // Manage period toggle
      if (isPeriodStart && !initialPeriodId) {
        await addPeriod(date);
      } else if (!isPeriodStart && initialPeriodId) {
        await removePeriod(initialPeriodId);
      }

      // Always save — saveLog itself deletes the row when every field is
      // empty, so clearing a previously-logged day now actually clears it
      // instead of silently leaving the old data in place (plan item 2b).
      await saveLog(date, {
        flow: flow ?? null,
        symptoms,
        mood: mood ?? null,
        notes: notes || null,
      });
    } finally {
      setSaving(false);
      setSaved(true);
      // Wait for a brief moment to show the success state
      setTimeout(() => {
        router.back();
      }, 600);
    }
  }, [date, isPeriodStart, initialPeriodId, flow, symptoms, mood, notes, addPeriod, removePeriod, saveLog, router]);

  const displayDate = formatDisplayDate(parseISODate(date), language, calendarType);

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
            {periodError ? (
              <Text style={styles.error}>{t(`errors.${periodError}`)}</Text>
            ) : null}
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(150).springify()}>
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>{t('day_details.flow')}</Text>
            <SegmentedControl
              options={[
                { label: t('day_details.flow_spotting'), value: 'spotting' },
                { label: t('day_details.flow_light'), value: 'light' },
                { label: t('day_details.flow_medium'), value: 'medium' },
                { label: t('day_details.flow_heavy'), value: 'heavy' },
              ]}
              value={(flow as string) || ''}
              onChange={handleFlowChange}
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
  error: {
    fontSize: Typography.sizes.sm,
    color: colors.danger,
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

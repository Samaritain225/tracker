/**
 * Adding or changing a pregnancy visit: a check-up, a scan, a blood test.
 * Opened with `?id=` to change an existing one.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { DateField } from '@/components/pregnancy/date-field';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LoadingScreen } from '@/components/ui/loading-screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Radii, Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import type { Pregnancy, PregnancyVisit, VisitKind } from '@/db/schema';
import { usePregnancies } from '@/hooks/use-pregnancies';
import { usePregnancyVisits } from '@/hooks/use-pregnancy-visits';
import { useSettings } from '@/hooks/use-settings';
import { useToday } from '@/hooks/use-today';
import { useTheme } from '@/providers/theme-provider';
import { findActivePregnancy } from '@/utils/pregnancy';

const KINDS: VisitKind[] = ['checkup', 'ultrasound', 'blood_test', 'other'];

export default function VisitScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { pregnancies, isLoading: pLoading } = usePregnancies();
  const { visits, isLoading: vLoading } = usePregnancyVisits();

  // The form's starting values come from these queries, so it waits.
  if (pLoading || vLoading) return <LoadingScreen />;

  const existing = id ? visits.find((v) => v.id === id) ?? null : null;
  const pregnancy = existing
    ? pregnancies.find((p) => p.id === existing.pregnancyId) ?? null
    : findActivePregnancy(pregnancies);
  if (!pregnancy) return null;

  return <VisitForm pregnancy={pregnancy} existing={existing} />;
}

/** Parses an optional number field: '' is null, junk is NaN. */
function parseOptional(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  return trimmed === '' ? null : Number(trimmed);
}

function VisitForm({ pregnancy, existing }: { pregnancy: Pregnancy; existing: PregnancyVisit | null }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const todayISO = useToday();
  const { settings } = useSettings();
  const { addVisit, updateVisit, deleteVisit } = usePregnancyVisits();
  const language = (settings?.language as 'en' | 'fr') ?? 'fr';
  const calendarType = (settings?.calendarType as 'gregorian' | 'hijri') ?? 'gregorian';

  const [date, setDate] = useState(existing?.date ?? todayISO);
  const [kind, setKind] = useState<VisitKind>((existing?.kind as VisitKind) ?? 'checkup');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [weight, setWeight] = useState(existing?.weightKg?.toString() ?? '');
  const [systolic, setSystolic] = useState(existing?.systolic?.toString() ?? '');
  const [diastolic, setDiastolic] = useState(existing?.diastolic?.toString() ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const weightKg = parseOptional(weight);
  const sys = parseOptional(systolic);
  const dia = parseOptional(diastolic);
  // Visits can be planned ahead, so only the start bounds the date.
  const dateError = date <= pregnancy.lastPeriodDate ? t('journey.error_date') : null;
  const weightError =
    weightKg !== null && (Number.isNaN(weightKg) || weightKg < 30 || weightKg > 250)
      ? t('journey.error_weight')
      : null;
  const bpError =
    (sys === null) !== (dia === null) ||
    (sys !== null && (Number.isNaN(sys) || sys < 60 || sys > 250)) ||
    (dia !== null && (Number.isNaN(dia) || dia < 30 || dia > 150))
      ? t('journey.error_bp')
      : null;
  const error = dateError ?? weightError ?? bpError;

  const handleSave = async () => {
    setSaving(true);
    setFailed(false);
    const input = {
      date,
      kind,
      title: title.trim() || null,
      weightKg,
      systolic: sys === null ? null : Math.round(sys),
      diastolic: dia === null ? null : Math.round(dia),
      notes: notes.trim() || null,
    };
    const ok = existing
      ? await updateVisit(existing.id, input)
      : (await addVisit(pregnancy.id, input)) !== null;
    setSaving(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    router.back();
  };

  const handleDelete = () => {
    if (!existing) return;
    Alert.alert(t('journey.delete_visit_title'), t('journey.delete_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('journey.delete'),
        style: 'destructive',
        onPress: async () => {
          if (await deleteVisit(existing.id)) router.back();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{existing ? t('journey.visit_edit') : t('journey.visit_new')}</Text>

        <SegmentedControl
          options={KINDS.map((k) => ({ label: t(`journey.visit_${k}`), value: k }))}
          value={kind}
          onChange={setKind}
        />

        <Card>
          <DateField
            label={t('pregnancy.end_loss_date')}
            valueISO={date}
            onChange={setDate}
            todayISO={todayISO}
            language={language}
            calendarType={calendarType}
          />
        </Card>

        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder={t('journey.visit_title')}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          maxLength={80}
        />

        <Text style={styles.label}>{t('journey.visit_measurements')}</Text>
        <TextInput
          value={weight}
          onChangeText={setWeight}
          placeholder={t('journey.visit_weight')}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          keyboardType="decimal-pad"
          maxLength={6}
        />
        <View style={styles.row}>
          <TextInput
            value={systolic}
            onChangeText={setSystolic}
            placeholder={t('journey.visit_systolic')}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.flex]}
            keyboardType="number-pad"
            maxLength={3}
          />
          <TextInput
            value={diastolic}
            onChangeText={setDiastolic}
            placeholder={t('journey.visit_diastolic')}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.flex]}
            keyboardType="number-pad"
            maxLength={3}
          />
        </View>

        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder={t('journey.visit_notes')}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.multiline]}
          multiline
          textAlignVertical="top"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {failed ? <Text style={styles.error}>{t('journey.error_save')}</Text> : null}

        <Button
          label={t('journey.save')}
          onPress={handleSave}
          loading={saving}
          disabled={error !== null || saving}
          fullWidth
        />
        {existing ? (
          <Button label={t('journey.delete')} onPress={handleDelete} variant="ghost" fullWidth />
        ) : null}
        <Button label={t('common.cancel')} onPress={() => router.back()} variant="ghost" fullWidth />
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
    title: {
      fontSize: Typography.sizes.xxl,
      fontWeight: Typography.weights.bold,
      color: colors.textPrimary,
    },
    label: {
      fontSize: Typography.sizes.sm,
      fontWeight: Typography.weights.semibold,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: Spacing.sm,
    },
    row: { flexDirection: 'row', gap: Spacing.sm },
    flex: { flex: 1 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      fontSize: Typography.sizes.md,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
    },
    multiline: { minHeight: 90 },
    error: { fontSize: Typography.sizes.sm, color: colors.danger, textAlign: 'center' },
  });

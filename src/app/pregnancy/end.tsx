/**
 * Ending a pregnancy — one question, then a date.
 *
 * "My baby was born" asks for the date of birth and, optionally, a name,
 * and leads into recovery. "The pregnancy ended" asks for a date and
 * nothing else: no follow-up questions, no explanations, and every
 * pregnancy screen goes away the moment it is saved.
 */

import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { DateField } from '@/components/pregnancy/date-field';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Radii, Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import type { PregnancyOutcome } from '@/db/schema';
import { usePregnancies } from '@/hooks/use-pregnancies';
import { useSettings } from '@/hooks/use-settings';
import { useToday } from '@/hooks/use-today';
import { useTheme } from '@/providers/theme-provider';
import { findActivePregnancy } from '@/utils/pregnancy';

export default function PregnancyEndScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const todayISO = useToday();
  const { settings } = useSettings();
  const { pregnancies, endPregnancy } = usePregnancies();
  const active = findActivePregnancy(pregnancies);

  const language = (settings?.language as 'en' | 'fr') ?? 'fr';
  const calendarType = (settings?.calendarType as 'gregorian' | 'hijri') ?? 'gregorian';

  const [outcome, setOutcome] = useState<PregnancyOutcome | null>(null);
  const [date, setDate] = useState(todayISO);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const dateInvalid = !active || date > todayISO || date <= active.lastPeriodDate;

  const handleConfirm = async () => {
    if (!active || !outcome) return;
    setSaving(true);
    setFailed(false);
    const ok = await endPregnancy(active.id, {
      outcome,
      endedOn: date,
      babyName: outcome === 'birth' && name.trim() ? name.trim() : null,
    });
    setSaving(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    router.dismissAll();
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
        <Text style={styles.title}>{t('pregnancy.end_title')}</Text>

        <Button
          label={t('pregnancy.end_birth')}
          onPress={() => setOutcome('birth')}
          variant={outcome === 'birth' ? 'primary' : 'secondary'}
          fullWidth
        />
        <Button
          label={t('pregnancy.end_loss')}
          onPress={() => setOutcome('loss')}
          variant={outcome === 'loss' ? 'primary' : 'secondary'}
          fullWidth
        />

        {outcome ? (
          <>
            <Card>
              <DateField
                label={outcome === 'birth' ? t('pregnancy.end_birth_date') : t('pregnancy.end_loss_date')}
                valueISO={date}
                onChange={setDate}
                todayISO={todayISO}
                language={language}
                calendarType={calendarType}
              />
            </Card>

            {outcome === 'birth' ? (
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t('pregnancy.end_name')}
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                maxLength={60}
                autoCapitalize="words"
              />
            ) : null}

            {dateInvalid ? <Text style={styles.error}>{t('pregnancy.error_end_date')}</Text> : null}
            {failed ? <Text style={styles.error}>{t('pregnancy.error_save')}</Text> : null}

            <Button
              label={t('pregnancy.end_confirm')}
              onPress={handleConfirm}
              loading={saving}
              disabled={dateInvalid || saving}
              fullWidth
            />
          </>
        ) : null}

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
    error: {
      fontSize: Typography.sizes.sm,
      color: colors.danger,
      textAlign: 'center',
    },
  });

/**
 * Adding or changing a Journey moment: a note, a first kick, or a photo.
 * Opened with `?id=` to change an existing one.
 *
 * Photos come from Android's own photo picker, which needs no storage or
 * camera permission; the chosen photo is copied into the app when the
 * moment is saved.
 */

import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
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
import type { MomentKind, Pregnancy, PregnancyMoment } from '@/db/schema';
import { usePregnancies } from '@/hooks/use-pregnancies';
import { usePregnancyMoments } from '@/hooks/use-pregnancy-moments';
import { useSettings } from '@/hooks/use-settings';
import { useToday } from '@/hooks/use-today';
import { useTheme } from '@/providers/theme-provider';
import { photoUri } from '@/services/user-data';
import { findActivePregnancy } from '@/utils/pregnancy';

/** The kinds she can add herself; the others are recorded by the app. */
const USER_KINDS: MomentKind[] = ['note', 'kick', 'photo'];

export default function MomentScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { pregnancies, isLoading: pLoading } = usePregnancies();
  const { moments, isLoading: mLoading } = usePregnancyMoments();

  if (pLoading || mLoading) return <LoadingScreen />;

  const existing = id ? moments.find((m) => m.id === id) ?? null : null;
  const pregnancy = existing
    ? pregnancies.find((p) => p.id === existing.pregnancyId) ?? null
    : findActivePregnancy(pregnancies);
  if (!pregnancy) return null;

  return <MomentForm pregnancy={pregnancy} existing={existing} />;
}

function MomentForm({ pregnancy, existing }: { pregnancy: Pregnancy; existing: PregnancyMoment | null }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const todayISO = useToday();
  const { settings } = useSettings();
  const { addMoment, updateMoment, deleteMoment } = usePregnancyMoments();
  const language = (settings?.language as 'en' | 'fr') ?? 'fr';
  const calendarType = (settings?.calendarType as 'gregorian' | 'hijri') ?? 'gregorian';

  const [kind, setKind] = useState<MomentKind>((existing?.kind as MomentKind) ?? 'note');
  const [date, setDate] = useState(existing?.date ?? todayISO);
  const [text, setText] = useState(existing?.text ?? '');
  /** undefined: unchanged; null: removed; string: newly picked. */
  const [newPhoto, setNewPhoto] = useState<string | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const isSystemKind = !USER_KINDS.includes(kind);
  const shownPhoto =
    newPhoto !== undefined ? newPhoto : existing?.photoFileName ? photoUri(existing.photoFileName) : null;

  const dateError =
    date <= pregnancy.lastPeriodDate || date > (pregnancy.endedOn ?? todayISO)
      ? t('journey.error_date')
      : null;
  const contentError =
    kind === 'photo' && !shownPhoto
      ? t('journey.moment_photo_needed')
      : kind === 'note' && !text.trim()
        ? t('journey.moment_text_needed')
        : null;
  const error = dateError ?? contentError;

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setNewPhoto(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setFailed(false);
    const input = {
      date,
      kind,
      text: text.trim() || null,
      // A photo only belongs to a photo moment; switching kind drops it.
      newPhotoUri: kind === 'photo' ? newPhoto : existing?.photoFileName ? null : undefined,
    };
    const ok = existing
      ? await updateMoment(existing, input)
      : (await addMoment(pregnancy.id, input)) !== null;
    setSaving(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    router.back();
  };

  const handleDelete = () => {
    if (!existing) return;
    Alert.alert(t('journey.delete_moment_title'), t('journey.delete_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('journey.delete'),
        style: 'destructive',
        onPress: async () => {
          if (await deleteMoment(existing)) router.back();
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
        <Text style={styles.title}>{existing ? t('journey.moment_edit') : t('journey.moment_new')}</Text>

        {isSystemKind ? null : (
          <SegmentedControl
            options={USER_KINDS.map((k) => ({ label: t(`journey.${k}`), value: k }))}
            value={kind}
            onChange={setKind}
          />
        )}

        {kind === 'photo' ? (
          <View style={styles.photoBlock}>
            {shownPhoto ? <Image source={{ uri: shownPhoto }} style={styles.photo} contentFit="cover" /> : null}
            <Button
              label={shownPhoto ? t('journey.moment_photo_change') : t('journey.moment_photo_pick')}
              icon="image-outline"
              onPress={pickPhoto}
              variant="secondary"
              fullWidth
            />
          </View>
        ) : null}

        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('journey.moment_text')}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.multiline]}
          multiline
          textAlignVertical="top"
          maxLength={500}
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
    photoBlock: { gap: Spacing.sm, alignItems: 'center' },
    photo: {
      width: 220,
      height: 280,
      borderRadius: Radii.lg,
      backgroundColor: colors.surfaceAlt,
    },
    error: { fontSize: Typography.sizes.sm, color: colors.danger, textAlign: 'center' },
  });

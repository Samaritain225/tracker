/**
 * "My symptoms": the symptoms she added herself. She can add one, rename
 * one (every past day shows the new name), or hide one from the day
 * sheet. Nothing is deleted, so days already logged keep their name.
 */

import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Radii, Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import type { CustomSymptom } from '@/db/schema';
import { useCustomSymptoms } from '@/hooks/use-custom-symptoms';
import { useTheme } from '@/providers/theme-provider';
import {
  CUSTOM_LABEL_MAX,
  CYCLE_SYMPTOMS,
  PREGNANCY_SYMPTOMS,
  cleanLabel,
  isDuplicateLabel,
} from '@/utils/symptoms';

export default function MySymptomsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { customSymptoms, labelOf, addSymptom, renameSymptom, setHidden } = useCustomSymptoms();

  const [newLabel, setNewLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  /** Names already used, leaving out the symptom being renamed. */
  const takenExcept = useCallback(
    (id: string | null) => [
      ...[...CYCLE_SYMPTOMS, ...PREGNANCY_SYMPTOMS].map(labelOf),
      ...customSymptoms.filter((c) => c.id !== id).map((c) => c.label),
    ],
    [customSymptoms, labelOf],
  );

  const handleAdd = useCallback(async () => {
    const label = cleanLabel(newLabel);
    if (!label) return;
    if (isDuplicateLabel(label, takenExcept(null))) {
      setError(t('symptoms.duplicate'));
      return;
    }
    if (await addSymptom(label)) {
      setNewLabel('');
      setError(null);
    } else {
      setError(t('errors.save_failed'));
    }
  }, [newLabel, takenExcept, addSymptom, t]);

  return (
    <View style={styles.container}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xxl },
        ]}
      >
        <Text style={styles.title}>{t('symptoms.title')}</Text>
        <Text style={styles.body}>{t('symptoms.intro')}</Text>

        <Card style={styles.card}>
          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              value={newLabel}
              onChangeText={(v) => {
                setNewLabel(v);
                setError(null);
              }}
              placeholder={t('symptoms.add_placeholder')}
              placeholderTextColor={colors.textMuted}
              maxLength={CUSTOM_LABEL_MAX}
              returnKeyType="done"
              onSubmitEditing={handleAdd}
            />
            <Pressable onPress={handleAdd} style={styles.addButton} accessibilityRole="button">
              <Text style={styles.addButtonText}>{t('symptoms.add')}</Text>
            </Pressable>
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
        </Card>

        {customSymptoms.length === 0 ? (
          <Text style={styles.empty}>{t('symptoms.empty')}</Text>
        ) : (
          <Card style={styles.card}>
            {customSymptoms.map((symptom) => (
              <SymptomRow
                key={symptom.id}
                symptom={symptom}
                taken={takenExcept(symptom.id)}
                onRename={renameSymptom}
                onSetHidden={setHidden}
                styles={styles}
                colors={colors}
              />
            ))}
            <Text style={styles.note}>{t('symptoms.hide_note')}</Text>
          </Card>
        )}

        <Button label={t('common.close')} onPress={() => router.back()} variant="ghost" fullWidth />
      </ScrollView>
    </View>
  );
}

function SymptomRow({
  symptom,
  taken,
  onRename,
  onSetHidden,
  styles,
  colors,
}: {
  symptom: CustomSymptom;
  taken: string[];
  onRename: (id: string, label: string) => Promise<boolean>;
  onSetHidden: (id: string, hidden: boolean) => Promise<boolean>;
  styles: Styles;
  colors: ThemeColors;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(symptom.label);
  const [error, setError] = useState<string | null>(null);

  // Saved when she leaves the field; an empty or taken name goes back
  // to the one it had.
  const commit = useCallback(async () => {
    const label = cleanLabel(draft);
    if (!label || label === symptom.label) {
      setDraft(symptom.label);
      return;
    }
    if (isDuplicateLabel(label, taken)) {
      setError(t('symptoms.duplicate'));
      setDraft(symptom.label);
      return;
    }
    setError(null);
    if (await onRename(symptom.id, label)) setDraft(label);
    else setError(t('errors.save_failed'));
  }, [draft, symptom, taken, onRename, t]);

  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <TextInput
          style={[styles.input, symptom.hidden === 1 && styles.hiddenText]}
          value={draft}
          onChangeText={(v) => {
            setDraft(v);
            setError(null);
          }}
          onEndEditing={commit}
          maxLength={CUSTOM_LABEL_MAX}
          returnKeyType="done"
          accessibilityLabel={t('symptoms.rename', { name: symptom.label })}
        />
        <Switch
          value={symptom.hidden === 0}
          onValueChange={(shown) => {
            onSetHidden(symptom.id, !shown);
          }}
          trackColor={{ true: colors.primary, false: colors.border }}
          thumbColor={colors.surface}
          accessibilityLabel={t('symptoms.shown', { name: symptom.label })}
        />
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
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
    card: { gap: Spacing.md },
    addRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    input: {
      flex: 1,
      backgroundColor: colors.surfaceAlt,
      borderRadius: Radii.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      fontSize: Typography.sizes.md,
      color: colors.textPrimary,
    },
    hiddenText: { color: colors.textMuted },
    addButton: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radii.full,
      backgroundColor: colors.primary,
    },
    addButtonText: {
      fontSize: Typography.sizes.sm,
      fontWeight: Typography.weights.semibold,
      color: colors.primaryText,
    },
    row: { gap: Spacing.xs },
    rowMain: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    error: { fontSize: Typography.sizes.sm, color: colors.danger },
    empty: { fontSize: Typography.sizes.md, color: colors.textMuted, textAlign: 'center' },
    note: { fontSize: Typography.sizes.xs, color: colors.textMuted, lineHeight: 18 },
  });

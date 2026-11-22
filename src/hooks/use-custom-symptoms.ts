/**
 * Hook for the symptoms she added herself, and the one function every
 * screen uses to name a symptom key, built-in or custom.
 */

import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { db } from '@/db/client';
import { customSymptoms } from '@/db/schema';
import type { CustomSymptom } from '@/db/schema';
import { isQueryLoading } from '@/utils/query';
import { symptomLabel } from '@/utils/symptoms';

type UseCustomSymptomsReturn = {
  /** All of them, oldest first, hidden ones included. */
  customSymptoms: CustomSymptom[];
  /** Ones still offered on the day sheet. */
  visible: CustomSymptom[];
  /** id → name, for symptomLabel and the summary builders. */
  customLabels: ReadonlyMap<string, string>;
  /** Names any symptom key: built-in, custom, or missing. */
  labelOf: (key: string) => string;
  isLoading: boolean;
  error: string | null;
  addSymptom: (label: string) => Promise<string | null>;
  renameSymptom: (id: string, label: string) => Promise<boolean>;
  setHidden: (id: string, hidden: boolean) => Promise<boolean>;
};

export function useCustomSymptoms(): UseCustomSymptomsReturn {
  const { t } = useTranslation();
  const { data, error: queryError, updatedAt } = useLiveQuery(
    db.select().from(customSymptoms).orderBy(customSymptoms.createdAt),
  );
  const [error, setError] = useState<string | null>(null);

  const all = useMemo(() => data ?? [], [data]);
  const visible = useMemo(() => all.filter((s) => s.hidden === 0), [all]);
  const customLabels = useMemo(() => new Map(all.map((s) => [s.id, s.label])), [all]);
  const labelOf = useCallback((key: string) => symptomLabel(key, t, customLabels), [t, customLabels]);

  const addSymptom = useCallback(async (label: string) => {
    try {
      setError(null);
      const [created] = await db.insert(customSymptoms).values({ label }).returning({ id: customSymptoms.id });
      return created?.id ?? null;
    } catch (e) {
      console.error(e);
      setError('save_failed');
      return null;
    }
  }, []);

  const renameSymptom = useCallback(async (id: string, label: string) => {
    try {
      setError(null);
      await db.update(customSymptoms).set({ label }).where(eq(customSymptoms.id, id));
      return true;
    } catch (e) {
      console.error(e);
      setError('save_failed');
      return false;
    }
  }, []);

  const setHidden = useCallback(async (id: string, hidden: boolean) => {
    try {
      setError(null);
      await db.update(customSymptoms).set({ hidden: hidden ? 1 : 0 }).where(eq(customSymptoms.id, id));
      return true;
    } catch (e) {
      console.error(e);
      setError('save_failed');
      return false;
    }
  }, []);

  return {
    customSymptoms: all,
    visible,
    customLabels,
    labelOf,
    isLoading: isQueryLoading(updatedAt, queryError),
    error: error ?? (queryError ? queryError.message : null),
    addSymptom,
    renameSymptom,
    setHidden,
  };
}

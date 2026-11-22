/**
 * Hook for pregnancy visits: check-ups, scans and tests.
 *
 * Like the other data hooks, mutators report their outcome rather than
 * resolving void, because they swallow their own errors into `error`.
 */

import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useCallback, useState } from 'react';

import { db } from '@/db/client';
import { pregnancyVisits } from '@/db/schema';
import type { PregnancyVisit, VisitKind } from '@/db/schema';
import { isQueryLoading } from '@/utils/query';

export type VisitInput = {
  date: string;
  kind: VisitKind;
  title: string | null;
  weightKg: number | null;
  systolic: number | null;
  diastolic: number | null;
  notes: string | null;
};

type UsePregnancyVisitsReturn = {
  visits: PregnancyVisit[];
  isLoading: boolean;
  error: string | null;
  /** Returns the new visit's id, or null if the write failed. */
  addVisit: (pregnancyId: string, input: VisitInput) => Promise<string | null>;
  updateVisit: (id: string, input: VisitInput) => Promise<boolean>;
  deleteVisit: (id: string) => Promise<boolean>;
};

export function usePregnancyVisits(): UsePregnancyVisitsReturn {
  const { data, error: queryError, updatedAt } = useLiveQuery(
    db.select().from(pregnancyVisits).orderBy(pregnancyVisits.date),
  );
  const [error, setError] = useState<string | null>(null);

  const addVisit = useCallback(async (pregnancyId: string, input: VisitInput) => {
    try {
      setError(null);
      const [created] = await db
        .insert(pregnancyVisits)
        .values({ pregnancyId, ...input })
        .returning({ id: pregnancyVisits.id });
      return created?.id ?? null;
    } catch (e) {
      console.error(e);
      setError('save_failed');
      return null;
    }
  }, []);

  const updateVisit = useCallback(async (id: string, input: VisitInput) => {
    try {
      setError(null);
      await db.update(pregnancyVisits).set(input).where(eq(pregnancyVisits.id, id));
      return true;
    } catch (e) {
      console.error(e);
      setError('save_failed');
      return false;
    }
  }, []);

  const deleteVisit = useCallback(async (id: string) => {
    try {
      setError(null);
      await db.delete(pregnancyVisits).where(eq(pregnancyVisits.id, id));
      return true;
    } catch (e) {
      console.error(e);
      setError('delete_failed');
      return false;
    }
  }, []);

  return {
    visits: data ?? [],
    isLoading: isQueryLoading(updatedAt, queryError),
    error: error ?? (queryError ? queryError.message : null),
    addVisit,
    updateVisit,
    deleteVisit,
  };
}

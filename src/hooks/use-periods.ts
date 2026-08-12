/**
 * Hook for managing period entries.
 * Provides reactive period list and CRUD operations.
 */

import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useCallback, useState } from 'react';

import { db } from '@/db/client';
import { isQueryLoading } from '@/utils/query';
import { periods } from '@/db/schema';
import type { Period } from '@/db/schema';

type UsePeriodsReturn = {
  periods: Period[];
  isLoading: boolean;
  error: string | null;
  addPeriod: (date: string) => Promise<void>;
  removePeriod: (id: string) => Promise<void>;
  /** Marks when a period stopped. Pass null to clear the answer and let
   * the flow logs infer the length again. */
  setPeriodEnd: (id: string, date: string | null) => Promise<void>;
};

export function usePeriods(): UsePeriodsReturn {
  const { data, error: queryError, updatedAt } = useLiveQuery(
    db.select().from(periods).orderBy(periods.startDate),
  );
  const [error, setError] = useState<string | null>(null);

  const addPeriod = useCallback(async (date: string) => {
    try {
      setError(null);
      await db.insert(periods).values({ startDate: date });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'save_failed';
      // SQLite UNIQUE constraint violation
      if (message.includes('UNIQUE')) {
        setError('duplicate_date');
      } else {
        setError('save_failed');
      }
    }
  }, []);

  const removePeriod = useCallback(async (id: string) => {
    try {
      setError(null);
      await db.delete(periods).where(eq(periods.id, id));
    } catch {
      setError('delete_failed');
    }
  }, []);

  const setPeriodEnd = useCallback(
    async (id: string, date: string | null) => {
      try {
        setError(null);

        if (date !== null) {
          const period = (data ?? []).find((p) => p.id === id);
          // An end before the start would yield a negative duration and
          // silently corrupt every average that reads it.
          if (period && date < period.startDate) {
            setError('end_before_start');
            return;
          }
        }

        await db.update(periods).set({ endDate: date }).where(eq(periods.id, id));
      } catch {
        setError('save_failed');
      }
    },
    [data],
  );

  return {
    periods: data ?? [],
    isLoading: isQueryLoading(updatedAt, queryError),
    error: error ?? (queryError ? queryError.message : null),
    addPeriod,
    removePeriod,
    setPeriodEnd,
  };
}

/**
 * Hook for managing period entries.
 * Provides reactive period list and CRUD operations.
 */

import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useCallback, useState } from 'react';

import { db } from '@/db/client';
import { periods } from '@/db/schema';
import type { Period } from '@/db/schema';

type UsePeriodsReturn = {
  periods: Period[];
  isLoading: boolean;
  error: string | null;
  addPeriod: (date: string) => Promise<void>;
  removePeriod: (id: string) => Promise<void>;
};

export function usePeriods(): UsePeriodsReturn {
  const { data, error: queryError } = useLiveQuery(
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

  return {
    periods: data ?? [],
    isLoading: !data && !queryError,
    error: error ?? (queryError ? queryError.message : null),
    addPeriod,
    removePeriod,
  };
}

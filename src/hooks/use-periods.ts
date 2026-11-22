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

/**
 * The mutators report their outcome rather than resolving void, because
 * they deliberately swallow their own errors into `error` state instead
 * of throwing. A caller awaiting a void promise cannot tell a failed
 * write from a successful one, which is how the day-details form used to
 * show a success tick over a discarded entry.
 */
type UsePeriodsReturn = {
  periods: Period[];
  isLoading: boolean;
  error: string | null;
  /** Returns the new period's id, or null if the write failed. */
  addPeriod: (date: string) => Promise<string | null>;
  /** Returns true if the row was deleted. */
  removePeriod: (id: string) => Promise<boolean>;
  /** Marks when a period stopped. Pass null to clear the answer and let
   * the flow logs infer the length again. Returns true on success. */
  setPeriodEnd: (id: string, date: string | null) => Promise<boolean>;
};

export function usePeriods(): UsePeriodsReturn {
  const { data, error: queryError, updatedAt } = useLiveQuery(
    db.select().from(periods).orderBy(periods.startDate),
  );
  const [error, setError] = useState<string | null>(null);

  const addPeriod = useCallback(async (date: string): Promise<string | null> => {
    try {
      setError(null);
      // Returning the new id lets the caller attach a same-day period end
      // to the row it just created, rather than to whichever older period
      // its inferred window happened to still reach.
      const [created] = await db
        .insert(periods)
        .values({ startDate: date })
        .returning({ id: periods.id });
      return created?.id ?? null;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'save_failed';
      // SQLite UNIQUE constraint violation
      if (message.includes('UNIQUE')) {
        setError('duplicate_date');
      } else {
        setError('save_failed');
      }
      return null;
    }
  }, []);

  const removePeriod = useCallback(async (id: string): Promise<boolean> => {
    try {
      setError(null);
      await db.delete(periods).where(eq(periods.id, id));
      return true;
    } catch {
      setError('delete_failed');
      return false;
    }
  }, []);

  const setPeriodEnd = useCallback(
    async (id: string, date: string | null): Promise<boolean> => {
      try {
        setError(null);

        if (date !== null) {
          const period = (data ?? []).find((p) => p.id === id);
          // An end before the start would yield a negative duration and
          // silently corrupt every average that reads it.
          if (period && date < period.startDate) {
            setError('end_before_start');
            return false;
          }
        }

        await db.update(periods).set({ endDate: date }).where(eq(periods.id, id));
        return true;
      } catch {
        setError('save_failed');
        return false;
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

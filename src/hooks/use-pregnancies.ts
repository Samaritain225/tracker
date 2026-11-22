/**
 * Hook for pregnancies: the reactive list, and the operations that
 * start, change and end one.
 *
 * Like the other data hooks, the mutators swallow their own errors into
 * `error` state and report their outcome — a boolean or the new id —
 * rather than resolving void, so a caller can tell a failed write from a
 * successful one.
 */

import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useCallback, useState } from 'react';

import { db } from '@/db/client';
import { pregnancies, pregnancyMoments, pregnancyVisits } from '@/db/schema';
import type { Pregnancy, PregnancyOutcome } from '@/db/schema';
import { deletePhoto } from '@/services/user-data';
import { isQueryLoading } from '@/utils/query';

type StartInput = {
  lastPeriodDate: string;
  scanDueDate: string | null;
  /** Her usual cycle length now, kept with the pregnancy for its dates. */
  cycleLengthDays: number | null;
  /** Today, for dating the "Positive test" moment. */
  todayISO: string;
};

type UsePregnanciesReturn = {
  pregnancies: Pregnancy[];
  isLoading: boolean;
  error: string | null;
  /** Returns the new pregnancy's id, or null if the write failed. */
  startPregnancy: (input: StartInput) => Promise<string | null>;
  /** Changes the last-period date or the scan due date. A changed scan
   * due date is also recorded as a moment on the Journey. */
  updatePregnancyDates: (
    id: string,
    dates: { lastPeriodDate: string; scanDueDate: string | null; cycleLengthDays: number | null },
    todayISO: string,
  ) => Promise<boolean>;
  endPregnancy: (
    id: string,
    ending: { outcome: PregnancyOutcome; endedOn: string; babyName: string | null },
  ) => Promise<boolean>;
  /** Deletes a pregnancy started by mistake, with its visits and moments. */
  removePregnancy: (id: string) => Promise<boolean>;
  setBreastfeeding: (id: string, value: boolean) => Promise<boolean>;
  /** After a loss: keep the Journey as it is. */
  keepJourney: (id: string) => Promise<boolean>;
  /** After a loss: delete the Journey's visits, moments and photos, but
   * keep the pregnancy itself so the cycle maths still leaves it out. */
  deleteJourney: (id: string) => Promise<boolean>;
};

export function usePregnancies(): UsePregnanciesReturn {
  const { data, error: queryError, updatedAt } = useLiveQuery(
    db.select().from(pregnancies).orderBy(pregnancies.lastPeriodDate),
  );
  const [error, setError] = useState<string | null>(null);

  const startPregnancy = useCallback(async (input: StartInput): Promise<string | null> => {
    try {
      setError(null);
      return db.transaction((tx) => {
        const [created] = tx
          .insert(pregnancies)
          .values({
            lastPeriodDate: input.lastPeriodDate,
            scanDueDate: input.scanDueDate,
            cycleLengthDays: input.cycleLengthDays,
          })
          .returning({ id: pregnancies.id })
          .all();
        tx.insert(pregnancyMoments)
          .values({ pregnancyId: created.id, date: input.todayISO, kind: 'positive_test' })
          .run();
        return created.id;
      });
    } catch (e) {
      console.error(e);
      setError('save_failed');
      return null;
    }
  }, []);

  const updatePregnancyDates = useCallback(
    async (
      id: string,
      dates: { lastPeriodDate: string; scanDueDate: string | null; cycleLengthDays: number | null },
      todayISO: string,
    ): Promise<boolean> => {
      try {
        setError(null);
        const current = (data ?? []).find((p) => p.id === id);
        db.transaction((tx) => {
          tx.update(pregnancies).set(dates).where(eq(pregnancies.id, id)).run();
          if (dates.scanDueDate && dates.scanDueDate !== current?.scanDueDate) {
            tx.insert(pregnancyMoments)
              .values({
                pregnancyId: id,
                date: todayISO,
                kind: 'due_date_change',
                text: dates.scanDueDate,
              })
              .run();
          }
        });
        return true;
      } catch (e) {
        console.error(e);
        setError('save_failed');
        return false;
      }
    },
    [data],
  );

  const endPregnancy = useCallback(
    async (
      id: string,
      ending: { outcome: PregnancyOutcome; endedOn: string; babyName: string | null },
    ): Promise<boolean> => {
      try {
        setError(null);
        await db
          .update(pregnancies)
          .set({ outcome: ending.outcome, endedOn: ending.endedOn, babyName: ending.babyName })
          .where(eq(pregnancies.id, id));
        return true;
      } catch (e) {
        console.error(e);
        setError('save_failed');
        return false;
      }
    },
    [],
  );

  const removePregnancy = useCallback(async (id: string): Promise<boolean> => {
    try {
      setError(null);
      const photos = db
        .select({ name: pregnancyMoments.photoFileName })
        .from(pregnancyMoments)
        .where(eq(pregnancyMoments.pregnancyId, id))
        .all();
      // Children first and explicitly: the schema declares ON DELETE
      // CASCADE, but SQLite only enforces it with foreign_keys switched
      // on, and expo-sqlite leaves it off.
      db.transaction((tx) => {
        tx.delete(pregnancyMoments).where(eq(pregnancyMoments.pregnancyId, id)).run();
        tx.delete(pregnancyVisits).where(eq(pregnancyVisits.pregnancyId, id)).run();
        tx.delete(pregnancies).where(eq(pregnancies.id, id)).run();
      });
      for (const { name } of photos) if (name) deletePhoto(name);
      return true;
    } catch (e) {
      console.error(e);
      setError('delete_failed');
      return false;
    }
  }, []);

  const setBreastfeeding = useCallback(async (id: string, value: boolean): Promise<boolean> => {
    try {
      setError(null);
      await db
        .update(pregnancies)
        .set({ breastfeeding: value ? 1 : 0 })
        .where(eq(pregnancies.id, id));
      return true;
    } catch (e) {
      console.error(e);
      setError('save_failed');
      return false;
    }
  }, []);

  const keepJourney = useCallback(async (id: string): Promise<boolean> => {
    try {
      setError(null);
      await db.update(pregnancies).set({ journeyChoice: 'kept' }).where(eq(pregnancies.id, id));
      return true;
    } catch (e) {
      console.error(e);
      setError('save_failed');
      return false;
    }
  }, []);

  const deleteJourney = useCallback(async (id: string): Promise<boolean> => {
    try {
      setError(null);
      const photos = db
        .select({ name: pregnancyMoments.photoFileName })
        .from(pregnancyMoments)
        .where(eq(pregnancyMoments.pregnancyId, id))
        .all();
      db.transaction((tx) => {
        tx.delete(pregnancyMoments).where(eq(pregnancyMoments.pregnancyId, id)).run();
        tx.delete(pregnancyVisits).where(eq(pregnancyVisits.pregnancyId, id)).run();
        tx.update(pregnancies).set({ journeyChoice: 'deleted' }).where(eq(pregnancies.id, id)).run();
      });
      for (const { name } of photos) if (name) deletePhoto(name);
      return true;
    } catch (e) {
      console.error(e);
      setError('delete_failed');
      return false;
    }
  }, []);

  return {
    pregnancies: data ?? [],
    isLoading: isQueryLoading(updatedAt, queryError),
    error: error ?? (queryError ? queryError.message : null),
    startPregnancy,
    updatePregnancyDates,
    endPregnancy,
    removePregnancy,
    setBreastfeeding,
    keepJourney,
    deleteJourney,
  };
}

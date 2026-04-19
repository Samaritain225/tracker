/**
 * Hook for managing daily logs.
 * Provides a reactive list of all logs and operations to save/update/delete.
 */

import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useCallback, useState } from 'react';

import { db } from '@/db/client';
import { dailyLogs } from '@/db/schema';
import type { DailyLog, NewDailyLog } from '@/db/schema';

type UseDailyLogsReturn = {
  logs: DailyLog[];
  isLoading: boolean;
  error: string | null;
  saveLog: (date: string, partial: Partial<Omit<NewDailyLog, 'id' | 'date' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  deleteLog: (id: string) => Promise<void>;
};

export function useDailyLogs(): UseDailyLogsReturn {
  const { data, error: queryError } = useLiveQuery(
    db.select().from(dailyLogs).orderBy(dailyLogs.date),
  );
  const [error, setError] = useState<string | null>(null);

  const saveLog = useCallback(async (
    date: string,
    partial: Partial<Omit<NewDailyLog, 'id' | 'date' | 'createdAt' | 'updatedAt'>>
  ) => {
    try {
      setError(null);
      // Check if a log already exists for this date
      const existing = await db.select().from(dailyLogs).where(eq(dailyLogs.date, date));

      if (existing.length > 0) {
        // Update existing
        await db
          .update(dailyLogs)
          .set({ ...partial, updatedAt: Date.now() })
          .where(eq(dailyLogs.date, date));
      } else {
        // Empty partial state? Don't create an empty log unless explicitly asked
        // Actually, if they are pressing save, they want to save *something*.
        await db.insert(dailyLogs).values({
          date,
          ...partial,
        });
      }
    } catch (e) {
      console.error(e);
      setError('save_failed');
    }
  }, []);

  const deleteLog = useCallback(async (id: string) => {
    try {
      setError(null);
      await db.delete(dailyLogs).where(eq(dailyLogs.id, id));
    } catch {
      setError('delete_failed');
    }
  }, []);

  return {
    logs: data ?? [],
    isLoading: !data && !queryError,
    error: error ?? (queryError ? queryError.message : null),
    saveLog,
    deleteLog,
  };
}

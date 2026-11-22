/**
 * Ramadan fasts to make up: for each Ramadan in her history, the
 * suggested count (from her bleeding days), any number she set herself,
 * and the fasts she has made up.
 *
 * Mutators report their outcome rather than resolving void, like the
 * other data hooks.
 */

import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useCallback, useMemo } from 'react';

import { db } from '@/db/client';
import { fastsMadeUp, ramadanOwed } from '@/db/schema';
import type { DailyLog, FastMadeUp, Period, Pregnancy } from '@/db/schema';
import { missedFastBleedingDates, ramadanRanges, suggestedMissedFasts } from '@/utils/fiqh/ramadan';
import type { RamadanRange } from '@/utils/fiqh/ramadan';

export type RamadanRow = {
  range: RamadanRange;
  suggestedDates: string[];
  /** Her own number when she set one, otherwise the suggestion. */
  owed: number;
  setByHer: boolean;
  madeUp: FastMadeUp[];
};

export function useRamadanFasts(input: {
  periods: Period[];
  logs: DailyLog[];
  pregnancies: Pregnancy[];
  defaultDurationDays: number;
  todayISO: string;
}) {
  const owedQuery = useLiveQuery(db.select().from(ramadanOwed));
  const madeUpQuery = useLiveQuery(db.select().from(fastsMadeUp).orderBy(fastsMadeUp.date));
  const owedRows = owedQuery.data ?? [];
  const madeUpRows = madeUpQuery.data ?? [];

  const { periods, logs, pregnancies, defaultDurationDays, todayISO } = input;

  const rows: RamadanRow[] = useMemo(() => {
    const starts = [
      ...periods.map((p) => p.startDate),
      ...pregnancies.map((p) => p.lastPeriodDate),
      ...logs.map((l) => l.date),
    ].sort();
    if (starts.length === 0) return [];
    const flowDates = new Set(logs.filter((l) => l.flow).map((l) => l.date));
    const bleeding = missedFastBleedingDates(periods, flowDates, defaultDurationDays, pregnancies);
    return ramadanRanges(starts[0], todayISO)
      .filter((range) => range.start <= todayISO)
      .map((range) => {
        const suggestedDates = suggestedMissedFasts(range, bleeding, todayISO);
        const override = owedRows.find((o) => o.hijriYear === range.hijriYear);
        return {
          range,
          suggestedDates,
          owed: override ? override.owedDays : suggestedDates.length,
          setByHer: override !== undefined,
          madeUp: madeUpRows.filter((m) => m.hijriYear === range.hijriYear),
        };
      })
      .reverse();
  }, [periods, logs, pregnancies, defaultDurationDays, todayISO, owedRows, madeUpRows]);

  const outstanding = rows.reduce((sum, r) => sum + Math.max(0, r.owed - r.madeUp.length), 0);

  const setOwed = useCallback(async (hijriYear: number, owedDays: number | null) => {
    try {
      if (owedDays === null) {
        await db.delete(ramadanOwed).where(eq(ramadanOwed.hijriYear, hijriYear));
      } else {
        await db
          .insert(ramadanOwed)
          .values({ hijriYear, owedDays, updatedAt: Date.now() })
          .onConflictDoUpdate({ target: ramadanOwed.hijriYear, set: { owedDays, updatedAt: Date.now() } });
      }
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, []);

  const addMadeUp = useCallback(async (hijriYear: number, date: string) => {
    try {
      await db.insert(fastsMadeUp).values({ hijriYear, date });
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, []);

  const removeMadeUp = useCallback(async (id: string) => {
    try {
      await db.delete(fastsMadeUp).where(eq(fastsMadeUp.id, id));
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, []);

  return { rows, outstanding, setOwed, addMadeUp, removeMadeUp };
}

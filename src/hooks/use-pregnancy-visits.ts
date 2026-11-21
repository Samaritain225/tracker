/**
 * Hook for pregnancy visits — read-only for now. Adding and editing
 * visits arrives with the Journey; Settings already needs to know
 * whether a pregnancy has any, to decide whether "Remove this
 * pregnancy" is still offered.
 */

import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '@/db/client';
import { pregnancyVisits } from '@/db/schema';
import type { PregnancyVisit } from '@/db/schema';
import { isQueryLoading } from '@/utils/query';

export function usePregnancyVisits(): { visits: PregnancyVisit[]; isLoading: boolean } {
  const { data, error, updatedAt } = useLiveQuery(
    db.select().from(pregnancyVisits).orderBy(pregnancyVisits.date),
  );
  return { visits: data ?? [], isLoading: isQueryLoading(updatedAt, error) };
}

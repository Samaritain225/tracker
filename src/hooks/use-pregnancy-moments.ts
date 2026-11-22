/**
 * Hook for Journey moments: notes, first kicks, photos, and the moments
 * the app records itself (the positive test, a changed due date).
 *
 * A photo is copied into the app's own folder when the moment is saved,
 * and deleted with the moment, or when replaced by another photo.
 */

import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useCallback, useState } from 'react';

import { db } from '@/db/client';
import { pregnancyMoments } from '@/db/schema';
import type { MomentKind, PregnancyMoment } from '@/db/schema';
import { deletePhoto, savePhoto } from '@/services/user-data';
import { isQueryLoading } from '@/utils/query';

export type MomentInput = {
  date: string;
  kind: MomentKind;
  text: string | null;
  /**
   * A newly picked photo to copy in, or undefined to leave the current
   * one alone, or null to remove it.
   */
  newPhotoUri?: string | null;
};

type UsePregnancyMomentsReturn = {
  moments: PregnancyMoment[];
  isLoading: boolean;
  error: string | null;
  addMoment: (pregnancyId: string, input: MomentInput) => Promise<string | null>;
  updateMoment: (moment: PregnancyMoment, input: MomentInput) => Promise<boolean>;
  deleteMoment: (moment: PregnancyMoment) => Promise<boolean>;
};

export function usePregnancyMoments(): UsePregnancyMomentsReturn {
  const { data, error: queryError, updatedAt } = useLiveQuery(
    db.select().from(pregnancyMoments).orderBy(pregnancyMoments.date),
  );
  const [error, setError] = useState<string | null>(null);

  const addMoment = useCallback(async (pregnancyId: string, input: MomentInput) => {
    let photoFileName: string | null = null;
    try {
      setError(null);
      if (input.newPhotoUri) photoFileName = await savePhoto(input.newPhotoUri);
      const [created] = await db
        .insert(pregnancyMoments)
        .values({ pregnancyId, date: input.date, kind: input.kind, text: input.text, photoFileName })
        .returning({ id: pregnancyMoments.id });
      return created?.id ?? null;
    } catch (e) {
      console.error(e);
      // Don't leave a copied photo behind with no moment pointing at it.
      if (photoFileName) deletePhoto(photoFileName);
      setError('save_failed');
      return null;
    }
  }, []);

  const updateMoment = useCallback(async (moment: PregnancyMoment, input: MomentInput) => {
    let newName: string | null = null;
    try {
      setError(null);
      if (input.newPhotoUri) newName = await savePhoto(input.newPhotoUri);
      const photoFileName =
        input.newPhotoUri === undefined ? moment.photoFileName : newName;
      await db
        .update(pregnancyMoments)
        .set({ date: input.date, kind: input.kind, text: input.text, photoFileName })
        .where(eq(pregnancyMoments.id, moment.id));
      // Only once the row points at the new photo is the old one removed.
      if (input.newPhotoUri !== undefined && moment.photoFileName) {
        deletePhoto(moment.photoFileName);
      }
      return true;
    } catch (e) {
      console.error(e);
      if (newName) deletePhoto(newName);
      setError('save_failed');
      return false;
    }
  }, []);

  const deleteMoment = useCallback(async (moment: PregnancyMoment) => {
    try {
      setError(null);
      await db.delete(pregnancyMoments).where(eq(pregnancyMoments.id, moment.id));
      if (moment.photoFileName) deletePhoto(moment.photoFileName);
      return true;
    } catch (e) {
      console.error(e);
      setError('delete_failed');
      return false;
    }
  }, []);

  return {
    moments: data ?? [],
    isLoading: isQueryLoading(updatedAt, queryError),
    error: error ?? (queryError ? queryError.message : null),
    addMoment,
    updateMoment,
    deleteMoment,
  };
}

/**
 * Hook for managing app settings.
 * Provides reactive settings and granular updaters.
 * Language changes sync with i18next immediately.
 */

import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import i18n from 'i18next';
import { useCallback } from 'react';

import { db } from '@/db/client';
import { settings } from '@/db/schema';
import type { Settings } from '@/db/schema';

const SETTINGS_ID = '1';

type UseSettingsReturn = {
  settings: Settings | null;
  isLoading: boolean;
  updateLanguage: (lang: 'fr' | 'en') => Promise<void>;
  updateCalendarType: (type: 'gregorian' | 'hijri') => Promise<void>;
  updateFallbackCycle: (days: number) => Promise<void>;
  updatePeriodDuration: (days: number) => Promise<void>;
  updateTheme: (theme: 'system' | 'light' | 'dark') => Promise<void>;
  updateAppLock: (enabled: boolean) => Promise<void>;
  updateReminders: (enabled: boolean) => Promise<void>;
};

export function useSettings(): UseSettingsReturn {
  const { data, error } = useLiveQuery(
    db.select().from(settings).where(eq(settings.id, SETTINGS_ID)),
  );

  const currentSettings = data?.[0] ?? null;

  const updateLanguage = useCallback(async (lang: 'fr' | 'en') => {
    try {
      await db
        .update(settings)
        .set({ language: lang })
        .where(eq(settings.id, SETTINGS_ID));
      i18n.changeLanguage(lang);
    } catch (e) {
      console.error('Failed to update language:', e);
    }
  }, []);

  const updateCalendarType = useCallback(async (type: 'gregorian' | 'hijri') => {
    try {
      await db
        .update(settings)
        .set({ calendarType: type })
        .where(eq(settings.id, SETTINGS_ID));
    } catch (e) {
      console.error('Failed to update calendar type:', e);
    }
  }, []);

  const updateFallbackCycle = useCallback(async (days: number) => {
    try {
      await db
        .update(settings)
        .set({ fallbackCycleDays: days })
        .where(eq(settings.id, SETTINGS_ID));
    } catch (e) {
      console.error('Failed to update fallback cycle:', e);
    }
  }, []);

  const updatePeriodDuration = useCallback(async (days: number) => {
    try {
      await db
        .update(settings)
        .set({ periodDurationDays: days })
        .where(eq(settings.id, SETTINGS_ID));
    } catch (e) {
      console.error('Failed to update period duration:', e);
    }
  }, []);

  const updateTheme = useCallback(async (themeItem: 'system' | 'light' | 'dark') => {
    try {
      await db
        .update(settings)
        .set({ theme: themeItem })
        .where(eq(settings.id, SETTINGS_ID));
    } catch (e) {
      console.error('Failed to update theme:', e);
    }
  }, []);

  const updateAppLock = useCallback(async (enabled: boolean) => {
    try {
      await db
        .update(settings)
        .set({ appLockEnabled: enabled ? 1 : 0 })
        .where(eq(settings.id, SETTINGS_ID));
    } catch (e) {
      console.error('Failed to update app lock:', e);
    }
  }, []);

  const updateReminders = useCallback(async (enabled: boolean) => {
    try {
      await db
        .update(settings)
        .set({ remindersEnabled: enabled ? 1 : 0 })
        .where(eq(settings.id, SETTINGS_ID));
    } catch (e) {
      console.error('Failed to update reminders:', e);
    }
  }, []);

  return {
    settings: currentSettings,
    isLoading: !data && !error,
    updateLanguage,
    updateCalendarType,
    updateFallbackCycle,
    updatePeriodDuration,
    updateTheme,
    updateAppLock,
    updateReminders,
  };
}

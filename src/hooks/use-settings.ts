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
import { isQueryLoading } from '@/utils/query';
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
  updateShowStarSign: (show: boolean) => Promise<void>;
  /** Hides the late-period pregnancy prompt for the cycle that started
   * on `periodStart`; it comes back once a newer period is logged. */
  dismissPregnancyPrompt: (periodStart: string) => Promise<void>;
  /** Turns the Islamic option on for a school, or off with null. Turning
   * it on also turns the star sign off and switches to the Hijri
   * calendar; she can change both back. */
  updateSchool: (school: 'maliki' | null) => Promise<void>;
};

export function useSettings(): UseSettingsReturn {
  const { data, error, updatedAt } = useLiveQuery(
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

  const updateShowStarSign = useCallback(async (show: boolean) => {
    try {
      await db
        .update(settings)
        .set({ showStarSign: show ? 1 : 0 })
        .where(eq(settings.id, SETTINGS_ID));
    } catch (e) {
      console.error('Failed to update star sign setting:', e);
    }
  }, []);

  const dismissPregnancyPrompt = useCallback(async (periodStart: string) => {
    try {
      await db
        .update(settings)
        .set({ pregnancyPromptDismissedFor: periodStart })
        .where(eq(settings.id, SETTINGS_ID));
    } catch (e) {
      console.error('Failed to dismiss pregnancy prompt:', e);
    }
  }, []);

  const updateSchool = useCallback(async (school: 'maliki' | null) => {
    try {
      await db
        .update(settings)
        .set(school ? { school, showStarSign: 0, calendarType: 'hijri' } : { school: null })
        .where(eq(settings.id, SETTINGS_ID));
    } catch (e) {
      console.error('Failed to update school:', e);
    }
  }, []);

  return {
    settings: currentSettings,
    isLoading: isQueryLoading(updatedAt, error),
    updateLanguage,
    updateCalendarType,
    updateFallbackCycle,
    updatePeriodDuration,
    updateTheme,
    updateAppLock,
    updateReminders,
    updateShowStarSign,
    dismissPregnancyPrompt,
    updateSchool,
  };
}

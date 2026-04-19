/**
 * DatabaseProvider — wraps the app with Drizzle migration runner.
 * Seeds the settings row on first launch.
 * Controls splash screen visibility in coordination with font loading.
 */

import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { View } from 'react-native';

import { LoadingScreen } from '@/components/ui/loading-screen';
import { db } from '@/db/client';
import migrations from '../../drizzle/migrations';

SplashScreen.preventAutoHideAsync();

type Props = {
  children: React.ReactNode;
};

export function DatabaseProvider({ children }: Props) {
  const { success, error } = useMigrations(db, migrations);

  useEffect(() => {
    if (success) {
      seedSettings();
      SplashScreen.hideAsync();
    }
  }, [success]);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <LoadingScreen message={`Database error: ${error.message}`} />
      </View>
    );
  }

  if (!success) {
    return <LoadingScreen />;
  }

  return <>{children}</>;
}

/**
 * Seeds the settings table with default values if no row exists.
 * Uses INSERT OR IGNORE to avoid duplicates on subsequent launches.
 */
async function seedSettings(): Promise<void> {
  try {
    const expoDb = require('expo-sqlite').openDatabaseSync('cycle.db');
    expoDb.runSync(
      `INSERT OR IGNORE INTO settings (id, language, calendar_type, fallback_cycle_days, period_duration_days, theme, app_lock_enabled, reminders_enabled)
       VALUES (1, 'fr', 'gregorian', 28, 4, 'system', 0, 0)`,
    );
  } catch (e) {
    console.error('Failed to seed settings:', e);
  }
}

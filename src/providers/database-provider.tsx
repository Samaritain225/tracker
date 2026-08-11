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
import { settings } from '@/db/schema';
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
 * Seeds the settings table with a single default row if none exists.
 * Uses ON CONFLICT DO NOTHING (INSERT OR IGNORE) to stay a no-op on
 * subsequent launches. Only `id` is supplied explicitly — every other
 * column's value comes from the schema's own SQL-level DEFAULT clause
 * (see src/db/schema.ts), so there is exactly one source of truth for
 * defaults instead of a second copy that can drift out of sync.
 *
 * Goes through the shared Drizzle client rather than opening a second
 * raw expo-sqlite handle, so id is inserted as the text '1' that
 * useSettings queries for, not an integer relying on SQLite's TEXT
 * column affinity to coerce it.
 */
async function seedSettings(): Promise<void> {
  try {
    await db.insert(settings).values({ id: '1' }).onConflictDoNothing();
  } catch (e) {
    console.error('Failed to seed settings:', e);
  }
}

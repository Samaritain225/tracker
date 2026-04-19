/**
 * Drizzle ORM singleton client for expo-sqlite.
 * Uses a single database instance shared across the app.
 */

import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

const expoDb = openDatabaseSync('cycle.db', { enableChangeListener: true });

export const db = drizzle(expoDb, { schema });

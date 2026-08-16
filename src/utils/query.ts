/**
 * Helpers for interpreting Drizzle `useLiveQuery` results.
 * No React, no database access — safe to unit test.
 */

/**
 * Returns true while a live query has not yet produced its first result.
 *
 * Do not derive this from the query's `data`: `useLiveQuery` initializes it to
 * an empty array, and `![]` is `false`, so a data-based check reports "loaded"
 * on the very first render. Callers that gate form state on that check mount
 * against empty data and then never re-initialize, silently discarding stored
 * values. `updatedAt` stays `undefined` until the first result arrives, which
 * is the only signal that separates "genuinely empty" from "not loaded yet".
 */
export function isQueryLoading(
  updatedAt: Date | undefined,
  error: unknown,
): boolean {
  return updatedAt === undefined && !error;
}

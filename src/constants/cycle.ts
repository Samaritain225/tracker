/**
 * Cycle calculation constants.
 * Every numeric literal related to cycle logic must come from here.
 */

export const DEFAULT_CYCLE_DAYS = 28;
export const DEFAULT_PERIOD_DURATION_DAYS = 5;
export const MIN_CYCLE_DAYS = 21;
export const MAX_CYCLE_DAYS = 40;
export const MIN_PERIOD_DURATION_DAYS = 3;
export const MAX_PERIOD_DURATION_DAYS = 8;
export const OVULATION_OFFSET_FROM_END = 14;
export const FERTILE_DAYS_BEFORE_OVULATION = 3;
export const FERTILE_DAYS_AFTER_OVULATION = 4;

/** How many of the most recent logged cycles feed the average/variance. */
export const RECENT_CYCLE_WINDOW = 6;
/**
 * Gaps between period start dates outside this range are treated as
 * probable data-entry errors and excluded from the average — but never
 * deleted, so they stay visible in History.
 */
export const MIN_PLAUSIBLE_CYCLE_GAP_DAYS = 15;
export const MAX_PLAUSIBLE_CYCLE_GAP_DAYS = 60;

/**
 * Longest run of bleeding the flow-log scan will infer before giving up,
 * so a stray flow entry weeks later cannot stretch a period indefinitely.
 *
 * Deliberately larger than MAX_PERIOD_DURATION_DAYS: that constant bounds
 * the *settings slider* for a typical period, whereas real bleeding can
 * run longer, and the fiqh work this feeds cares about durations up to
 * fifteen days (the Shafi'i maximum for haid).
 */
export const MAX_INFERRED_PERIOD_DAYS = 15;

/**
 * How many consecutive unlogged days the flow scan will bridge before it
 * treats the period as finished. One day covers the common "forgot to log
 * yesterday" case without merging a period into later, unrelated spotting.
 */
export const MAX_FLOW_LOG_GAP_DAYS = 1;

/**
 * Hook that returns "today" as an ISO date string, kept fresh.
 *
 * A plain `new Date()` read once inside a memo goes stale the moment
 * the app is left open across midnight or backgrounded overnight —
 * "3 days until your period" silently stops updating. This hook
 * refreshes on two triggers: whenever the app returns to the
 * foreground, and via a timer scheduled for the next local midnight
 * while the app stays open.
 */

import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { toISODate } from '@/utils/date';

function getTodayISO(): string {
  return toISODate(new Date());
}

/** Milliseconds until the next local midnight, with a small safety margin. */
function msUntilNextMidnight(): number {
  const now = new Date();
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  return nextMidnight.getTime() - now.getTime();
}

export function useToday(): string {
  const [today, setToday] = useState(getTodayISO);

  useEffect(() => {
    const refresh = () => setToday(getTodayISO());

    // Refresh whenever the app comes back to the foreground — covers
    // the app being backgrounded overnight or across a date change.
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refresh();
      }
    });

    // Also refresh via a timer for the next local midnight, in case the
    // app is left open and in the foreground across the date change.
    // Re-armed after each firing since setTimeout only fires once.
    let timeoutId: ReturnType<typeof setTimeout>;
    const armMidnightTimer = () => {
      timeoutId = setTimeout(() => {
        refresh();
        armMidnightTimer();
      }, msUntilNextMidnight());
    };
    armMidnightTimer();

    return () => {
      subscription.remove();
      clearTimeout(timeoutId);
    };
  }, []);

  return today;
}

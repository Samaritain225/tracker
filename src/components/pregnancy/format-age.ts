/**
 * "20 weeks + 1 day", pluralised properly in both languages. Shared so
 * every screen words gestational age the same way.
 */

import type { TFunction } from 'i18next';

import type { GestationalAge } from '@/utils/pregnancy';

export function formatAge(t: TFunction, age: Pick<GestationalAge, 'weeks' | 'days'>): string {
  return t('pregnancy.age', {
    weeks: t('pregnancy.weeks_count', { count: age.weeks }),
    days: t('pregnancy.days_count', { count: age.days }),
  });
}

export function formatDaysShort(t: TFunction, days: number): string {
  return t('pregnancy.age_short', { days: t('pregnancy.days_count', { count: days }) });
}

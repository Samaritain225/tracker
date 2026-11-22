/**
 * Maliki reference limits, from The Risala of Ibn Abi Zayd al-Qayrawani
 * in Aisha Bewley's translation, including her commentary quoting
 * Khalil's Mukhtasar. Verified against the text on 2026-11-22. Not
 * checked by a scholar, by the owner's decision; the app says so.
 */

import type { SchoolRules } from './types';

export const MALIKI: SchoolRules = {
  id: 'maliki',
  haidMaxDays: 15,
  habitPrecautionDays: 3,
  purityMinDays: 15,
  nifasMaxDays: 60,
  citations: {
    haid_min: '2.5, 2.2f',
    haid_max: '2.5, 2.5e',
    habit: '2.5',
    purity_min: '2.5',
    beyond_max: '2.5e',
    pregnancy: '2.2f',
    nifas_max: '2.6b',
    end_signs: '2.5',
    make_up: '23',
  },
};

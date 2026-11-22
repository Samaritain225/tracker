/**
 * Entry point for the Islamic option's rules. Returns null when the
 * option is off, so callers have one check for "show nothing religious".
 */

import { MALIKI } from './maliki';
import type { SchoolId, SchoolRules } from './types';

const SCHOOLS: Record<SchoolId, SchoolRules> = {
  maliki: MALIKI,
};

export function rulesFor(school: string | null | undefined): SchoolRules | null {
  if (!school) return null;
  return SCHOOLS[school as SchoolId] ?? null;
}

export type { ReferenceNote, ReferenceTopic, SchoolId, SchoolRules } from './types';

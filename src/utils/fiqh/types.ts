/**
 * The shape every school's rules take. Screens read reference values and
 * note keys from here and never contain a school's numbers themselves,
 * so another school is one new file plus its text.
 */

export type SchoolId = 'maliki';

/** A reference the app can quote, with where in the source it comes from. */
export type ReferenceTopic =
  | 'haid_min'
  | 'haid_max'
  | 'habit'
  | 'purity_min'
  | 'beyond_max'
  | 'pregnancy'
  | 'nifas_max'
  | 'end_signs'
  | 'make_up';

export type SchoolRules = {
  id: SchoolId;
  /** Longest haid, in days. */
  haidMaxDays: number;
  /** Days of precaution a woman with a usual length may add, within haidMaxDays. */
  habitPrecautionDays: number;
  /** Shortest purity between two haids, in days. */
  purityMinDays: number;
  /** Longest nifas after a birth, in days. */
  nifasMaxDays: number;
  /** Longest haid during a pregnancy, from a given month of pregnancy. */
  pregnancyHaidMaxDays: { fromMonth: number; days: number }[];
  /** Section of the source each reference comes from, for the sources screen. */
  citations: Record<ReferenceTopic, string>;
};

/** Neutral observations; never a ruling. */
export type ReferenceNote = 'beyond_haid_max' | 'short_purity' | 'beyond_nifas_max';

/**
 * The week-by-week pregnancy notes: sizes from the language-free data
 * file, text from one file per language. Written in our own words from
 * the NHS week-by-week guide and Service-Public.gouv.fr, and listed on
 * the "About this information" screen. Not reviewed by a health
 * professional, by the owner's decision.
 */

import data from '@/content/pregnancy-weeks.data.json';
import en from '@/content/pregnancy-weeks.en.json';
import fr from '@/content/pregnancy-weeks.fr.json';

export type Measure = 'head_to_bottom' | 'head_to_heel' | null;
export type MilestoneKey = 'halfway' | 'full_term' | 'due_date';

export type WeekData = {
  week: number;
  emoji: string;
  lengthCm: number | null;
  measure: string | null;
};

export type WeekText = {
  size: string;
  baby: string;
  body: string;
  milestone?: string;
};

export type LanguageContent = {
  weeks: Record<string, WeekText>;
  milestones: Record<string, string>;
};

export type WeekContent = {
  /** The entry shown: 0 for weeks 0 to 3, 41 for 41 and beyond. */
  entryWeek: number;
  emoji: string;
  lengthCm: number | null;
  measure: Measure;
  size: string;
  baby: string;
  body: string;
  milestone: MilestoneKey | null;
};

export const WEEK_DATA: WeekData[] = data.weeks;
export const CONTENT: Record<'en' | 'fr', LanguageContent> = { en, fr };

/** The entry that covers a given completed week. */
export function entryWeekFor(completedWeeks: number, weeks: WeekData[] = WEEK_DATA): number {
  const available = weeks.map((w) => w.week).sort((a, b) => a - b);
  let chosen = available[0];
  for (const w of available) if (w <= completedWeeks) chosen = w;
  return chosen;
}

export function contentForWeek(
  completedWeeks: number,
  language: 'en' | 'fr',
  weeks: WeekData[] = WEEK_DATA,
  content: Record<'en' | 'fr', LanguageContent> = CONTENT,
): WeekContent {
  const entryWeek = entryWeekFor(completedWeeks, weeks);
  const d = weeks.find((w) => w.week === entryWeek)!;
  const text = content[language].weeks[String(entryWeek)];
  return {
    entryWeek,
    emoji: d.emoji,
    lengthCm: d.lengthCm,
    measure: (d.measure as Measure) ?? null,
    size: text.size,
    baby: text.baby,
    body: text.body,
    milestone: (text.milestone as MilestoneKey | undefined) ?? null,
  };
}

/** Weeks whose entry carries a milestone, for marking them on the Journey. */
export function milestoneWeeks(language: 'en' | 'fr'): { week: number; key: MilestoneKey; label: string }[] {
  const c = CONTENT[language];
  return Object.entries(c.weeks)
    .filter(([, t]) => t.milestone)
    .map(([w, t]) => ({ week: Number(w), key: t.milestone as MilestoneKey, label: c.milestones[t.milestone!] }))
    .sort((a, b) => a.week - b.week);
}

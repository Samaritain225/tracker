/**
 * Symptom keys and their names. Built-in symptoms are translation keys;
 * ones she added herself are stored as `custom:<id>` and named from the
 * custom_symptoms table. Every screen that shows a symptom name goes
 * through symptomLabel, so a custom one never shows up as its raw key.
 */

export const CYCLE_SYMPTOMS = ['cramps', 'headache', 'bloating', 'acne', 'fatigue'];
export const PREGNANCY_SYMPTOMS = [
  'nausea',
  'fatigue',
  'back_pain',
  'heartburn',
  'swelling',
  'headache',
  'cramps',
  'baby_moved',
];
export const MOODS = ['happy', 'sensitive', 'sad', 'anxious'];

const CUSTOM_PREFIX = 'custom:';

/** Longest name she can give a symptom; keeps chips on one line. */
export const CUSTOM_LABEL_MAX = 32;

export function customKey(id: string): string {
  return CUSTOM_PREFIX + id;
}

export function isCustomKey(key: string): boolean {
  return key.startsWith(CUSTOM_PREFIX);
}

export function customIdOf(key: string): string | null {
  return isCustomKey(key) ? key.slice(CUSTOM_PREFIX.length) : null;
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * The name to show for a symptom key. A custom key whose symptom is
 * missing (restored logs without it, say) gets a neutral name rather
 * than the raw id.
 */
export function symptomLabel(key: string, t: Translate, customLabels: ReadonlyMap<string, string>): string {
  const id = customIdOf(key);
  if (id !== null) return customLabels.get(id) ?? t('symptoms.unknown');
  return t(`day_details.symptom_${key}`, { defaultValue: key });
}

/**
 * Symptom keys by how many days each was logged, most first; ties keep
 * the order they were first seen. Built-in and custom alike.
 */
export function mostLoggedSymptoms(logs: { symptoms: string[] | null }[], limit: number): { key: string; days: number }[] {
  const counts = new Map<string, number>();
  for (const log of logs) {
    for (const key of new Set(log.symptoms ?? [])) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, days]) => ({ key, days }));
}

/** Trims and collapses spaces; null when nothing is left. */
export function cleanLabel(input: string): string | null {
  const label = input.replace(/\s+/g, ' ').trim().slice(0, CUSTOM_LABEL_MAX).trim();
  return label.length > 0 ? label : null;
}

/** Whether a name is already taken, ignoring case and accents. */
export function isDuplicateLabel(label: string, takenLabels: string[]): boolean {
  const norm = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase().trim();
  const wanted = norm(label);
  return takenLabels.some((l) => norm(l) === wanted);
}

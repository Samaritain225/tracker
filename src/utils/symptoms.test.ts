/**
 * Tests for symptom keys, names and the custom-symptom helpers.
 */

import { buildCsv } from './csv';
import {
  cleanLabel,
  customIdOf,
  customKey,
  isDuplicateLabel,
  mostLoggedSymptoms,
  symptomLabel,
} from './symptoms';
import en from '@/i18n/locales/en.json';
import fr from '@/i18n/locales/fr.json';

const t = (key: string, options?: Record<string, unknown>) =>
  key === 'day_details.symptom_cramps' ? 'Cramps' : ((options?.defaultValue as string) ?? key);

describe('symptom names', () => {
  const labels = new Map([['c1', 'Migraine']]);

  it('names built-in, custom and missing symptoms', () => {
    expect(symptomLabel('cramps', t, labels)).toBe('Cramps');
    expect(symptomLabel(customKey('c1'), t, labels)).toBe('Migraine');
    expect(symptomLabel(customKey('gone'), t, labels)).toBe('symptoms.unknown');
  });

  it('round-trips a custom key', () => {
    expect(customIdOf(customKey('abc'))).toBe('abc');
    expect(customIdOf('cramps')).toBeNull();
  });
});

describe('cleanLabel and isDuplicateLabel', () => {
  it('trims, collapses spaces and refuses an empty name', () => {
    expect(cleanLabel('  Lower   back  ')).toBe('Lower back');
    expect(cleanLabel('   ')).toBeNull();
    expect(cleanLabel('x'.repeat(50))).toHaveLength(32);
  });

  it('ignores case and accents', () => {
    expect(isDuplicateLabel('nausée', ['Nausee'])).toBe(true);
    expect(isDuplicateLabel('Migraine', ['Headache'])).toBe(false);
  });
});

describe('mostLoggedSymptoms', () => {
  it('counts days, most first, built-in and custom alike', () => {
    const logs = [
      { symptoms: ['cramps', 'custom:c1'] },
      { symptoms: ['custom:c1'] },
      { symptoms: null },
      { symptoms: ['custom:c1', 'custom:c1'] },
    ];
    expect(mostLoggedSymptoms(logs, 5)).toEqual([
      { key: 'custom:c1', days: 3 },
      { key: 'cramps', days: 1 },
    ]);
  });
});

describe('CSV export', () => {
  it('writes her own symptoms by name and built-in ones by key', () => {
    const csv = buildCsv(
      [],
      [{ id: 'l', date: '2026-06-01', flow: null, symptoms: ['cramps', 'custom:c1'], mood: null, notes: null, createdAt: 0, updatedAt: 0 }],
      new Map([['c1', 'Migraine']]),
    );
    expect(csv.split('\n')[1]).toBe('2026-06-01,,,,cramps;Migraine,,');
  });
});

describe('symptoms text', () => {
  it.each([
    ['en', en],
    ['fr', fr],
  ] as const)('has every %s key', (_language, locale) => {
    const keys = (locale as unknown as { symptoms: Record<string, string> }).symptoms;
    for (const key of ['section', 'title', 'intro', 'add_own', 'add', 'add_placeholder', 'duplicate', 'unknown', 'empty', 'hide_note', 'settings_note', 'rename', 'shown']) {
      expect(keys[key]?.length ?? 0).toBeGreaterThan(0);
    }
  });
});

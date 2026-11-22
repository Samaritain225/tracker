/**
 * Tests for "How Lumi works it out": the numbers she is shown, and the
 * text for every key the screen can ask for.
 */

import { explainSections } from './explain';
import type { ExplainSection, SectionId } from './explain';
import en from '@/i18n/locales/en.json';
import fr from '@/i18n/locales/fr.json';

const base = {
  periods: [
    { startDate: '2026-08-01', endDate: '2026-08-05' },
    { startDate: '2026-08-29', endDate: '2026-09-02' },
    { startDate: '2026-09-28', endDate: '2026-10-02' },
  ],
  logs: [],
  pregnancies: [],
  fallbackCycleDays: 28,
  periodDurationDays: 5,
  islamicOn: false,
  todayISO: '2026-10-10',
};

const find = (sections: ExplainSection[], id: SectionId) => sections.find((s) => s.id === id)!;

describe('explainSections', () => {
  it('shows her own cycles, usual length and next period', () => {
    const cycle = find(explainSections(base), 'cycle');
    expect(cycle.yours).toEqual({
      key: 'how.cycle_yours',
      values: { gaps: '28, 30', count: 2, length: 29 },
      dates: ['2026-09-28', '2026-10-27'],
    });
  });

  it('says when it falls back to the Settings length', () => {
    const cycle = find(explainSections({ ...base, periods: base.periods.slice(0, 1) }), 'cycle');
    expect(cycle.yours?.key).toBe('how.cycle_yours_fallback');
    expect(find(explainSections({ ...base, periods: [] }), 'cycle').yours?.key).toBe('how.cycle_yours_none');
  });

  it('places ovulation and the fertile days the way the calendar does', () => {
    const ovulation = find(explainSections(base), 'ovulation');
    expect(ovulation.yours?.dates).toEqual(['2026-10-13', '2026-10-10', '2026-10-17']);
  });

  it('counts the days late only once the expected day has passed', () => {
    expect(find(explainSections(base), 'late').yours).toBeNull();
    const late = find(explainSections({ ...base, todayISO: '2026-11-05' }), 'late');
    expect(late.yours).toMatchObject({ values: { count: 9 }, dates: ['2026-10-27'] });
  });

  it('explains an adjusted due date with her numbers', () => {
    const pregnancy = find(
      explainSections({
        ...base,
        todayISO: '2026-11-22',
        pregnancies: [{ id: 'p', lastPeriodDate: '2026-10-13', scanDueDate: null, endedOn: null, outcome: null, cycleLengthDays: 35 }],
      }),
      'pregnancy',
    );
    expect(pregnancy.yours).toEqual({
      key: 'how.pregnancy_yours_adjusted',
      values: { weeks: 4, days: 5, length: 35, shift: 7 },
      dates: ['2026-10-13', '2027-07-27'],
    });
  });

  it('only explains Ramadan when the Islamic option is on', () => {
    expect(explainSections(base).some((s) => s.id === 'ramadan')).toBe(false);
    expect(explainSections({ ...base, islamicOn: true }).some((s) => s.id === 'ramadan')).toBe(true);
  });
});

describe('how text', () => {
  it.each([
    ['en', en],
    ['fr', fr],
  ] as const)('has %s text for every key the screen can show', (_language, locale) => {
    const how = (locale as unknown as { how: Record<string, string> }).how;
    const has = (key: string) =>
      (how[key] ?? how[`${key}_one`] ?? '').length > 0 && (how[`${key}_one`] === undefined || (how[`${key}_other`] ?? '').length > 0);
    const keys = new Set<string>();
    const scenarios = [
      base,
      { ...base, periods: [] },
      { ...base, periods: base.periods.slice(0, 1) },
      { ...base, todayISO: '2026-11-05', islamicOn: true },
      { ...base, pregnancies: [{ id: 'p', lastPeriodDate: '2026-09-28', scanDueDate: null, endedOn: null, outcome: null }] },
      { ...base, pregnancies: [{ id: 'p', lastPeriodDate: '2026-09-28', scanDueDate: '2027-07-01', endedOn: null, outcome: null }] },
      { ...base, pregnancies: [{ id: 'p', lastPeriodDate: '2026-09-28', scanDueDate: null, endedOn: null, outcome: null, cycleLengthDays: 33 }] },
    ];
    for (const s of scenarios) {
      for (const section of explainSections(s)) {
        keys.add(`title_${section.id}`);
        for (const line of [section.rule, section.yours, section.limit]) if (line) keys.add(line.key.replace('how.', ''));
      }
    }
    keys.add('cycle_limit_variance');
    for (const key of [...keys, 'title', 'intro', 'link', 'settings_note', 'label_yours']) {
      expect([key, has(key)]).toEqual([key, true]);
    }
  });
});

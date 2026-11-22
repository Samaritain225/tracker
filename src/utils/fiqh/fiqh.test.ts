/**
 * Tests for the Islamic option's rules, counts and Ramadan maths.
 */

import { bleedingDates, bleedingRuns, islamicStatus, purityBefore } from './bleeding';
import { rulesFor } from './index';
import { MALIKI } from './maliki';
import { missedFastBleedingDates, ramadanRanges, suggestedMissedFasts } from './ramadan';
import en from '@/i18n/locales/en.json';
import fr from '@/i18n/locales/fr.json';

const DEFAULT = 5;

function dates(...isos: string[]): Set<string> {
  return new Set(isos);
}

describe('rulesFor and the Maliki values', () => {
  it('returns nothing when the option is off', () => {
    expect(rulesFor(null)).toBeNull();
    expect(rulesFor(undefined)).toBeNull();
    expect(rulesFor('unknown')).toBeNull();
  });

  it('carries the limits verified in the Risala', () => {
    expect(rulesFor('maliki')).toBe(MALIKI);
    expect(MALIKI).toMatchObject({ haidMaxDays: 15, habitPrecautionDays: 3, purityMinDays: 15, nifasMaxDays: 60 });
  });
});

describe('bleedingDates and bleedingRuns', () => {
  it('uses the days the calendar draws for a period, not a 15-day window', () => {
    // An open period with no flow logged counts the settings default.
    const days = bleedingDates([{ startDate: '2026-11-01', endDate: null }], new Set(), DEFAULT);
    expect([...days].sort()).toEqual(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']);
  });

  it('adds logged flow days and leaves out bleeding during a pregnancy', () => {
    const pregnancy = { lastPeriodDate: '2026-07-04', endedOn: null, outcome: null };
    const days = bleedingDates([], dates('2026-06-01', '2026-08-15'), DEFAULT, [pregnancy]);
    expect([...days]).toEqual(['2026-06-01']);
  });

  it('bridges a single unlogged day but not two', () => {
    expect(bleedingRuns(dates('2026-11-01', '2026-11-03'))).toEqual([{ start: '2026-11-01', end: '2026-11-03' }]);
    expect(bleedingRuns(dates('2026-11-01', '2026-11-04'))).toEqual([
      { start: '2026-11-01', end: '2026-11-01' },
      { start: '2026-11-04', end: '2026-11-04' },
    ]);
  });

  it('counts whole days of purity between runs', () => {
    const runs = [
      { start: '2026-10-01', end: '2026-10-05' },
      { start: '2026-10-21', end: '2026-10-25' },
    ];
    expect(purityBefore(runs[0], runs)).toBeNull();
    expect(purityBefore(runs[1], runs)).toBe(15); // 6th to 20th October
  });
});

describe('islamicStatus', () => {
  const base = {
    rules: MALIKI,
    mode: 'cycle' as const,
    periods: [] as { startDate: string; endDate: string | null }[],
    flowDates: new Set<string>(),
    defaultDurationDays: DEFAULT,
    pregnancies: [] as { lastPeriodDate: string; endedOn: string | null; outcome: string | null }[],
    todayISO: '2026-11-22',
  };

  it('says nothing when the option is off', () => {
    expect(islamicStatus({ ...base, rules: null, flowDates: dates('2026-11-22') })).toEqual({ kind: 'none' });
  });

  it('counts the day of bleeding', () => {
    const status = islamicStatus({ ...base, periods: [{ startDate: '2026-11-20', endDate: null }] });
    expect(status).toEqual({ kind: 'bleeding', day: 3, notes: [] });
  });

  it('notes bleeding past 15 days on day 16, not day 15', () => {
    const run = (n: number) =>
      new Set(Array.from({ length: n }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`));
    const day15 = islamicStatus({ ...base, flowDates: run(15), todayISO: '2026-11-15' });
    const day16 = islamicStatus({ ...base, flowDates: run(16), todayISO: '2026-11-16' });
    expect(day15).toEqual({ kind: 'bleeding', day: 15, notes: [] });
    expect(day16).toEqual({ kind: 'bleeding', day: 16, notes: ['beyond_haid_max'] });
  });

  it('notes purity shorter than 15 days, at 14 but not 15', () => {
    const previous = { startDate: '2026-11-01', endDate: '2026-11-05' };
    const after14 = islamicStatus({
      ...base,
      periods: [previous, { startDate: '2026-11-20', endDate: null }],
      todayISO: '2026-11-20',
    });
    const after15 = islamicStatus({
      ...base,
      periods: [previous, { startDate: '2026-11-21', endDate: null }],
      todayISO: '2026-11-21',
    });
    expect(after14).toEqual({ kind: 'bleeding', day: 1, notes: ['short_purity'] });
    expect(after15).toEqual({ kind: 'bleeding', day: 1, notes: [] });
  });

  it('shows days of purity for 15 days after bleeding, then nothing', () => {
    const periods = [{ startDate: '2026-11-01', endDate: '2026-11-05' }];
    expect(islamicStatus({ ...base, periods, todayISO: '2026-11-13' })).toEqual({ kind: 'purity', days: 8 });
    expect(islamicStatus({ ...base, periods, todayISO: '2026-11-21' })).toEqual({ kind: 'none' });
  });

  it('only quotes during a pregnancy, and only when bleeding is logged', () => {
    const pregnant = { ...base, mode: 'pregnant' as const };
    expect(islamicStatus({ ...pregnant, flowDates: dates('2026-11-22') })).toEqual({ kind: 'pregnancy_bleeding' });
    expect(islamicStatus(pregnant)).toEqual({ kind: 'none' });
  });

  it('says nothing at all in recovery after a loss', () => {
    const status = islamicStatus({
      ...base,
      mode: 'recovery',
      recoveryOutcome: 'loss',
      flowDates: dates('2026-11-22'),
      pregnancies: [{ lastPeriodDate: '2026-09-01', endedOn: '2026-11-10', outcome: 'loss' }],
    });
    expect(status).toEqual({ kind: 'none' });
  });

  describe('after a birth', () => {
    const birth = { lastPeriodDate: '2026-01-10', endedOn: '2026-10-01', outcome: 'birth' };

    it('shows the nifas reference in recovery, noting bleeding only past day 60', () => {
      const recovery = { ...base, mode: 'recovery' as const, recoveryOutcome: 'birth' as const, pregnancies: [birth] };
      expect(islamicStatus({ ...recovery, flowDates: dates('2026-11-30'), todayISO: '2026-11-30' })).toEqual({
        kind: 'nifas',
        daysSinceBirth: 60,
        bleedingToday: true,
        notes: [],
      });
      expect(islamicStatus({ ...recovery, flowDates: dates('2026-12-01'), todayISO: '2026-12-01' })).toEqual({
        kind: 'nifas',
        daysSinceBirth: 61,
        bleedingToday: true,
        notes: ['beyond_nifas_max'],
      });
    });

    it('treats a period logged within 60 days of the birth against nifas, not haid', () => {
      const status = islamicStatus({
        ...base,
        pregnancies: [birth],
        periods: [{ startDate: '2026-11-15', endDate: null }],
        todayISO: '2026-11-17',
      });
      expect(status).toMatchObject({ kind: 'nifas', bleedingToday: true, notes: [] });
    });

    it('returns to the haid count for bleeding that starts after day 60', () => {
      const status = islamicStatus({
        ...base,
        pregnancies: [birth],
        periods: [{ startDate: '2026-12-05', endDate: null }],
        todayISO: '2026-12-06',
      });
      expect(status).toEqual({ kind: 'bleeding', day: 2, notes: [] });
    });
  });
});

describe('Ramadan', () => {
  it('finds each Ramadan under the Umm al-Qura calendar', () => {
    expect(ramadanRanges('2025-01-01', '2027-12-31')).toEqual([
      { hijriYear: 1446, start: '2025-03-01', end: '2025-03-29' },
      { hijriYear: 1447, start: '2026-02-18', end: '2026-03-19' },
      { hijriYear: 1448, start: '2027-02-08', end: '2027-03-08' },
    ]);
  });

  it('includes a Ramadan in full when the span starts inside it', () => {
    expect(ramadanRanges('2026-03-10', '2026-04-01')).toEqual([
      { hijriYear: 1447, start: '2026-02-18', end: '2026-03-19' },
    ]);
  });

  it('suggests the Ramadan days that fell on bleeding, up to today', () => {
    const range = { hijriYear: 1447, start: '2026-02-18', end: '2026-03-19' };
    const bleeding = dates('2026-02-17', '2026-02-20', '2026-02-21', '2026-03-19', '2026-03-20');
    expect(suggestedMissedFasts(range, bleeding, '2026-12-01')).toEqual(['2026-02-20', '2026-02-21', '2026-03-19']);
    expect(suggestedMissedFasts(range, bleeding, '2026-02-20')).toEqual(['2026-02-20']);
  });

  it('leaves bleeding after a loss out of the suggestion, up to the next period', () => {
    const loss = { lastPeriodDate: '2026-01-05', endedOn: '2026-02-15', outcome: 'loss' };
    const bleeding = missedFastBleedingDates(
      [{ startDate: '2026-03-10', endDate: '2026-03-14' }],
      dates('2026-02-20', '2026-02-21'),
      DEFAULT,
      [loss],
    );
    expect(bleeding.has('2026-02-20')).toBe(false);
    expect(bleeding.has('2026-03-10')).toBe(true);
  });
});

describe('Islamic option text', () => {
  it.each([
    ['en', en],
    ['fr', fr],
  ] as const)('has %s text for every cited Maliki reference', (_language, locale) => {
    const topics = (locale as { islamic: { maliki: Record<string, string> } }).islamic.maliki;
    for (const topic of Object.keys(MALIKI.citations)) {
      expect(topics[`topic_${topic}`]?.length ?? 0).toBeGreaterThan(10);
    }
  });
});

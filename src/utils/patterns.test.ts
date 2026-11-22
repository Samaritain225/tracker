/**
 * Tests for patterns in her own logs.
 */

import { BEFORE_DAYS, completedCycles, findPatterns, windowOf } from './patterns';

const DEFAULT = 5;
const periods = [
  { startDate: '2026-01-01', endDate: '2026-01-05' },
  { startDate: '2026-01-29', endDate: '2026-02-02' },
  { startDate: '2026-02-26', endDate: '2026-03-02' },
  { startDate: '2026-03-26', endDate: null },
];

function log(date: string, symptoms: string[] = [], mood: string | null = null) {
  return { date, symptoms, mood };
}

describe('completedCycles and windowOf', () => {
  it('only counts cycles a later period closed', () => {
    expect(completedCycles(periods, new Set(), DEFAULT).map((c) => c.start)).toEqual([
      '2026-01-01',
      '2026-01-29',
      '2026-02-26',
    ]);
  });

  it('leaves out a gap holding a pregnancy, or one too long to be a cycle', () => {
    const spans = [{ start: '2026-01-29', end: '2026-02-20' }];
    expect(completedCycles(periods, new Set(), DEFAULT, spans)).toHaveLength(2);
    const long = [{ startDate: '2026-01-01', endDate: null }, { startDate: '2026-05-01', endDate: null }];
    expect(completedCycles(long, new Set(), DEFAULT)).toEqual([]);
  });

  it(`places days in the period, the ${BEFORE_DAYS} days before the next, or the rest`, () => {
    const [cycle] = completedCycles(periods, new Set(), DEFAULT);
    expect(windowOf('2026-01-05', cycle)).toBe('period');
    expect(windowOf('2026-01-06', cycle)).toBe('rest');
    expect(windowOf('2026-01-25', cycle)).toBe('rest');
    expect(windowOf('2026-01-26', cycle)).toBe('before');
    expect(windowOf('2026-01-28', cycle)).toBe('before');
  });
});

describe('findPatterns', () => {
  const base = { periods, flowDates: new Set<string>(), defaultDurationDays: DEFAULT };

  it('needs two completed cycles', () => {
    const result = findPatterns({ ...base, periods: periods.slice(0, 2), logs: [] });
    expect(result).toEqual({ status: 'not_enough', cycles: 1 });
  });

  it('finds a symptom that keeps coming before her period', () => {
    const logs = [
      log('2026-01-27', ['headache']),
      log('2026-01-28', ['headache']),
      log('2026-02-25', ['headache']),
      log('2026-03-24', ['headache']),
      log('2026-02-10', ['headache']),
    ];
    expect(findPatterns({ ...base, logs })).toEqual({
      status: 'found',
      cycles: 3,
      patterns: [{ kind: 'symptom', key: 'headache', window: 'before', days: 4, total: 5 }],
    });
  });

  it('finds moods too, and custom symptoms like any other', () => {
    const logs = ['2026-01-02', '2026-01-03', '2026-01-30', '2026-02-27'].map((d) => log(d, ['custom:c1'], 'sad'));
    const result = findPatterns({ ...base, logs });
    expect(result.status === 'found' && result.patterns.map((p) => `${p.kind}:${p.key}:${p.window}`)).toEqual([
      'symptom:custom:c1:period',
      'mood:sad:period',
    ]);
  });

  it('ignores a symptom with too few days, in one cycle only, or spread out', () => {
    const fewDays = ['2026-01-02', '2026-01-30', '2026-02-27'].map((d) => log(d, ['acne']));
    const oneCycle = ['2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05'].map((d) => log(d, ['bloating']));
    const spread = ['2026-01-02', '2026-01-10', '2026-01-15', '2026-02-10', '2026-02-27'].map((d) => log(d, ['fatigue']));
    expect(findPatterns({ ...base, logs: [...fewDays, ...oneCycle, ...spread] })).toEqual({ status: 'none', cycles: 3 });
  });

  it('counts a day once even if a symptom is listed twice', () => {
    const logs = ['2026-01-02', '2026-01-30', '2026-02-27'].map((d) => log(d, ['cramps', 'cramps']));
    expect(findPatterns({ ...base, logs }).status).toBe('none');
  });

  it('leaves out days in the open cycle', () => {
    const logs = ['2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30'].map((d) => log(d, ['cramps']));
    expect(findPatterns({ ...base, logs }).status).toBe('none');
  });
});

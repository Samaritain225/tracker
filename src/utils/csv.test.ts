/**
 * Tests for the spreadsheet export.
 */

import type { DailyLog, Period } from '@/db/schema';
import { buildCsv } from './csv';

const periods: Period[] = [
  { id: 'p1', startDate: '2026-10-21', endDate: '2026-10-26', notes: null, createdAt: 1 },
  { id: 'p2', startDate: '2026-11-18', endDate: null, notes: null, createdAt: 2 },
];

const logs: DailyLog[] = [
  {
    id: 'd1',
    date: '2026-10-21',
    flow: 'heavy',
    symptoms: ['cramps', 'fatigue'],
    mood: 'sad',
    notes: 'Said "ouch", twice',
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: 'd2',
    date: '2026-11-05',
    flow: null,
    symptoms: ['headache'],
    mood: null,
    notes: null,
    createdAt: 1,
    updatedAt: 1,
  },
];

describe('buildCsv', () => {
  const lines = buildCsv(periods, logs).trimEnd().split('\n');

  it('includes a period end column', () => {
    expect(lines[0]).toBe('Date,Type,Period End,Flow,Symptoms,Mood,Notes');
  });

  it('writes one row per day, in date order, with end dates on period starts', () => {
    expect(lines.slice(1)).toEqual([
      '2026-10-21,Period Start,2026-10-26,heavy,cramps;fatigue,sad,"Said ""ouch"", twice"',
      '2026-11-05,,,,headache,,',
      '2026-11-18,Period Start,,,,,',
    ]);
  });
});

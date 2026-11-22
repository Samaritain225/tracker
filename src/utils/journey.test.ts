/**
 * Tests for the Journey timeline.
 */

import { buildJourney, summarizeWeeks } from './journey';

const pregnancy = {
  lastPeriodDate: '2026-07-04',
  scanDueDate: null,
  endedOn: null,
  outcome: null,
};

describe('summarizeWeeks', () => {
  it('groups logged symptoms by gestational week, most frequent first', () => {
    // Week 18 runs 2026-11-07 to 2026-11-13 (126 to 132 days in).
    const logs = [
      { date: '2026-11-07', symptoms: ['fatigue', 'back_pain'] },
      { date: '2026-11-08', symptoms: ['fatigue'] },
      { date: '2026-11-09', symptoms: [] },
      { date: '2026-11-14', symptoms: ['nausea'] },
    ];
    expect(summarizeWeeks(pregnancy, logs)).toEqual([
      {
        week: 18,
        startDate: '2026-11-07',
        daysLogged: 2,
        symptoms: [
          { key: 'fatigue', days: 2 },
          { key: 'back_pain', days: 1 },
        ],
      },
      { week: 19, startDate: '2026-11-14', daysLogged: 1, symptoms: [{ key: 'nausea', days: 1 }] },
    ]);
  });

  it('ignores logs from before the pregnancy and after it ended', () => {
    const ended = { ...pregnancy, endedOn: '2026-11-10' };
    const logs = [
      { date: '2026-07-01', symptoms: ['cramps'] },
      { date: '2026-11-11', symptoms: ['fatigue'] },
    ];
    expect(summarizeWeeks(ended, logs)).toEqual([]);
  });
});

describe('buildJourney', () => {
  const visits = [
    { id: 'v-past', date: '2026-10-28' },
    { id: 'v-next', date: '2026-11-26' },
  ];
  const moments = [
    { id: 'm-test', date: '2026-08-10', createdAt: 1 },
    { id: 'm-kick', date: '2026-11-15', createdAt: 2 },
    { id: 'm-note', date: '2026-11-15', createdAt: 3 },
  ];

  it('runs newest first, with upcoming visits above today', () => {
    const journey = buildJourney(pregnancy, visits, moments, [], '2026-11-22');
    expect(journey.map((e) => [e.type, e.date])).toEqual([
      ['visit', '2026-11-26'],
      ['today', '2026-11-22'],
      ['moment', '2026-11-15'],
      ['moment', '2026-11-15'],
      ['visit', '2026-10-28'],
      ['moment', '2026-08-10'],
    ]);
    expect(journey[0]).toMatchObject({ type: 'visit', upcoming: true });
    expect(journey[4]).toMatchObject({ type: 'visit', upcoming: false });
  });

  it('shows the later of two same-day moments first', () => {
    const journey = buildJourney(pregnancy, [], moments, [], '2026-11-22');
    const sameDay = journey.filter((e) => e.date === '2026-11-15');
    expect(sameDay.map((e) => e.type === 'moment' && e.moment.id)).toEqual(['m-note', 'm-kick']);
  });

  it('ends an ended pregnancy with its ending instead of today', () => {
    const ended = { ...pregnancy, endedOn: '2027-04-08', outcome: 'birth' };
    const journey = buildJourney(ended, [], [], [], '2027-05-01');
    expect(journey).toEqual([{ type: 'ended', date: '2027-04-08', outcome: 'birth' }]);
  });
});

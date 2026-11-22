/**
 * Tests for the doctor summary: the numbers, the sections, and the page.
 */

import { buildDoctorSummary, summaryHtml, summarySections } from './summary';
import en from '@/i18n/locales/en.json';
import fr from '@/i18n/locales/fr.json';

const TODAY = '2026-11-22';
const periods = [
  { startDate: '2025-10-01', endDate: '2025-10-05' }, // before the 12 months
  { startDate: '2026-08-01', endDate: '2026-08-05' },
  { startDate: '2026-08-29', endDate: '2026-09-02' },
  { startDate: '2026-09-28', endDate: null },
  { startDate: '2026-11-20', endDate: null },
];
const log = (date: string, symptoms: string[] = [], mood: string | null = null, flow: string | null = null) => ({
  date,
  flow,
  symptoms,
  mood,
});

function build(extra: Partial<Parameters<typeof buildDoctorSummary>[0]> = {}) {
  return buildDoctorSummary({
    periods,
    logs: [log('2026-08-02', ['cramps', 'custom:c1'], 'sad'), log('2026-08-30', ['cramps'])],
    pregnancies: [],
    visits: [],
    defaultDurationDays: 5,
    todayISO: TODAY,
    ...extra,
  });
}

describe('buildDoctorSummary', () => {
  it('covers the last 12 months, newest period first', () => {
    const s = build();
    expect(s.from).toBe('2025-11-22');
    expect(s.periods.map((p) => p.start)).toEqual(['2026-11-20', '2026-09-28', '2026-08-29', '2026-08-01']);
  });

  it('gives each closed cycle its length and leaves too-long gaps out of the average', () => {
    const s = build();
    expect(s.periods.map((p) => p.cycleLength)).toEqual([null, 53, 30, 28]);
    expect(s.averageCycle).toBe(37);
    expect(s.cycleRange).toEqual([28, 53]);
  });

  it('marks a period still going, and one whose length is only the default', () => {
    const s = build();
    expect(s.periods[0]).toMatchObject({ days: null, estimated: false });
    expect(s.periods[1]).toMatchObject({ days: 5, estimated: true });
    expect(s.averagePeriod).toBe(5);
  });

  it('counts symptoms and moods, leaving out days in a pregnancy', () => {
    const s = build({
      logs: [log('2026-08-02', ['cramps'], 'sad'), log('2026-10-10', ['nausea'], 'happy')],
      pregnancies: [{ id: 'p', lastPeriodDate: '2026-09-28', scanDueDate: null, endedOn: null, outcome: null }],
    });
    expect(s.symptoms).toEqual([{ key: 'cramps', days: 1 }]);
    expect(s.moods).toEqual([{ key: 'sad', days: 1 }]);
  });

  it('adds the pregnancy in progress with its visits, without their notes', () => {
    const s = build({
      pregnancies: [{ id: 'p', lastPeriodDate: '2026-09-28', scanDueDate: null, endedOn: null, outcome: null }],
      visits: [
        { pregnancyId: 'p', date: '2026-11-01', kind: 'checkup', weightKg: 61.5, systolic: 110, diastolic: 70, notes: 'private' } as never,
        { pregnancyId: 'other', date: '2026-11-02', kind: 'checkup', weightKg: null, systolic: null, diastolic: null },
      ],
    });
    expect(s.pregnancy).toEqual({
      dueDate: '2027-07-05',
      endedOn: null,
      outcome: null,
      age: { weeks: 7, days: 6 },
      visits: [{ date: '2026-11-01', kind: 'checkup', weightKg: 61.5, systolic: 110, diastolic: 70 }],
    });
  });

  it('has no pregnancy section for one that ended before the 12 months', () => {
    const s = build({
      pregnancies: [{ id: 'p', lastPeriodDate: '2024-01-01', scanDueDate: null, endedOn: '2024-10-01', outcome: 'birth' }],
    });
    expect(s.pregnancy).toBeNull();
  });
});

describe('summarySections and summaryHtml', () => {
  const t = (key: string, o?: Record<string, unknown>) => (o ? `${key}${JSON.stringify(o)}` : key);
  const labelOf = (key: string) => (key === 'custom:c1' ? '<Migraine & co>' : key);

  it('lists the sections in order and names her own symptoms', () => {
    const sections = summarySections(build(), t, labelOf, (iso) => iso);
    expect(sections.map((s) => s.title)).toEqual(['summary.overview', 'summary.periods', 'summary.symptoms_moods']);
    expect(sections[2].rows?.map((r) => r.label)).toContain('<Migraine & co>');
  });

  it('escapes everything on the page', () => {
    const html = summaryHtml('T', 'S', summarySections(build(), t, labelOf, (iso) => iso), 'F');
    expect(html).toContain('&lt;Migraine &amp; co&gt;');
    expect(html).not.toContain('<Migraine');
  });

  it.each([
    ['en', en],
    ['fr', fr],
  ] as const)('has %s text for every key the summary and patterns use', (_language, locale) => {
    const l = locale as unknown as { summary: Record<string, string>; patterns: Record<string, string> };
    for (const key of ['title', 'intro', 'share', 'doc_title', 'made_on', 'footer', 'overview', 'covers', 'periods_logged', 'average_cycle', 'average_with_range', 'average_period', 'last_period', 'periods', 'started', 'period_length', 'cycle_length', 'ongoing', 'not_logged', 'symptoms_moods', 'days_one', 'days_other', 'pregnancy', 'due_date', 'weeks_today', 'weeks_days', 'birth_on', 'ended_on', 'visit_date', 'visit_type', 'weight', 'blood_pressure', 'kg', 'settings_note']) {
      expect(l.summary[key]?.length ?? 0).toBeGreaterThan(0);
    }
    for (const key of ['title', 'sentence', 'during_period', 'before_period_one', 'before_period_other', 'mood', 'not_enough_one', 'not_enough_other', 'none_one', 'none_other', 'note']) {
      expect(l.patterns[key]?.length ?? 0).toBeGreaterThan(0);
    }
  });
});

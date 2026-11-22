/**
 * The summary she can show a doctor: the last 12 months of her cycles,
 * periods, symptoms, moods and patterns, plus a short pregnancy section
 * when one is in progress or recent.
 *
 * Built in two pure steps so both are tested: the numbers
 * (buildDoctorSummary), then the sections of text (summarySections),
 * which the screen and the PDF both render, so the preview she sees is
 * exactly what she shares.
 *
 * Left out on purpose: notes, photos, the star sign and everything from
 * the Islamic option. Dates are always Gregorian, which is what a doctor
 * reads, whatever calendar the app shows.
 */

import {
  computeAveragePeriodLength,
  computePeriodDuration,
  isPeriodOngoing,
} from './cycle';
import { addDays, daysBetween, parseISODate, toISODate } from './date';
import { completedCycles, findPatterns, patternSentence } from './patterns';
import type { PatternResult } from './patterns';
import { effectiveDueDate, gestationalAge, pregnancySpans } from './pregnancy';
import { mostLoggedSymptoms } from './symptoms';

/** How far back the summary looks. */
export const SUMMARY_DAYS = 365;
/** How many symptoms and moods it lists. */
const TOP_SYMPTOMS = 8;

type PeriodLike = { startDate: string; endDate: string | null };
type LogLike = { date: string; flow: string | null; symptoms: string[] | null; mood: string | null };
type PregnancyLike = {
  id: string;
  lastPeriodDate: string;
  scanDueDate: string | null;
  endedOn: string | null;
  outcome: string | null;
};
type VisitLike = {
  pregnancyId: string;
  date: string;
  kind: string;
  weightKg: number | null;
  systolic: number | null;
  diastolic: number | null;
};

export type SummaryPeriod = {
  start: string;
  /** Days of bleeding; null while it is still going. */
  days: number | null;
  /** True when the length is only the settings default, not something she logged. */
  estimated: boolean;
  /** Days to the next period, when that gap is a completed cycle. */
  cycleLength: number | null;
};

export type DoctorSummary = {
  from: string;
  to: string;
  /** Newest first. */
  periods: SummaryPeriod[];
  averageCycle: number | null;
  cycleRange: [number, number] | null;
  averagePeriod: number | null;
  symptoms: { key: string; days: number }[];
  moods: { key: string; days: number }[];
  patterns: PatternResult;
  pregnancy: {
    dueDate: string;
    endedOn: string | null;
    outcome: string | null;
    /** Weeks and days today, while it is in progress. */
    age: { weeks: number; days: number } | null;
    visits: { date: string; kind: string; weightKg: number | null; systolic: number | null; diastolic: number | null }[];
  } | null;
};

export function buildDoctorSummary(input: {
  periods: PeriodLike[];
  logs: LogLike[];
  pregnancies: PregnancyLike[];
  visits: VisitLike[];
  defaultDurationDays: number;
  todayISO: string;
}): DoctorSummary {
  const { todayISO, defaultDurationDays } = input;
  const from = toISODate(addDays(parseISODate(todayISO), -SUMMARY_DAYS));
  const inRange = (date: string) => date >= from && date <= todayISO;
  const spans = pregnancySpans(input.pregnancies);
  const inPregnancy = (date: string) =>
    input.pregnancies.some((p) => date > p.lastPeriodDate && (p.endedOn === null || date <= p.endedOn));

  const flowDates = new Set(input.logs.filter((l) => l.flow).map((l) => l.date));
  const periods = input.periods.filter((p) => inRange(p.startDate));
  const cycles = completedCycles(input.periods, flowDates, defaultDurationDays, spans).filter((c) =>
    inRange(c.start),
  );
  const cycleLengthOf = new Map(
    cycles.map((c) => [c.start, daysBetween(parseISODate(c.start), parseISODate(c.next))]),
  );

  const summaryPeriods: SummaryPeriod[] = [...periods]
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .map((p) => {
      const ongoing = isPeriodOngoing(p, todayISO) && !p.endDate;
      const duration = computePeriodDuration(p, flowDates, defaultDurationDays);
      return {
        start: p.startDate,
        days: ongoing ? null : duration.days,
        estimated: !ongoing && duration.source === 'default',
        cycleLength: cycleLengthOf.get(p.startDate) ?? null,
      };
    });

  const lengths = [...cycleLengthOf.values()];
  const averageCycle = lengths.length > 0 ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) : null;
  const cycleRange: [number, number] | null = lengths.length > 0 ? [Math.min(...lengths), Math.max(...lengths)] : null;

  const cycleLogs = input.logs.filter((l) => inRange(l.date) && !inPregnancy(l.date));
  const moodCounts = new Map<string, number>();
  for (const l of cycleLogs) if (l.mood) moodCounts.set(l.mood, (moodCounts.get(l.mood) ?? 0) + 1);

  return {
    from,
    to: todayISO,
    periods: summaryPeriods,
    averageCycle,
    cycleRange,
    averagePeriod: computeAveragePeriodLength(periods, flowDates, defaultDurationDays, todayISO),
    symptoms: mostLoggedSymptoms(cycleLogs, TOP_SYMPTOMS),
    moods: [...moodCounts.entries()].sort((a, b) => b[1] - a[1]).map(([key, days]) => ({ key, days })),
    patterns: findPatterns({ periods, logs: cycleLogs, flowDates, defaultDurationDays, spans }),
    pregnancy: pregnancySection(input.pregnancies, input.visits, from, todayISO),
  };
}

/** The pregnancy in progress, or the latest one that ended inside the summary's year. */
function pregnancySection(
  pregnancies: PregnancyLike[],
  visits: VisitLike[],
  from: string,
  todayISO: string,
): DoctorSummary['pregnancy'] {
  const active = pregnancies.find((p) => p.endedOn === null);
  const recent = [...pregnancies]
    .filter((p) => p.endedOn !== null && p.endedOn >= from && p.endedOn <= todayISO)
    .sort((a, b) => b.endedOn!.localeCompare(a.endedOn!))[0];
  const p = active ?? recent;
  if (!p) return null;
  const age = p.endedOn === null ? gestationalAge(p, todayISO) : null;
  return {
    dueDate: effectiveDueDate(p),
    endedOn: p.endedOn,
    outcome: p.outcome,
    age: age ? { weeks: age.weeks, days: age.days } : null,
    visits: visits
      .filter((v) => v.pregnancyId === p.id && v.date <= todayISO)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(({ date, kind, weightKg, systolic, diastolic }) => ({ date, kind, weightKg, systolic, diastolic })),
  };
}

export type SummarySection = {
  title: string;
  rows?: { label: string; value: string }[];
  table?: { head: string[]; rows: string[][] };
  lines?: string[];
};

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** The summary as titled sections of text, for both the screen and the PDF. */
export function summarySections(
  summary: DoctorSummary,
  t: Translate,
  labelOf: (key: string) => string,
  formatDate: (iso: string) => string,
): SummarySection[] {
  const days = (n: number) => t('summary.days', { count: n });
  const dash = '—';
  const sections: SummarySection[] = [];

  const cycleValue =
    summary.averageCycle !== null && summary.cycleRange
      ? t('summary.average_with_range', {
          average: days(summary.averageCycle),
          min: summary.cycleRange[0],
          max: summary.cycleRange[1],
        })
      : dash;
  sections.push({
    title: t('summary.overview'),
    rows: [
      { label: t('summary.covers'), value: `${formatDate(summary.from)} – ${formatDate(summary.to)}` },
      { label: t('summary.periods_logged'), value: String(summary.periods.length) },
      { label: t('summary.average_cycle'), value: cycleValue },
      { label: t('summary.average_period'), value: summary.averagePeriod !== null ? days(summary.averagePeriod) : dash },
      {
        label: t('summary.last_period'),
        value: summary.periods.length > 0 ? formatDate(summary.periods[0].start) : dash,
      },
    ],
  });

  if (summary.periods.length > 0) {
    sections.push({
      title: t('summary.periods'),
      table: {
        head: [t('summary.started'), t('summary.period_length'), t('summary.cycle_length')],
        rows: summary.periods.map((p) => [
          formatDate(p.start),
          p.days === null ? t('summary.ongoing') : p.estimated ? t('summary.not_logged') : days(p.days),
          p.cycleLength !== null ? days(p.cycleLength) : dash,
        ]),
      },
    });
  }

  if (summary.symptoms.length > 0 || summary.moods.length > 0) {
    sections.push({
      title: t('summary.symptoms_moods'),
      rows: [
        ...summary.symptoms.map((s) => ({ label: labelOf(s.key), value: days(s.days) })),
        ...summary.moods.map((m) => ({
          label: t('patterns.mood', { mood: t(`day_details.mood_${m.key}`) }),
          value: days(m.days),
        })),
      ],
    });
  }

  if (summary.patterns.status === 'found') {
    sections.push({
      title: t('patterns.title'),
      lines: summary.patterns.patterns.map((p) => patternSentence(p, t, labelOf)),
    });
  }

  const pregnancy = summary.pregnancy;
  if (pregnancy) {
    const rows = [{ label: t('summary.due_date'), value: formatDate(pregnancy.dueDate) }];
    if (pregnancy.age) {
      rows.push({
        label: t('summary.weeks_today'),
        value: t('summary.weeks_days', { weeks: pregnancy.age.weeks, days: pregnancy.age.days }),
      });
    }
    if (pregnancy.endedOn) {
      rows.push({
        label: pregnancy.outcome === 'birth' ? t('summary.birth_on') : t('summary.ended_on'),
        value: formatDate(pregnancy.endedOn),
      });
    }
    sections.push({
      title: t('summary.pregnancy'),
      rows,
      ...(pregnancy.visits.length > 0
        ? {
            table: {
              head: [t('summary.visit_date'), t('summary.visit_type'), t('summary.weight'), t('summary.blood_pressure')],
              rows: pregnancy.visits.map((v) => [
                formatDate(v.date),
                t(`journey.visit_${v.kind}`),
                v.weightKg !== null ? t('summary.kg', { value: v.weightKg }) : dash,
                v.systolic !== null && v.diastolic !== null ? `${v.systolic}/${v.diastolic}` : dash,
              ]),
            },
          }
        : {}),
    });
  }

  return sections;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** The sections as a printable page. Every piece of text is escaped: her symptom names are her own typing. */
export function summaryHtml(title: string, subtitle: string, sections: SummarySection[], footer: string): string {
  const e = escapeHtml;
  const body = sections
    .map((s) => {
      const parts = [`<h2>${e(s.title)}</h2>`];
      if (s.rows) {
        parts.push(
          `<table class="rows">${s.rows.map((r) => `<tr><th>${e(r.label)}</th><td>${e(r.value)}</td></tr>`).join('')}</table>`,
        );
      }
      if (s.table) {
        parts.push(
          `<table class="grid"><thead><tr>${s.table.head.map((h) => `<th>${e(h)}</th>`).join('')}</tr></thead>` +
            `<tbody>${s.table.rows.map((r) => `<tr>${r.map((c) => `<td>${e(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`,
        );
      }
      if (s.lines) parts.push(`<ul>${s.lines.map((l) => `<li>${e(l)}</li>`).join('')}</ul>`);
      return `<section>${parts.join('')}</section>`;
    })
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
body{font-family:-apple-system,Roboto,Helvetica,Arial,sans-serif;color:#2D2226;margin:32px;font-size:12px}
h1{font-size:20px;margin:0}
.sub{color:#6E5D66;margin:4px 0 16px}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:#C06C84;margin:20px 0 6px}
table{border-collapse:collapse;width:100%}
.rows th{text-align:left;font-weight:normal;color:#6E5D66;width:45%;padding:3px 0}
.rows td{padding:3px 0}
.grid th{text-align:left;border-bottom:1px solid #D4C5BB;padding:4px 6px 4px 0;color:#6E5D66;font-weight:600}
.grid td{border-bottom:1px solid #F5EDE8;padding:4px 6px 4px 0}
ul{margin:0;padding-left:18px}
li{margin:3px 0}
footer{margin-top:28px;color:#A8969E;font-size:10px}
section{page-break-inside:avoid}
</style></head><body><h1>${e(title)}</h1><p class="sub">${e(subtitle)}</p>${body}<footer>${e(footer)}</footer></body></html>`;
}

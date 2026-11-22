/**
 * Spreadsheet export. One row per day that has a period start or a log.
 * This is for reading in a spreadsheet, not for restoring — the JSON
 * backup is the format that restores.
 */

import type { DailyLog, Period } from '@/db/schema';
import { customIdOf } from './symptoms';

const HEADER = ['Date', 'Type', 'Period End', 'Flow', 'Symptoms', 'Mood', 'Notes'];

/**
 * Built-in symptoms keep their keys, as they always have; ones she added
 * herself are written by name, since their key is a meaningless id.
 */
export function buildCsv(
  periodList: Period[],
  logList: DailyLog[],
  customLabels: ReadonlyMap<string, string> = new Map(),
): string {
  const symptomCell = (key: string) => {
    const id = customIdOf(key);
    return id === null ? key : (customLabels.get(id) ?? key);
  };
  const periodsByStart = new Map(periodList.map((p) => [p.startDate, p]));
  const logsByDate = new Map(logList.map((l) => [l.date, l]));
  const dates = [...new Set([...periodsByStart.keys(), ...logsByDate.keys()])].sort();

  const rows = dates.map((date) => {
    const period = periodsByStart.get(date);
    const log = logsByDate.get(date);
    return [
      date,
      period ? 'Period Start' : '',
      period?.endDate ?? '',
      log?.flow ?? '',
      log?.symptoms?.map(symptomCell).join(';') ?? '',
      log?.mood ?? '',
      log?.notes ?? '',
    ];
  });

  return [HEADER, ...rows].map((row) => row.map(escapeCell).join(',')).join('\n') + '\n';
}

/** Quotes a cell when it holds a comma, quote or line break. */
function escapeCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

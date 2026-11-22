/**
 * Tests for the backup format, validation and restore planning.
 */

import type { DailyLog, Period, Pregnancy, PregnancyMoment, PregnancyVisit, Settings } from '@/db/schema';
import {
  BACKUP_FORMAT_VERSION,
  backupFileName,
  buildBackup,
  parseBackup,
  planRestore,
  serializeBackup,
  summarizeBackup,
} from './backup';
import type { Backup } from './backup';

const NOW = new Date(2026, 10, 21, 15, 30);

const periodRows: Period[] = [
  { id: 'p2', startDate: '2026-10-21', endDate: '2026-10-26', notes: null, createdAt: 2 },
  { id: 'p1', startDate: '2026-09-22', endDate: null, notes: 'Cramps day 1', createdAt: 1 },
];

const logRows: DailyLog[] = [
  {
    id: 'd1',
    date: '2026-10-21',
    flow: 'heavy',
    symptoms: ['cramps', 'fatigue'],
    mood: 'sensitive',
    notes: 'Café, ibuprofène',
    createdAt: 10,
    updatedAt: 11,
  },
  {
    id: 'd2',
    date: '2026-11-05',
    flow: null,
    symptoms: null,
    mood: null,
    notes: null,
    createdAt: null,
    updatedAt: null,
  },
];

const settingsRow: Settings = {
  id: '1',
  language: 'en',
  calendarType: 'hijri',
  fallbackCycleDays: 29,
  periodDurationDays: 6,
  theme: 'dark',
  appLockEnabled: 1,
  remindersEnabled: 1,
  showStarSign: 1,
  pregnancyPromptDismissedFor: null,
  school: null,
};

function sampleBackup(): Backup {
  return buildBackup(periodRows, logRows, settingsRow, NOW);
}

/** Round-trips an object through JSON text, the way a file would. */
function asFile(value: unknown): string {
  return JSON.stringify(value);
}

describe('buildBackup', () => {
  it('records the app, the current format version and the export time', () => {
    const backup = sampleBackup();
    expect(backup.app).toBe('lumi');
    expect(backup.formatVersion).toBe(BACKUP_FORMAT_VERSION);
    expect(backup.exportedAt).toBe(NOW.toISOString());
  });

  it('keeps every period, end dates included, in date order', () => {
    expect(sampleBackup().periods).toEqual([
      { startDate: '2026-09-22', endDate: null, notes: 'Cramps day 1', createdAt: 1 },
      { startDate: '2026-10-21', endDate: '2026-10-26', notes: null, createdAt: 2 },
    ]);
  });

  it('keeps every daily log field and turns a missing symptom list into an empty one', () => {
    const [first, second] = sampleBackup().dailyLogs;
    expect(first).toEqual({
      date: '2026-10-21',
      flow: 'heavy',
      symptoms: ['cramps', 'fatigue'],
      mood: 'sensitive',
      notes: 'Café, ibuprofène',
      createdAt: 10,
      updatedAt: 11,
    });
    expect(second.symptoms).toEqual([]);
  });

  it('leaves app lock and reminders out of the settings', () => {
    expect(sampleBackup().settings).toEqual({
      language: 'en',
      calendarType: 'hijri',
      fallbackCycleDays: 29,
      periodDurationDays: 6,
      theme: 'dark',
      showStarSign: true,
      school: null,
    });
  });

  it('names the file after the local date', () => {
    expect(backupFileName(NOW)).toBe('lumi-backup-2026-11-21.zip');
  });
});

describe('parseBackup', () => {
  it('reads back exactly what was written', () => {
    const backup = sampleBackup();
    const result = parseBackup(serializeBackup(backup));
    expect(result).toEqual({ ok: true, backup });
  });

  it('refuses text that is not JSON', () => {
    expect(parseBackup('Date,Type,Flow\n2026-10-21,Period Start,heavy')).toEqual({
      ok: false,
      error: 'not_json',
    });
  });

  it('refuses JSON that is not a Lumi backup', () => {
    expect(parseBackup(asFile({ hello: 'world' }))).toEqual({ ok: false, error: 'not_lumi' });
    expect(parseBackup(asFile([1, 2, 3]))).toEqual({ ok: false, error: 'not_lumi' });
  });

  it('refuses a file from a newer version of the app', () => {
    const newer = { ...sampleBackup(), formatVersion: BACKUP_FORMAT_VERSION + 1 };
    expect(parseBackup(asFile(newer))).toEqual({ ok: false, error: 'newer_version' });
  });

  it('refuses a file with no usable version', () => {
    const { formatVersion: _ignored, ...noVersion } = sampleBackup();
    expect(parseBackup(asFile(noVersion))).toEqual({ ok: false, error: 'invalid' });
    expect(parseBackup(asFile({ ...sampleBackup(), formatVersion: 0 }))).toEqual({
      ok: false,
      error: 'invalid',
    });
  });

  it('refuses the whole file when a period has an impossible date', () => {
    const backup = sampleBackup();
    backup.periods[0].startDate = '2026-02-30';
    expect(parseBackup(asFile(backup))).toEqual({ ok: false, error: 'invalid' });
  });

  it('refuses the whole file when a log has an unknown flow level', () => {
    const backup = sampleBackup();
    (backup.dailyLogs[0] as { flow: string }).flow = 'torrential';
    expect(parseBackup(asFile(backup))).toEqual({ ok: false, error: 'invalid' });
  });

  it('drops an end date that falls before its start but keeps the period', () => {
    const backup = sampleBackup();
    backup.periods[1].endDate = '2026-10-01';
    const result = parseBackup(asFile(backup));
    expect(result.ok && result.backup.periods[1]).toMatchObject({
      startDate: '2026-10-21',
      endDate: null,
    });
  });

  it('keeps the first of two records for the same day', () => {
    const backup = sampleBackup();
    backup.dailyLogs.push({ ...backup.dailyLogs[0], mood: 'happy' });
    const result = parseBackup(asFile(backup));
    expect(result.ok && result.backup.dailyLogs).toHaveLength(2);
    expect(result.ok && result.backup.dailyLogs[0].mood).toBe('sensitive');
  });

  it('ignores fields it does not know, so later additions stay readable', () => {
    const backup = { ...sampleBackup(), cycleNotes: [{ start: '2026-01-01' }] };
    expect(parseBackup(asFile(backup)).ok).toBe(true);
  });

  it('drops damaged settings without failing the restore', () => {
    const backup = { ...sampleBackup(), settings: { language: 'de' } };
    const result = parseBackup(asFile(backup));
    expect(result.ok && result.backup.settings).toBeNull();
    expect(result.ok && result.backup.periods).toHaveLength(2);
  });

  it('keeps restored settings inside the ranges the sliders allow', () => {
    const backup = sampleBackup();
    backup.settings!.fallbackCycleDays = 300;
    backup.settings!.periodDurationDays = 0;
    const result = parseBackup(asFile(backup));
    expect(result.ok && result.backup.settings).toMatchObject({
      fallbackCycleDays: 40,
      periodDurationDays: 3,
    });
  });
});

describe('summarizeBackup', () => {
  it('counts records and spans the earliest to the latest date', () => {
    expect(summarizeBackup(sampleBackup())).toEqual({
      periodCount: 2,
      logCount: 2,
      pregnancyCount: 0,
      firstDate: '2026-09-22',
      lastDate: '2026-11-05',
    });
  });

  it('reports no dates for an empty backup', () => {
    const empty = buildBackup([], [], null, NOW);
    expect(summarizeBackup(empty)).toEqual({
      periodCount: 0,
      logCount: 0,
      pregnancyCount: 0,
      firstDate: null,
      lastDate: null,
    });
  });
});

describe('planRestore', () => {
  it('restores everything, settings included, onto an empty phone', () => {
    const backup = sampleBackup();
    const plan = planRestore({ periods: [], logs: [] }, backup);
    expect(plan.periodsToAdd).toEqual(backup.periods);
    expect(plan.logsToAdd).toEqual(backup.dailyLogs);
    expect(plan.skippedPeriods).toBe(0);
    expect(plan.skippedLogs).toBe(0);
    expect(plan.settingsToApply).toEqual(backup.settings);
  });

  it("keeps the phone's own log for a day both have, and its settings", () => {
    const plan = planRestore(
      { periods: [], logs: [{ date: '2026-10-21' }] },
      sampleBackup(),
    );
    expect(plan.logsToAdd.map((l) => l.date)).toEqual(['2026-11-05']);
    expect(plan.skippedLogs).toBe(1);
    expect(plan.settingsToApply).toBeNull();
  });

  it('skips a period the phone already has on the same day', () => {
    const plan = planRestore(
      { periods: [{ startDate: '2026-10-21', endDate: '2026-10-25' }], logs: [] },
      sampleBackup(),
    );
    expect(plan.periodsToAdd.map((p) => p.startDate)).toEqual(['2026-09-22']);
    expect(plan.skippedPeriods).toBe(1);
  });

  it('skips a period that starts inside one the phone already has', () => {
    // The phone's period runs 2026-10-19 to 2026-10-24; the backup's
    // starts on 2026-10-21, two days in. Adding it would log a second
    // start two days after the first.
    const plan = planRestore(
      { periods: [{ startDate: '2026-10-19', endDate: '2026-10-24' }], logs: [] },
      sampleBackup(),
    );
    expect(plan.periodsToAdd.map((p) => p.startDate)).toEqual(['2026-09-22']);
  });

  it("skips a period that one of the phone's periods starts inside", () => {
    // The backup's period runs 2026-10-21 to 2026-10-26; the phone has
    // one starting 2026-10-23.
    const plan = planRestore(
      { periods: [{ startDate: '2026-10-23', endDate: null }], logs: [] },
      sampleBackup(),
    );
    expect(plan.periodsToAdd.map((p) => p.startDate)).toEqual(['2026-09-22']);
  });

  it('adds a period well clear of the phone’s own', () => {
    const plan = planRestore(
      { periods: [{ startDate: '2026-11-18', endDate: null }], logs: [] },
      sampleBackup(),
    );
    expect(plan.periodsToAdd).toHaveLength(2);
    expect(plan.skippedPeriods).toBe(0);
  });
});

describe('version 2: pregnancies', () => {
  const pregnancyRow: Pregnancy = {
    id: 'g1',
    lastPeriodDate: '2026-07-04',
    scanDueDate: '2027-04-14',
    startedAt: 5,
    endedOn: '2027-04-08',
    outcome: 'birth',
    babyName: 'Awa',
    breastfeeding: 1,
    journeyChoice: null,
    createdAt: 6,
  };
  const visitRow: PregnancyVisit = {
    id: 'v1',
    pregnancyId: 'g1',
    date: '2026-11-26',
    kind: 'ultrasound',
    title: 'Anatomy scan',
    weightKg: 64.5,
    systolic: 115,
    diastolic: 72,
    notes: null,
    createdAt: 7,
  };
  const momentRow: PregnancyMoment = {
    id: 'm1',
    pregnancyId: 'g1',
    date: '2026-11-21',
    kind: 'photo',
    text: 'Week 20',
    photoFileName: 'bump-20.jpg',
    createdAt: 8,
  };

  function withPregnancy(): Backup {
    return buildBackup(periodRows, logRows, settingsRow, NOW, {
      pregnancies: [pregnancyRow],
      visits: [visitRow],
      moments: [momentRow],
    });
  }

  it('writes pregnancies, visits and moments linked by key', () => {
    const backup = withPregnancy();
    expect(backup.pregnancies).toEqual([
      {
        key: 'g1',
        lastPeriodDate: '2026-07-04',
        scanDueDate: '2027-04-14',
        endedOn: '2027-04-08',
        outcome: 'birth',
        babyName: 'Awa',
        breastfeeding: true,
        journeyChoice: null,
        startedAt: 5,
        createdAt: 6,
      },
    ]);
    expect(backup.visits[0]).toMatchObject({ pregnancyKey: 'g1', kind: 'ultrasound', weightKg: 64.5 });
    expect(backup.moments[0]).toMatchObject({ pregnancyKey: 'g1', photoFileName: 'bump-20.jpg' });
  });

  it('reads back exactly what was written', () => {
    const backup = withPregnancy();
    expect(parseBackup(serializeBackup(backup))).toEqual({ ok: true, backup });
  });

  it('still reads a version 1 file, as having no pregnancies', () => {
    const v1 = { ...sampleBackup(), formatVersion: 1 } as Record<string, unknown>;
    delete v1.pregnancies;
    delete v1.visits;
    delete v1.moments;
    delete (v1.settings as Record<string, unknown>).showStarSign;
    const result = parseBackup(asFile(v1));
    expect(result.ok && result.backup.pregnancies).toEqual([]);
    expect(result.ok && result.backup.settings?.showStarSign).toBe(true);
    expect(result.ok && result.backup.periods).toHaveLength(2);
  });

  it('refuses a visit that points at a pregnancy the file does not contain', () => {
    const backup = withPregnancy();
    backup.visits[0].pregnancyKey = 'nope';
    expect(parseBackup(asFile(backup))).toEqual({ ok: false, error: 'invalid' });
  });

  it('refuses a photo name that could reach outside the photo folder', () => {
    const backup = withPregnancy();
    backup.moments[0].photoFileName = '../databases/cycle.db';
    expect(parseBackup(asFile(backup))).toEqual({ ok: false, error: 'invalid' });
  });

  it('refuses an ended pregnancy that does not say how it ended', () => {
    const backup = withPregnancy();
    backup.pregnancies[0].outcome = null;
    expect(parseBackup(asFile(backup))).toEqual({ ok: false, error: 'invalid' });
  });

  it('restores a pregnancy with its own visits and moments', () => {
    const plan = planRestore({ periods: [], logs: [], pregnancies: [] }, withPregnancy());
    expect(plan.pregnanciesToAdd).toHaveLength(1);
    expect(plan.pregnanciesToAdd[0].visits).toHaveLength(1);
    expect(plan.pregnanciesToAdd[0].moments).toHaveLength(1);
    expect(plan.skippedPregnancies).toBe(0);
  });

  it('skips a pregnancy overlapping one already on the phone', () => {
    const plan = planRestore(
      { periods: [], logs: [], pregnancies: [{ lastPeriodDate: '2026-08-01', endedOn: null }] },
      withPregnancy(),
    );
    expect(plan.pregnanciesToAdd).toHaveLength(0);
    expect(plan.skippedPregnancies).toBe(1);
  });

  it('does not take settings from the file when the phone already has a pregnancy', () => {
    const plan = planRestore(
      { periods: [], logs: [], pregnancies: [{ lastPeriodDate: '2025-01-01', endedOn: '2025-03-01' }] },
      withPregnancy(),
    );
    expect(plan.settingsToApply).toBeNull();
    expect(plan.pregnanciesToAdd).toHaveLength(1);
  });
});

describe('Islamic option in backups', () => {
  function withFasts(): Backup {
    return buildBackup(periodRows, logRows, { ...settingsRow, school: 'maliki' }, NOW, {
      pregnancies: [],
      visits: [],
      moments: [],
      ramadanOwed: [{ hijriYear: 1447, owedDays: 6, updatedAt: 1 }],
      fastsMadeUp: [{ id: 'f1', hijriYear: 1447, date: '2026-04-10', createdAt: 2 }],
    });
  }

  it('carries the school, the owed counts and the made-up fasts', () => {
    const backup = withFasts();
    expect(backup.settings?.school).toBe('maliki');
    expect(backup.ramadanOwed).toEqual([{ hijriYear: 1447, owedDays: 6 }]);
    expect(backup.fastsMadeUp).toEqual([{ hijriYear: 1447, date: '2026-04-10', createdAt: 2 }]);
    expect(parseBackup(serializeBackup(backup))).toEqual({ ok: true, backup });
  });

  it('reads a version 2 file from before the option as having none of it', () => {
    const older = withFasts() as Record<string, unknown>;
    delete older.ramadanOwed;
    delete older.fastsMadeUp;
    delete (older.settings as Record<string, unknown>).school;
    const result = parseBackup(asFile(older));
    expect(result.ok && result.backup.ramadanOwed).toEqual([]);
    expect(result.ok && result.backup.settings?.school).toBeNull();
  });

  it('only adds what the phone does not already have', () => {
    const plan = planRestore(
      {
        periods: [],
        logs: [],
        ramadanOwed: [{ hijriYear: 1447 }],
        fastsMadeUp: [{ hijriYear: 1447, date: '2026-04-10' }],
      },
      withFasts(),
    );
    expect(plan.ramadanOwedToAdd).toEqual([]);
    expect(plan.fastsMadeUpToAdd).toEqual([]);
    const fresh = planRestore({ periods: [], logs: [] }, withFasts());
    expect(fresh.ramadanOwedToAdd).toHaveLength(1);
    expect(fresh.fastsMadeUpToAdd).toHaveLength(1);
  });
});

describe('custom symptoms in backups', () => {
  const migraine = { id: 'c1', label: 'Migraine', hidden: 0, createdAt: 5 };
  function withCustom(): Backup {
    const logs: DailyLog[] = [
      { ...logRows[0], date: '2026-06-01', symptoms: ['cramps', 'custom:c1'] },
    ];
    return buildBackup([], logs, settingsRow, NOW, {
      pregnancies: [],
      visits: [],
      moments: [],
      customSymptoms: [migraine],
    });
  }

  it('carries her symptoms with their ids, so logs still point at them', () => {
    const backup = withCustom();
    expect(backup.customSymptoms).toEqual([{ id: 'c1', label: 'Migraine', hidden: false, createdAt: 5 }]);
    expect(parseBackup(serializeBackup(backup))).toEqual({ ok: true, backup });
  });

  it('reads an older file as having none', () => {
    const older = withCustom() as Record<string, unknown>;
    delete older.customSymptoms;
    const result = parseBackup(asFile(older));
    expect(result.ok && result.backup.customSymptoms).toEqual([]);
  });

  it('adds a symptom the phone has neither by id nor by name', () => {
    const plan = planRestore({ periods: [], logs: [] }, withCustom());
    expect(plan.customSymptomsToAdd.map((c) => c.id)).toEqual(['c1']);
    expect(plan.logsToAdd[0].symptoms).toEqual(['cramps', 'custom:c1']);
  });

  it('skips one the phone already has by id', () => {
    const plan = planRestore({ periods: [], logs: [], customSymptoms: [{ id: 'c1', label: 'Migraine' }] }, withCustom());
    expect(plan.customSymptomsToAdd).toEqual([]);
    expect(plan.logsToAdd[0].symptoms).toEqual(['cramps', 'custom:c1']);
  });

  it("merges one with the same name into the phone's, re-pointing the logs", () => {
    const plan = planRestore(
      { periods: [], logs: [], customSymptoms: [{ id: 'p9', label: 'migraine ' }] },
      withCustom(),
    );
    expect(plan.customSymptomsToAdd).toEqual([]);
    expect(plan.logsToAdd[0].symptoms).toEqual(['cramps', 'custom:p9']);
  });

  it('refuses a symptom with no name', () => {
    const bad = withCustom() as Record<string, unknown>;
    bad.customSymptoms = [{ id: 'c2', label: '  ' }];
    expect(parseBackup(asFile(bad))).toEqual({ ok: false, error: 'invalid' });
  });
});

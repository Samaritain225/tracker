# Where we are

On `main`. Typecheck clean, 108/108 tests pass, and verified running on the
Lumi_API35 emulator on 2026-08-17 — fresh arm64 build, installed, driven by hand
through the period-logging flow.

A full logic audit was done on 2026-08-17; the report is at
`~/.claude/plans/make-an-audit-of-squishy-flame.md` and is the reference for
everything below.

## Recently landed (this session, uncommitted)

Saved language is applied at startup by a new `LocaleProvider`. It never was —
i18n initialised to a static `fr` and only the Settings updater ever called
`changeLanguage`, so picking English survived in the database, showed as
selected in Settings, and had no effect after a cold start.

A failed save in day-details no longer shows a success tick. The mutators on
`usePeriods`/`useDailyLogs` now report their outcome instead of resolving void,
and `handleSave` bails rather than navigating away on failure.

`findPeriodCovering` moved to `src/utils/cycle.ts` and now respects a confirmed
`endDate`. It previously let the "period ended" switch on any day within 15 of a
start rewrite an end date the user had already confirmed.

`buildCycleWindows` applies the same plausibility bounds to a real cycle gap
that `computeCycleLength` applies to the average, so a mistyped date can no
longer put ovulation before its own period.

`android:allowBackup` is now false in `app.json` — the plaintext SQLite file was
being auto-uploaded to Google Drive backup. Verified through a prebuild.

Symptom heatmap is a real horizontal `ScrollView`; the right-hand half was
clipped and unreachable on every phone at every allowed cycle length.

A day already inside an open period no longer offers "period started" — it
shows "Day 3 of the period that started 1 January" instead. Nothing stopped a
second start being logged two days after the first, which is not a new cycle:
the average became 2 days and called itself calculated, ovulation landed before
its own period, and the calendar filled with predictions every other day.

The plausibility fallback in `recentPlausibleGaps` is now asymmetric, and the
asymmetry is the point. Implausibly long gaps are kept — 70-day cycles are real
(PCOS, perimenopause, post-partum) and answering 28 there is worse than the bug,
which an existing test defends. Implausibly short ones are discarded, because a
2-day cycle is a double-logged period rather than a cycle. `cycleSource` and the
Insights card now gate on a new `hasPlausibleCycleData` rather than a bare
`length >= 2`, so a fallback value is no longer labelled "calculated".

App lock scope is settled: it keeps a curious partner out, and is not meant to
survive someone having real access to the device. No FLAG_SECURE, no PIN
fallback, no encryption at rest — all three documented as decisions in the
`app-lock-provider.tsx` header and summarised in BRAIN. The Settings copy
already promised only this, so it was left alone.

## Next

In rough order: no "delete all data" control anywhere in Settings; export
is CSV-only, one-way, and drops `endDate` so it cannot restore; period reminders
use a one-shot DATE trigger so they stop after one cycle for anyone who does not
open the app.

Lower value, all justified in the audit: calendar accessibility labels are
hardcoded English Gregorian; the phase model degenerates at the extremes of its
own allowed slider settings; every screen independently re-runs the same three
live queries.

## Verified on device this session

`allowBackup` is off on the installed package: `dumpsys package` reports
`flags=[ DEBUGGABLE HAS_CODE ALLOW_CLEAR_USER_DATA ]` with no `ALLOW_BACKUP`.

A day past a period's confirmed end no longer offers the "period ended" switch,
and a day inside an open period shows "Jour 3 des règles commencées le 11 août
2026" with no "period started" toggle. Both checked against the live database
before and after, which was left exactly as found.

## Open questions

None outstanding — the audit resolved whether the review should cover product
gaps as well as correctness. It covered both, and they are separated by
severity in the report.

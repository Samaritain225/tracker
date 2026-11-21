# Where we are

On `fix/logging-flow-audit`, pushed but not merged into `main`. Every fix under
"Recently landed" lives only on that branch, so `main` has none of them.
Typecheck clean, 108 tests passing, and verified by hand on the Lumi_API35
emulator on 2026-08-17.

The 2026-08-17 logic audit report is no longer on disk (it was under
`~/.claude/plans/`). Its findings survive only in the lines below.

## Recently landed (on fix/logging-flow-audit)

- Saved language now applies at cold start through `LocaleProvider`; before, picking English had no effect after a restart.
- A failed save in day-details no longer shows a success tick, because the mutators now return their outcome.
- The "period ended" switch can no longer overwrite an end date the user already confirmed.
- A mistyped date can no longer put ovulation before its own period.
- `android:allowBackup` is false, so the plaintext database is no longer uploaded to Google Drive backup.
- The symptom heatmap scrolls horizontally; its right half used to be unreachable.
- A day inside an open period shows "Day 3 of the period that started…" instead of offering a second "period started".
- Implausibly short cycle gaps are discarded and long ones kept; `hasPlausibleCycleData` gates the "calculated" label.
- App lock scope is settled and documented in BRAIN and the `app-lock-provider.tsx` header.

## Next

Merge `fix/logging-flow-audit` into `main`.

Then, in rough order: there is no "delete all data" control; export is CSV-only,
one-way, and drops `endDate`, so it cannot restore; period reminders use a
one-shot DATE trigger, so they stop after one cycle for anyone who does not open
the app.

A late period is handled badly: the phase banner says how many days late, but
the summary card shows "Next period: N days ago", the calendar keeps the missed
prediction and projects future ones from it, and lateness never ends or
suggests a pregnancy test.

Lower value: calendar accessibility labels are hardcoded English Gregorian; the
phase model degenerates at the extremes of its own slider settings; every screen
re-runs the same three live queries.

## Open questions

The GitHub repo is public and commit `974aee7` still contains `credentials.json`
with the Android keystore passwords. The keystore file itself was never
committed. Waiting on whether to change those passwords.

Product direction, decided 2026-11-21: Lumi is for anyone who menstruates,
with Islamic rulings on menstruation (haid and istihada) as an optional mode on
top. A pregnancy mode is wanted: a late period leads into it, it tracks the week
and stage, symptoms, visit dates, due date and the baby's star sign, and the user
can end it (birth or loss) and go back to cycle tracking. "Lively" means both her
own data and week-by-week baby development content, in French and English.
Pregnancy screen picked: Home becomes a week ring with the baby-size comparison,
due date, star sign and next visit; History becomes a Journey timeline tab.
Mockups are in `.superpowers/brainstorm/` (gitignored). After a birth: a recovery
period, then back to period tracking, and the Journey is kept. Agreed order of
the four projects: foundations, pregnancy mode, Islamic option, extras. Existing
user data must survive every change. Expo should be upgraded from SDK 55 to the
latest (SDK 58 as of 2026-11-21, React Native 0.88). Waiting on how to deliver:
one pull request per stage, or one at the end. Nothing is built yet.

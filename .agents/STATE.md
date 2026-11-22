# Where we are

All six stages are merged into `main` (2026-11-22). The stack was merged from
the top down, so only the final merge into `main` started a production build:
one EAS run, in progress at the time of writing. From now on work goes into
`develop`, which is the default branch; merging `develop` into `main` is a release.

## Recently landed

- Stage 5: the Maliki Islamic option (counts, reference limits, Ramadan fasts to make up, sources), verified on the emulator on 2026-11-22.
- Stage 6: custom symptoms (added from the day sheet, renamed or hidden under Settings > My symptoms), a Patterns card in Insights, and a one-page "Summary for a doctor" shared as a PDF through `expo-print`. Built on the builder's picks, as the owner asked, with no design conversation. Verified on the emulator on 2026-11-22 in English; the PDF was opened and read.

## Decided, still true for later schools

- No verdicts: the app counts and quotes, never says she may or must pray or fast. No scholar has checked the references; the app says so.
- A new school is one file in `src/utils/fiqh/` plus its text; screens never hold a number.

## Next

1. All six stages from the original plan are built. Nothing new is planned until the owner picks what comes next.

Lower value: calendar accessibility labels are hardcoded English Gregorian; the
phase model degenerates at the extremes of its own slider settings; every screen
re-runs the same three live queries.

## Open questions

The GitHub repo is public and commit `974aee7` still contains `credentials.json`
with the Android keystore passwords. The keystore file itself was never
committed. Waiting on whether to change those passwords.

The first production APK after stage 2 is the first one shrunk by R8 (an SDK 58
default). Only debug builds were tested, so it needs opening once before sharing.

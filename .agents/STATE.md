# Where we are

Seven stacked pull requests are open, each waiting on the user to merge in
order. Each merge into `main` builds a production APK.

- Stage 1, pull request 2: the August logic-audit fixes (`fix/logging-flow-audit`).
- Stage 2, pull request 3: Expo SDK 55 to 58 and checks before every build (`chore/expo-sdk-58`).
- Stage 3, pull request 4: foundations (`feat/foundations`).
- Stage 4 part 1, pull request 5: pregnancy foundation (`feat/pregnancy-foundation`), including the approved design.
- Stage 4 part 2, pull request 6: the Journey (`feat/pregnancy-journey`).
- Stage 4 part 3, pull request 7: weekly content and pregnancy Insights (`feat/pregnancy-content`).
- Stage 5, pull request 8: the Islamic option, Maliki school (`feat/islamic-option`), including its design.

## Recently landed

- Stage 4 part 3: week-by-week content with sources, milestones and pregnancy Insights, verified on the emulator in English and French.
- Stage 5: one switch in Settings; counts of bleeding and purity with Maliki reference limits on Home and the day sheet; a nifas line after a birth; a quote when bleeding is logged in pregnancy; nothing religious after a loss; a "Fasts to make up" screen per Ramadan with a suggestion she can override and made-up fasts she ticks off; a sources screen citing Bewley's Risala by section. Verified on the emulator on 2026-11-22 (English only; the French text has a completeness test). The backup round trip is covered by tests, not run on the emulator.

## Decided, still true for later schools

- No verdicts: the app counts and quotes, never says she may or must pray or fast. No scholar has checked the references; the app says so.
- A new school is one file in `src/utils/fiqh/` plus its text; screens never hold a number.

## Next

1. Stage 6, extras: patterns from her own logs, a doctor summary, custom symptoms. Not designed yet.

Lower value: calendar accessibility labels are hardcoded English Gregorian; the
phase model degenerates at the extremes of its own slider settings; every screen
re-runs the same three live queries.

## Open questions

The GitHub repo is public and commit `974aee7` still contains `credentials.json`
with the Android keystore passwords. The keystore file itself was never
committed. Waiting on whether to change those passwords.

The first production APK after stage 2 is the first one shrunk by R8 (an SDK 58
default). Only debug builds were tested, so it needs opening once before sharing.

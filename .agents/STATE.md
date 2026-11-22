# Where we are

Six stacked pull requests are open, each waiting on the user to merge in
order. Each merge into `main` builds a production APK.

- Stage 1, pull request 2: the August logic-audit fixes (`fix/logging-flow-audit`).
- Stage 2, pull request 3: Expo SDK 55 to 58 and checks before every build (`chore/expo-sdk-58`).
- Stage 3, pull request 4: foundations (`feat/foundations`).
- Stage 4 part 1, pull request 5: pregnancy foundation (`feat/pregnancy-foundation`), including the approved design.
- Stage 4 part 2, pull request 6: the Journey (`feat/pregnancy-journey`).
- Stage 4 part 3, pull request 7: weekly content and pregnancy Insights (`feat/pregnancy-content`).

## Recently landed (stage 4 part 3, on feat/pregnancy-content)

- Week-by-week notes in English and French (weeks 0-3, then 4 to 41), written from the NHS guide and Service-Public; sizes are NHS lengths, no weights. Not professionally reviewed, as the owner decided; the app says so on its sources screen.
- The ring shows the week's size emoji; Home has a "This week" card linking to "About this information".
- Journey milestones (halfway, full term, due date), never after a loss.
- Pregnancy Insights: symptoms by week, weight at visits, visits so far.
- Verified on the Lumi_API35 emulator on 2026-11-22, in English and French.

## Next

1. Stage 5, Islamic option (haid, istihada, nifas, prayers and fasts to make up): being designed. Decided 2026-11-22: Maliki school only, structured so other schools can be added later. No one will check the rulings: the owner chose to ship with Maliki sources listed, so the proposed scope is reduced to counting and reference (no "this day is haid" verdicts). Waiting on the owner's reaction to that scope.
2. Stage 6, extras: patterns from her own logs, a doctor summary, custom symptoms.

Lower value: calendar accessibility labels are hardcoded English Gregorian; the
phase model degenerates at the extremes of its own slider settings; every screen
re-runs the same three live queries.

## Open questions

The GitHub repo is public and commit `974aee7` still contains `credentials.json`
with the Android keystore passwords. The keystore file itself was never
committed. Waiting on whether to change those passwords.

The first production APK after stage 2 is the first one shrunk by R8 (an SDK 58
default). Only debug builds were tested, so it needs opening once before sharing.

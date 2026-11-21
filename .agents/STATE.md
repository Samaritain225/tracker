# Where we are

Three stacked pull requests are open, each waiting on the user to merge in order.
Each merge into `main` builds a production APK.

- Stage 1, pull request 2: the August logic-audit fixes (`fix/logging-flow-audit`).
- Stage 2, pull request 3: Expo SDK 55 to 58 and checks before every build (`chore/expo-sdk-58`).
- Stage 3, pull request 4: foundations (`feat/foundations`).

## Recently landed (stage 3, on feat/foundations)

- A late period reads as late: "N days late" on Home, the next prediction starts today, and a test is suggested after a week.
- Lateness no longer counts the due day itself as a day late.
- Reminders cover the next three predicted periods instead of one.
- Backup to a JSON file, restore that only adds, a CSV with end dates, and delete-all.
- All four verified on the Lumi_API35 emulator on 2026-11-21, including a full backup, delete, restore round trip.

## Next

1. Stage 4, pregnancy mode: designed in `docs/superpowers/specs/2026-11-21-pregnancy-mode-design.md` (branch `feat/pregnancy-design`), waiting on the owner's approval. Ships as three stacked pull requests: foundation, Journey, content and Insights. The owner decided that backups include photos (the backup becomes a zip) and that the weekly baby content ships without professional medical review, with its sources listed in the app.
2. Stage 5, Islamic option (haid, istihada, nifas): needs the user to choose which schools to support and who checks the rulings.
3. Stage 6, extras: patterns from her own logs, a doctor summary, custom symptoms.

Lower value: calendar accessibility labels are hardcoded English Gregorian; the
phase model degenerates at the extremes of its own slider settings; every screen
re-runs the same three live queries.

## Open questions

The GitHub repo is public and commit `974aee7` still contains `credentials.json`
with the Android keystore passwords. The keystore file itself was never
committed. Waiting on whether to change those passwords.

The first production APK after stage 2 is the first one shrunk by R8 (an SDK 58
default). Only debug builds were tested, so it needs opening once before sharing.

# Where we are

Five stacked pull requests are open, each waiting on the user to merge in
order. Each merge into `main` builds a production APK.

- Stage 1, pull request 2: the August logic-audit fixes (`fix/logging-flow-audit`).
- Stage 2, pull request 3: Expo SDK 55 to 58 and checks before every build (`chore/expo-sdk-58`).
- Stage 3, pull request 4: foundations (`feat/foundations`).
- Stage 4 part 1, pull request 5: pregnancy foundation (`feat/pregnancy-foundation`), including the approved design.
- Stage 4 part 2, pull request 6: the Journey (`feat/pregnancy-journey`).

## Recently landed (stage 4 part 2, on feat/pregnancy-journey)

- The Journey tab while pregnant: trimesters, upcoming visits above today, moments, photos, weekly symptom summaries.
- Visit and moment editors; photos from Android's photo picker, copied into the app, no camera or microphone permission.
- Next visit on Home; visit reminders at 09:00 the day before.
- Past pregnancies in History, read-only; after a loss, keep or delete the Journey (migration 0005).
- Verified on the Lumi_API35 emulator on 2026-11-22, over part 1 data.

## Next

1. Stage 4 part 3: the weekly baby content in both languages (no professional review, sources listed in the app, by the owner's decision) and pregnancy Insights. Design in `docs/superpowers/specs/2026-11-21-pregnancy-mode-design.md`.
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

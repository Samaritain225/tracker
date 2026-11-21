# Stage 2: Expo upgrade and pipeline checks

## Why

Lumi is on Expo SDK 55 (React Native 0.83). The latest is SDK 58 (React Native
0.88). Every feature stage after this one should be written against the current
SDK, so the upgrade goes first, on its own, while the codebase is small and
known to work. The production APK pipeline already exists and works, but it
builds without running the type check or tests, so broken code can still ship.

## Goals

- The app runs on Expo SDK 58 with every Expo package at the version SDK 58 expects.
- Someone who already has Lumi installed upgrades to the new version and keeps every period, daily log and setting.
- The type check and tests run on every pull request, and must pass before the production APK is built on `main`.

## Non-goals

- No new features or visual changes. If the upgrade forces a visible change, it is called out in the pull request.
- No iOS build. The pipeline builds Android only, as it does today.

## Anti-goals

- An upgrade that loses or hides a user's existing data, even for one launch.
- A pipeline that builds on every pull request and uses up the monthly cloud build allowance.

## Approaches considered

1. **One SDK at a time: 56, then 57, then 58 (chosen).** Expo's own recommended path. Each step has a short list of breaking changes, and a failure points at one release. Costs three rounds of checks instead of one.
2. **Jump straight to 58.** Fewer steps, but three releases' worth of breaking changes land at once, and a failure could come from any of them.
3. **Stay on 55 and only add pipeline checks.** Cheapest now, but every later stage then builds on an SDK that is falling further behind.

## Design

- Branch `chore/expo-sdk-58`, stacked on `fix/logging-flow-audit` (pull request 2), retargeted to `main` once that merges.
- For each SDK in turn: read that release's breaking changes, run `npx expo install expo@^<N>.0.0` then `npx expo install --fix`, run `npx expo-doctor`, fix what it reports, then type check, tests, and a fresh `arm64-v8a` build on the emulator. One commit per SDK.
- Third-party packages outside Expo (Drizzle, i18next, the slider) move only if the new SDK requires it.
- `eas.json` keeps its node pin, updated if SDK 58 needs a newer node.
- **Data check:** build the app from current `main` in debug, install it on the emulator, log periods, an end date, daily logs with symptoms, and change settings. Then build the upgraded app in debug and install it over the top (both debug builds share a signing key, so this is a real upgrade, not a fresh install). Confirm every record and setting is still there.
- **Pipeline:** the existing workflow in `.eas/workflows/` gets a checks job (install, type check, tests) that the Android build job depends on. A second workflow runs only the checks job on pull requests. The APK is still built only on pushes to `main`.

## Left to the builder

- Exact fixes for whatever each SDK's breaking changes and `expo-doctor` report.
- Exact EAS workflow syntax for the checks job, taken from Expo's current documentation.

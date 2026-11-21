# Stage 3: Foundations

## Why

Before pregnancy mode adds months of new data and photos, the basics have to be
trustworthy. Today a late period shows confusing dates, reminders quietly stop
after one cycle, and a lost or new phone wipes a user's whole history because
cloud backup is off and the export cannot be imported back. There is also no
way to erase everything.

## Goals

- A late period reads as late everywhere in the app, not as "next period 5 days ago".
- Period reminders keep arriving for months without the user opening the app.
- A user can save a complete backup to wherever she chooses and restore it onto a new phone with nothing lost.
- A user can delete all of her data in one deliberate step.

## Non-goals

- The pregnancy prompt when a period is late. That arrives with pregnancy mode (stage 4); this stage only suggests a test.
- Encrypted or password-protected backups. The backup file is readable by anyone who has it, and the app says so.
- Automatic or cloud backup. The user decides where each backup file goes.

## Anti-goals

- Any change to how existing data is stored. This stage adds no tables and no columns.
- A restore that silently overwrites something the user logged on this phone.
- A delete button that can be hit by accident.

## Approaches considered

For reminders:

1. **Schedule the next three predicted periods at once (chosen).** Each gets its own reminder two days before, at 09:00, refreshed whenever the app opens or data changes. Covers about three months without the app being opened.
2. **A repeating reminder every average-cycle-length days.** Never runs out, but drifts away from the real predictions as soon as one cycle is shorter or longer.

For restore:

1. **Merge into what is on the phone (chosen).** Adds every period and day from the file that the phone doesn't have. Where both have the same date, the phone's version wins. On a new, empty phone this is a full restore.
2. **Replace everything.** Simpler to explain, but one wrong tap destroys newer data. A user who really wants this can delete all data first, then restore.

## Design

**Late period**

- The "Next period" card shows "N days late" instead of "N days ago". The ovulation card shows a dash while late.
- The calendar stops painting the missed prediction in the past. The next predicted period starts today ("any day now"), and later ones are projected from today using the average.
- After 7 days late, the banner tip changes to suggest that, if pregnancy is possible, a test is reliable now.
- All of this lives in the pure functions in `src/utils/`, with tests.

**Reminders**

- Up to three period reminders, one per upcoming predicted cycle, with their own identifiers. The old single `period-reminder` identifier is also cancelled, so users upgrading don't get a duplicate.
- While late, no period reminder is scheduled for a date in the past.
- The daily log reminder already repeats daily and is unchanged.

**Backup and restore (Settings)**

- "Back up my data" writes `lumi-backup-YYYY-MM-DD.json` and opens the share sheet. The file holds a format version, the export date, every period (including end dates), every daily log and the settings.
- "Restore from backup" opens a file picker (adds Expo's `expo-document-picker`). It checks the file, shows what it contains ("14 periods and 212 logged days, from March 2025 to November 2026"), and merges on confirmation.
- A newer app reads every older backup format. An older app shown a newer file says so and changes nothing.
- The CSV export stays, for spreadsheets, and gains an end-date column.

**Delete all my data (Settings)**

- A red button at the bottom of Settings opens a dialog that states what will be deleted, with counts, and offers "Back up first".
- Confirming deletes every period and daily log, resets settings to their defaults, and cancels all reminders.

## Left to the builder

- Exact wording in French and English, in the same tone as the existing strings.
- Where in Settings the new buttons sit, grouped with the existing export.

# Stage 4: Pregnancy mode

## Why

Lumi is a private, offline period tracker for anyone who menstruates. When
someone using it gets pregnant, the app today has nothing to say: it shows a
period "N days late" for months. The owner wants Lumi to stay with her through
the pregnancy and feel lively while doing it, combining two things:

- **her own data**: symptoms, visits, moments she adds, photos;
- **week-by-week baby development**: what is happening this week, how big the
  baby is, in French and English.

Then, when the pregnancy ends, Lumi goes back to tracking her cycle without
losing anything she recorded.

## Goals

- A late period leads gently into pregnancy mode, and she can also start it herself at any time.
- While she is pregnant, the four existing tabs show pregnancy content: Home is a week ring, History is the Journey, Insights shows pregnancy patterns, and Settings is unchanged apart from a pregnancy section.
- She knows her week and day, trimester, due date and days to go, and (optionally) the baby's likely star sign.
- She can log symptoms day by day, add visits (check-ups, scans, tests), and add moments (notes, first kick, photos).
- A due date from a scan replaces the one worked out from her last period, and everything updates.
- A birth leads to a recovery period, then back to cycle tracking. A loss takes a quiet path straight back to cycle tracking. Either way, the Journey is kept as a memory unless she deletes it.
- Every period, daily log and setting she already has is untouched, and her average cycle length is never distorted by the pregnancy.

## Non-goals

- Tracking the baby after birth (feeds, sleep, growth). Lumi follows her, not the baby.
- Contraction timing, kick counting sessions, or anything presented as a clinical tool.
- Islamic rulings on bleeding after childbirth (nifas). That is stage 5, which builds on the recovery period defined here.
- Any network access. All content ships inside the app.
- iOS-specific work beyond what React Native gives for free. Android is the target, as for the rest of the app.

## Anti-goals

These would make the feature a failure even if it technically worked:

- Anything cheerful (baby size, countdown, congratulations) still on screen after she records a loss.
- Medical content that is wrong, or that reads as advice to replace her midwife or doctor.
- Calling any day "safe", during pregnancy or after it. During recovery the app must say plainly that she can get pregnant again before her first period returns.
- A pregnancy that drags her average cycle length to hundreds of days, or that changes or deletes any of her period records.
- Losing her Journey or photos when she changes phones, or when she deletes data she didn't mean to delete.

## Constraints

- Expo SDK 58, React Native 0.88, Expo Router file-based tabs, Drizzle ORM on expo-sqlite, i18next in French and English, as the rest of the app.
- Database changes are additive only: new tables and new nullable or defaulted columns, through a new Drizzle migration. No existing column changes meaning.
- Cycle maths stays as pure, tested functions in `src/utils/`. Screens delegate to them.
- The backup format moves to version 2. Version 1 files must still restore.
- Delete-all must also delete everything this stage adds, photo files included.
- Mutators return their outcome, never `void` (project convention). No bare `db.delete(table)` without a `where` (it silently skips live-query updates; see `.agents/AGENTS.md`).

## Approaches considered

1. **Same tabs, content swaps (chosen by the owner).** The four tab routes stay. Each of Home, History and Insights checks the current mode and renders either its cycle component or its pregnancy component. One tab bar, one Settings, one day sheet; the app doesn't jump to a different navigator when the mode changes.
2. **Two separate tab sets** (`(cycle)` and `(pregnancy)` route groups, swapped at the root). Each screen does one job, but switching modes swaps the whole navigator, Settings and the day sheet are duplicated or awkwardly shared, and it is more code for the same result.
3. **A separate pregnancy area** opened from a button on Home. Smallest change, but contradicts the chosen design (Home *becomes* the week ring; Journey is a tab) and makes pregnancy feel bolted on.

## The design

### Modes

The app is always in exactly one mode, derived from data, never stored:

| Mode | When |
|------|------|
| `cycle` | No active pregnancy, and no recovery in progress. Today's app. |
| `pregnant` | A pregnancy exists with no end date. |
| `recovery` | The most recent pregnancy has ended (a birth or a loss), and no period has been logged after the date it ended. |

Recovery covers both endings, because both have the same problem: the latest
period on record is the one from before the pregnancy, often many months ago.
Treating that as an ordinary cycle would show "90 days late" and the "I'm
pregnant" prompt to someone who has just had a loss. In recovery there are no
predictions, no lateness and no prompt, until she logs her first period. What
recovery looks like on screen depends on how the pregnancy ended (see Screens). A pure function in `src/utils/` (`resolveMode(pregnancies, periods, today)`) decides the mode, with tests, and a `useMode()` hook exposes it to screens.

### Entering pregnancy mode

- **From a late period.** When the period is 7 or more days late (the same threshold as today's test suggestion), the Home banner adds two buttons: "I'm pregnant" and "Not pregnant". "Not pregnant" hides the buttons until the next logged period (stored as the period start date it was dismissed for, so it reappears next cycle).
- **From Settings, any time.** A Pregnancy section offers "I'm pregnant", for someone who found out early or never tracked periods.
- **Setup.** One short screen: the first day of her last period (prefilled with the latest logged period start, changeable), and optionally a due date she has been given at a scan. It shows the resulting due date and week before she confirms.
- Starting a pregnancy adds a "Positive test" moment to the Journey, dated today.

### Dates

All pure functions, in `src/utils/pregnancy.ts`, with tests:

- **Calculated due date** = first day of last period + 280 days.
- **Effective due date** = the scan due date if she entered one, otherwise the calculated one.
- **Gestational age is counted in completed weeks plus days**, the medical convention ("20 weeks + 3 days"). It counts from the effective due date minus 280 days, so a scan date moves it too. 140 days after that start is 20 weeks + 0 days, and Home labels it "Week 20".
- **Trimesters** by completed weeks: first is 0+0 to 13+6, second is 14+0 to 27+6, third is 28+0 onwards.
- **After the due date** the ring stays full and Home reads "40 weeks + 3 days · 3 days past your due date". There is no cut-off; she ends the pregnancy herself.
- *Builder's note: an earlier draft said "Week 41" here, which mixed two counting conventions. Completed weeks is the one to use everywhere, including content lookup and tests.*
- When the scan due date changes, a moment is added: "Due date moved to 10 April".

### Star sign

- Western tropical zodiac, from the effective due date while pregnant, and from the birth date once born.
- Because a due date is an estimate, when the sign changes within 14 days either side of the due date, both are shown: "Aries, or Taurus if after 19 April".
- A setting "Show star sign", on by default. Stage 5 will switch it off by default when the Islamic option is turned on.
- Pure function with tests, including every sign boundary.

### Data

One new Drizzle migration adds:

- **`pregnancies`**: id, last period date, scan due date (nullable), started at, ended on (nullable), outcome (`birth`, `loss`, or null while active), birth date (nullable), baby name (nullable), breastfeeding (nullable, asked during recovery), created at.
- **`pregnancy_visits`**: id, pregnancy id, date, kind (`checkup`, `ultrasound`, `blood_test`, `other`), optional title, optional weight in kg, optional blood pressure (systolic and diastolic as two integers), optional notes. Upcoming or past is decided by date, not stored.
- **`pregnancy_moments`**: id, pregnancy id, date, kind (`positive_test`, `kick`, `due_date_change`, `photo`, `note`), optional text, optional photo file name, created at.
- **`settings`**: `show_star_sign` (default on) and `pregnancy_prompt_dismissed_for` (nullable period start date).

Visits and moments are deleted with their pregnancy. Daily symptoms stay in the existing `daily_logs` table: the same row, with pregnancy symptom keys in the same JSON list. Bleeding during pregnancy is still logged as `flow` on that day, but never creates or extends a period.

Photos are copied into the app's own document folder (`pregnancy-photos/`), and only the file name is stored. They are never added to the phone's gallery.

### Cycle maths during and after a pregnancy

- **Average cycle length ignores any gap between two period starts that contains a pregnancy.** Today, when the recent gaps contain nothing plausible, the app keeps long gaps on purpose (70-day cycles are real). Right after a birth, the only recent gap would be the 10-to-14-month pregnancy gap, and the average would become hundreds of days. The pregnancy-spanning gap is removed before any of the existing rules run.
- **No predictions, fertile window, ovulation, lateness or late-period prompt** while `pregnant` or in `recovery`. The calendar shows no predicted days in those modes.
- **After a pregnancy, whether it ended in a birth or a loss, for the first three cycles**, the cycle-length card says "Estimated" with a note that cycles are often irregular after a pregnancy, even when it has enough data to calculate.
- **Period reminders** are not scheduled while `pregnant` or in `recovery`. The daily check-in keeps working.
- **Visit reminders**: each upcoming visit gets a reminder at 09:00 the day before, through the same notification service, cancelled and rebuilt like the period reminders. Only when reminders are switched on.

### Screens

**Home, pregnant** (the mockup the owner picked, "A"):
- A week ring showing progress through 40 weeks, with the size-comparison emoji and "Week 20" in the middle.
- "About the size of a banana · ~25 cm · ~300 g".
- A "This week" card: the baby's development, plus one line about her body.
- Due date and days to go, beside the star sign.
- The next visit, with a "+ Log today" button that opens the day sheet.
- Below those, the existing calendar, so any past day can be opened and filled in. It shows logged days and bleeding, with no predicted, fertile or ovulation days.
- A small line at the bottom: "General information, not medical advice. Your midwife or doctor knows your pregnancy."

**Journey tab** (History while pregnant; the mockup's "C"):
- The three trimesters as a bar across the top, with the due date and star sign.
- An "+ Add moment" button: a note, a first kick, or a photo.
- A timeline, newest first, with upcoming visits at the top and today marked. It mixes visits (with weight and blood pressure if entered), moments, photos, a summary of each week's logged symptoms, and a few fixed milestones taken from the weekly content ("Halfway!").
- Tapping a visit or moment edits it.

**Insights, pregnant**:
- Symptoms by week, reusing the existing heatmap with weeks along the axis instead of cycle days.
- Weight over time, from visits that recorded it, if there are at least two.
- Number of visits so far, and the next one.

**Day sheet, on a pregnancy day**:
- "Period started" and "period ended" are hidden.
- The flow section becomes "Bleeding", with a short line suggesting she contacts her midwife or doctor about bleeding.
- The symptom list switches to the pregnancy set: nausea, tiredness, back pain, heartburn, swelling, headache, cramps, felt the baby move. Mood and notes stay.

**Settings, Pregnancy section**:
- Not pregnant: "I'm pregnant".
- Pregnant: change the last-period date or the scan due date; "Show star sign"; "The pregnancy has ended".
- "The pregnancy has ended" asks one question: "My baby was born" (date, optional name) or "The pregnancy ended" (date only, nothing else asked).

**Recovery after a birth**:
- Home shows days since the birth, a short card about recovery, the calendar (no predictions), and a "My period has come back" button.
- A permanent line: "You can get pregnant again before your first period comes back."
- An optional "Are you breastfeeding?" question, which only changes the wording about when periods usually return.
- **The day sheet hides "period started" and "period ended"** during recovery, as it does while pregnant. Bleeding after a birth is logged as bleeding on the day and never becomes a period. Only "My period has come back" creates a period.
- If she taps it within 6 weeks of the birth, she is asked to confirm: bleeding in the first weeks after a birth is usually not a period. She can still go ahead.
- Recovery ends when that period is logged. The History tab shows the cycle list with the just-finished Journey at the top under "Pregnancies". Insights shows the cycle view, which has no post-pregnancy data yet.

**Recovery after a loss**:
- The moment it is recorded, every pregnancy screen goes away. Home shows the cycle layout with no predictions, no lateness and no prompt, and a single quiet card: "We're sorry. Take all the time you need." No baby content, no counts, no congratulations anywhere.
- The same "My period has come back" button and the same day-sheet rule as after a birth, without the 6-week question and without the breastfeeding question.
- She is asked once, later and only from the History tab, whether to keep the Journey or delete it.

**Undoing a pregnancy started by mistake**:
- While a pregnancy is active and has no visits yet, Settings offers "Remove this pregnancy", for a mis-tap or a false positive. It deletes the pregnancy and its moments, with a plain confirmation, and no condolences. The app goes straight back to cycle mode, and the late-period prompt can appear again.

**Past pregnancies**: in cycle mode, the History tab has a "Pregnancies" entry above the period list, opening each finished Journey as read-only (photos included).

### Week-by-week content

- Sizes live in a language-free file, `src/content/pregnancy-weeks.data.json`; text in one file per language, `pregnancy-weeks.en.json` and `.fr.json`.
- One entry per completed week from 4 to 41, plus one shared entry for weeks 0 to 3. Weeks past 41 show the week 41 entry: the NHS has no week 42 page. Each entry holds a size emoji, a size comparison, an approximate length with how it was measured, two or three sentences on the baby's development, one sentence on her body, and an optional milestone (halfway, full term, due date).
- No weights: the NHS week pages give lengths only, apart from the 3 to 4 kg range at week 41, which is in the text.
- Original text, written from the NHS week-by-week guide to pregnancy, the NHS page on scans, and Service-Public.gouv.fr for French practice. ACOG, Ameli, the HAS and Santé publique France were planned as sources but could not be read when the content was written (each blocked automated reading), so they are not cited.
- **Decided by the owner: no professional medical review.** The app lists its sources on an "About this information" screen, reached from the "This week" card, and says plainly that the notes have not been reviewed by a midwife or doctor. Every figure stays within what the sources state. Nothing tells her what to eat or take; the only safety lines point her to her midwife (reduced movements, swelling).
- A test checks that both languages have every week and every field, so a missing translation fails the build instead of showing a blank card.

### Backup format version 2

- **Decided by the owner: backups include the photos**, so changing phones never loses the Journey.
- A version 2 backup is a `.zip` file, `lumi-backup-YYYY-MM-DD.zip`, holding `backup.json` (the data, in the version 2 format) and a `photos/` folder with every photo under its stored file name. Built and read with `fflate`, a small pure-JavaScript zip library with no native code, so no rebuild is needed for it.
- The JSON adds pregnancies, visits, moments and the two new settings.
- Restore accepts both a version 2 `.zip` and a version 1 `.json`. Version 1 files still restore exactly as today. The file picker accepts both types.
- A photo named in `backup.json` but missing from the zip is skipped, and its moment is kept without the photo, rather than failing the whole restore. Photos are copied into the app's photo folder only after the database transaction succeeds, and a failure copying them is reported.
- The backup screen notes that the file includes photos and can be large.
- Restore rules extend the existing "only adds" rules: a pregnancy whose dates overlap one already on the phone is skipped together with its visits and moments; otherwise it is added with fresh ids, and its visits and moments are re-linked to the new id.
- An older app shown a version 2 file refuses it with the existing "made by a newer version" message.

### Delete all

Also deletes every pregnancy, visit and moment, the photo folder, and resets the two new settings.

### Testing

- Pure functions with tests: mode resolution, due date and week maths (including scan overrides and past-due), trimesters, zodiac boundaries and the two-sign case, the pregnancy-gap exclusion in average cycle length, backup v2 reading, v1 compatibility, and restore planning with pregnancies.
- On the emulator, installed over the stage 3 build with real data: the migration keeps every existing row; the late-period prompt leads into pregnancy; Home, Journey, Insights and the day sheet in pregnancy mode; a scan due date; a visit reminder scheduled; a photo moment; birth to recovery to a logged period; a loss leaving no pregnancy content anywhere; backup, delete-all and restore round trip with pregnancy data and photos, and a version 1 file from stage 3 still restoring.

### Delivery

Stage 4 is several times the size of stage 3, so it ships as three stacked pull requests, each one usable on its own:

1. **Foundation**: tables and migration, modes, dates and star sign, the late-period prompt and setup, Home and the day sheet in pregnancy mode, ending a pregnancy (birth, recovery, loss), the cycle maths changes, backup version 2.
2. **Journey**: visits, moments, photos, the Journey tab, past pregnancies, visit reminders.
3. **Content and Insights**: the 40 weeks of content in both languages, the "This week" card, pregnancy Insights.

## Left to the builder

- Component structure inside each screen, as long as each mode's screen is its own component and the tab file only chooses between them.
- The date-picking control in setup and visits (the existing calendar grid in a sheet is fine).
- Exact visual styling, within the current theme and the picked mockups.
- Exact wording of all new French and English strings, in the tone of the existing ones.

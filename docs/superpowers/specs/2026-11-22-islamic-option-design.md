# Stage 5: The Islamic option (Maliki)

## Why

Lumi is for anyone who menstruates, and many of its users are Muslim women
for whom bleeding has religious consequences: whether to pray, whether to
fast, when to make a ghusl, and which Ramadan fasts to make up. The owner
wants Lumi to help with that as an option, without making the app religious
for everyone else.

## Decisions already made by the owner

- **Maliki school only**, structured so other schools can be added later without rework.
- **No religious review.** The rules ship with their sources listed, and the app says plainly that nobody qualified has checked them and that they are not a fatwa.
- **Because of that, a reduced scope:** the app counts and gives reference information. It never decides on its own whether she may pray or fast, never labels a day as haid or istihada, and never says "you can pray again from…".
- **The Ramadan make-up count** is the part that matters most.

## Goals

- One switch in Settings turns the option on or off. Off, the app is exactly as it is today.
- Beside her bleeding, she sees plain counts from her own logs (day of bleeding, days of purity) and the Maliki reference limits that apply, quoted from the source.
- When a count passes a reference limit, the app says so neutrally and suggests asking someone knowledgeable. That is the furthest it goes.
- For each Ramadan, the app suggests how many fasts she may have missed through bleeding, lets her correct that number, and lets her tick off each fast as she makes it up.
- After a birth, and when bleeding is logged during pregnancy, the matching reference lines appear.
- A sources screen names the text and sections every line comes from.

## Non-goals

- Verdicts of any kind: "this is haid", "this is istihada", "you may pray", "you must fast".
- Rules for intermittent bleeding (talfiq), for telling blood apart by colour or smell, or for a woman's personal pattern beyond quoting the reference.
- Prayer times or prayer tracking.
- Any reference after a miscarriage or other loss. Whether that bleeding counts as nifas depends on details the verified source doesn't settle, so after a loss the app shows nothing religious at all.
- Expiation (feeding) for fasts made up after the following Ramadan. It's a ruling, not a count.
- Other schools. The structure allows them; none is built.

## Anti-goals

- Any sentence that tells her what she may or must do religiously.
- A Maliki number written directly into a screen. Every limit comes from the rules module.
- A missed-fast count presented as certain. The calendar's Ramadan dates can differ from the local moon sighting by a day or two, and she knows her own days better than her logs do.
- Anything religious appearing for a user who hasn't switched the option on.

## Source

Every rule and reference line comes from one book, verified on 2026-11-22: *The Risala of Ibn Abi Zayd al-Qayrawani*, translated by Aisha Bewley, including the translator's commentary quoting Khalil's *Mukhtasar*.

| Reference (Maliki) | What the text says | Section |
|---|---|---|
| Shortest haid | No minimum in time; the minimum is one spurt | 2.5, 2.2f (Khalil) |
| Longest haid | Fifteen days | 2.5, 2.5e |
| A woman with a usual length | Her usual length plus up to three days of precaution, never beyond fifteen | 2.5 (Khalil) |
| Shortest purity between two haids | Fifteen days, with no maximum | 2.5 (Khalil) |
| Beyond the longest | Istihada: she washes, prays and fasts | 2.5e |
| Haid during pregnancy | At most twenty days from the third month, thirty from the sixth | 2.2f (Khalil) |
| Longest nifas | Sixty days, then istihada | 2.6b |
| End of haid | White discharge or dryness, then ghusl | 2.5 |
| Making up | The menstruating woman makes up the fast, not the prayer | 23 |

French readers are pointed to the same book in Léon Bercher's French translation (*La Risâla*), which uses "menstrues (hayd)", "lochies (nifâs)" and "istihâda"; the app's French wording follows those terms.

The app cites the book by title, translator and section, with **no link**: both translations are under copyright and the online copies may not be authorised.

## Approaches considered

1. **A rules module per school (chosen).** A typed `SchoolRules` interface with a Maliki implementation in `src/utils/fiqh/`, and a `school` setting. Screens ask the module for reference values and note keys, and never contain a number. A new school is one new file plus its text.
2. **Numbers written into the screens.** Quickest, but breaks the owner's "other schools later" requirement.
3. **Rules as a JSON file.** Fine for plain limits, but rules like "twenty days from the third month of pregnancy" need logic, and the file would grow into a small programming language.

## The design

### The switch

- Settings gets an "Islamic option" section with one switch, "Follow the Maliki school".
- A new settings column `school` (text, nullable): `'maliki'` or null. Additive migration, 0006.
- Turning it on also turns the star sign off and switches the calendar to Hijri, and says so in one line under the switch. She can change both back independently.
- Turning it off hides everything below. Her made-up fast ticks are kept, in case she turns it back on.

### The rules module

`src/utils/fiqh/` holds pure functions with tests:

- `types.ts`: `SchoolRules`, with `haidMaxDays`, `habitPrecautionDays`, `purityMinDays`, `nifasMaxDays`, a list of reference lines (translation keys) and a list of citations (book and section).
- `maliki.ts`: the values in the source table above.
- `index.ts`: `rulesFor(school)`, returning null when the option is off.
- `bleeding.ts`, built on the existing cycle helpers:
  - `currentBleeding(periods, logs, today)`: when she is bleeding today, the start of this run of bleeding and today's day number. A run is consecutive days that are either inside a logged period's window or have flow logged, bridging a single unlogged day, the same tolerance the cycle maths already uses.
  - *Builder's call:* a period's window is the one the calendar already draws, from `computePeriodDuration`: the confirmed end date, else the days with flow logged, else the settings default. It is not the 15-day window the day sheet uses to decide which period a day belongs to. That way, a period never marked as ended doesn't turn into 15 days of bleeding in the counts or in the Ramadan suggestion, and the counts always match what she sees on the calendar.
  - `purityBefore(runStart, periods, logs)`: days between the end of the previous run and the start of this one.
  - `referenceNotes(run, purity, rules)`: neutral note keys, never verdicts:
    - `beyond_haid_max` when the run is longer than `haidMaxDays`;
    - `short_purity` when the purity before it was shorter than `purityMinDays`;
    - `beyond_nifas_max` for bleeding after a birth longer than `nifasMaxDays`.

### Where it shows

**Home, cycle mode:** a small card under the phase banner, only while she is bleeding or within 15 days of her last bleeding.
- The count: "Day 6 of bleeding", or "8 days of purity since your last bleeding".
- The reference: "In the Maliki school, haid lasts at most 15 days."
- When a note applies: "This is longer than the Maliki maximum for haid. You may want to ask someone knowledgeable about your situation."

**Day sheet, on a day with bleeding logged:** the same count for that day, with the reference line underneath.

**After a birth (the 60 days that follow):**
- In recovery, under the days-since-birth line: "In the Maliki school, nifas lasts at most 60 days." It shows on every recovery day, with or without bleeding logged.
- *Builder's call:* the count is days since the birth, which Home already shows, not days since the first logged bleeding. The source counts nifas from the birth.
- `beyond_nifas_max` appears on any day more than 60 days after the birth that has bleeding logged.
- *Builder's call:* if she logs a period within those 60 days, recovery ends and Home returns to cycle mode, as built in stage 4. For bleeding that starts within 60 days of the birth, the Islamic card then shows the nifas reference, not the haid count. No `short_purity` or `beyond_haid_max` note appears for it, so bleeding the source may treat as nifas is never measured against the haid limits.
- From day 61 onwards, the normal haid count applies. The purity before her first run after the birth is counted from the last bleeding logged in those 60 days.

**After a loss:** nothing religious is shown during recovery: no reference lines, no counts, and no Ramadan card on Home. *Builder's call:* the "Fasts to make up" screen stays reachable from Settings, because she may choose to open it herself.

**Pregnancy, on a day with bleeding logged:** under the existing line about contacting her midwife, "In the Maliki school, bleeding during pregnancy can count as haid: up to 20 days from the third month, and up to 30 from the sixth." No calculation: the source doesn't settle whether those months count from the last period or from conception, so the app quotes rather than computes.

**Ramadan fasts:** a screen, "Fasts to make up", reached from the Islamic option section in Settings and from a small card on Home whenever fasts are outstanding.
- One row per Ramadan that overlaps her logged history, most recent first.
- Each row shows the Hijri year, the suggested number of missed fasts, and the dates behind the suggestion.
- She can change the number. Once changed, it is labelled "set by you", and the suggestion no longer overrides it.
- An "I made up a fast" button records a made-up fast with a date (today by default), and each made-up date can be removed.
- Each row shows "4 of 7 made up", and the Home card shows the total still outstanding.
- One line on the screen: "Ramadan dates follow the Umm al-Qura calendar and may differ from your local moon sighting by a day or two. Correct the number if your days were different."

### Ramadan maths

Pure functions in `src/utils/fiqh/ramadan.ts`, tested:

- `ramadanRanges(fromDate, toDate)`: every Ramadan (Hijri month 9) between two Gregorian dates, through the Umm al-Qura conversion the app already uses (`toHijri`).
- `suggestedMissedFasts(range, bleedingDates)`: the dates in that Ramadan that fall on bleeding days. Bleeding days means logged period windows (as defined in the rules module), days with flow logged outside a pregnancy, and the days within 60 days after a birth that have bleeding logged.
- *Builder's call:* bleeding logged during a pregnancy, and after a loss, is left out of the suggestion. Counting it would decide whether that bleeding was haid or nifas, which is exactly the verdict this option doesn't give. The fasts screen says so in one line ("Days during a pregnancy, or after a loss, aren't counted; add them if they apply to you."), and she can raise the number herself.
- The history searched goes back to the earliest logged period or pregnancy.

### Data

Migration 0006, additive only:

- `settings.school`: text, nullable.
- `ramadan_owed`: one row per Hijri year where she changed the number (Hijri year as the primary key, owed days). With no row, the suggestion stands.
- `fasts_made_up`: id, Hijri year, date made up, created at.

### Backup

- Backups stay format version 2. The settings gain `school`, and two new optional lists hold the owed overrides and the made-up fasts.
- Older part 3 apps ignore the new fields, as the format rules intend, so they restore everything else.
- Restore rules: settings only on an empty phone, as now. An owed override is added only where the phone has none for that year. A made-up fast is added unless the phone already has one for the same year and date.
- Delete-all also clears both tables and the school setting.

### Sources screen

"About the Maliki reference", reached from the Islamic option section and from every reference line.
- It cites the book, translator and sections for each line, in a table like the one above, and names the French translation.
- It says, in its own card: "These references have not been checked by a scholar. They are not a fatwa. For your own situation, ask someone knowledgeable you trust."

### Wording

- English uses haid, istihada, nifas and ghusl in italics on first use, with a short plain gloss.
- French uses Bercher's terms ("menstrues (hayd)", "lochies (nifâs)", "istihâda") and "lavage rituel (ghusl)".
- No sentence is phrased as an instruction.

### Testing

- Pure functions with tests:
  - each Maliki reference value
  - `rulesFor` returning null when the option is off
  - bleeding runs (consecutive days, a one-day gap bridged, two separate runs)
  - purity between runs
  - every reference note at its boundary (day 15 against day 16, purity 14 against 15, nifas day 60 against 61)
  - Ramadan ranges for known years (Ramadan 1447 and 1448 under Umm al-Qura)
  - the missed-fast suggestion
  - overrides and made-up counts
  - backup of the new fields
- A completeness test for the new English and French text.
- On the emulator, over the stage 4 data:
  - migration 0006
  - the switch and its defaults
  - the Home card while bleeding and past 15 days
  - the day sheet line
  - the recovery line
  - the pregnancy line
  - the fasts screen: suggestion, override, making up and undoing
  - backup round trip
  - option off showing nothing

## Left to the builder

- Exact layout of the cards and the fasts screen, within the existing theme.
- Exact English and French wording, under the rules in "Wording" and "Anti-goals".

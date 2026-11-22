# Stage 6: Extras (short design)

The owner asked for this stage to be built on the builder's picks, without a
design conversation. These are those picks, written down so the next session
knows what was meant.

## Why

Lumi records a lot about her days but gives little of it back, and what it
records is limited to a fixed list. This stage makes the logs answer her
own questions ("when do my headaches come?"), lets her bring them to a
doctor, and lets her log what actually happens to her.

## Custom symptoms

- She adds a symptom from the day sheet ("+ Add your own"), typing a name. It then appears on every day sheet, cycle and pregnancy alike, after the built-in ones.
- Settings has "My symptoms": rename, or hide one from the day sheet. Hiding keeps past logs readable; nothing is ever deleted from her history.
- Stored in a new table `custom_symptoms` (id, label, hidden, created at). A log stores `custom:<id>` among its symptom keys, so renaming changes every past day at once.
- Every place that shows a symptom name goes through one label function: the day sheet, Insights, the symptom chart, pregnancy Insights, the Journey's week summaries, the CSV export and the doctor summary.
- Backups stay format version 2 with one more optional list. Restore adds symptoms whose id the phone doesn't have. Delete-all clears them.

## Patterns

- A "Patterns" card in Insights (cycle mode), made of plain sentences, each with its evidence: "Headache: usually in the 3 days before your period (5 of 6 times)."
- Only completed cycles count (a later period exists), and never a gap that holds a pregnancy.
- Each day she logged is placed in one window: during her period, the 3 days before the next period, or the rest of the cycle.
- A sentence appears for a symptom or mood logged on at least 4 days, across at least 2 cycles, with at least 60% of those days in one window. Most frequent first, at most 5 sentences.
- Below the minimum the card says how much more logging it needs, rather than nothing.
- The symptom chart switches from a fixed five to her five most logged symptoms, custom ones included.
- Wording describes her own logs. It never names a condition or gives medical advice.

## Doctor summary

- A screen, "Summary for a doctor", reached from Insights and from Settings' data section, previewing exactly what the PDF holds, with a "Share as PDF" button (`expo-print`, then the share sheet).
- It covers the last 12 months: each cycle's start date and length, each period's length, the average and the range of both, the usual cycle variation, her most logged symptoms and moods with counts, and the patterns above.
- During a pregnancy or recovery it adds a short pregnancy section: due date, weeks today or how it ended, and visit dates.
- Dates are always Gregorian, because that is what a doctor reads; text follows the app's language.
- Left out on purpose: notes (private, often not for a doctor), photos, star sign and everything from the Islamic option.
- A line at the bottom: "Made from her own logs in Lumi. Not a medical record."
- The summary is built by pure functions (data, then HTML) with tests; the screen and the PDF use the same data.

## Not in this stage

- Sharing anything without her pressing Share.
- Predictions beyond what the app already makes.
- Custom moods.

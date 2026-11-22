/**
 * The week-by-week content must be complete in every language: a missing
 * entry or field fails here instead of showing a blank card to a user.
 */

import { CONTENT, WEEK_DATA, contentForWeek, entryWeekFor, milestoneWeeks } from './pregnancy-content';

describe('week-by-week content', () => {
  const weeks = WEEK_DATA.map((w) => w.week);

  it('covers week 0 and every week from 4 to 41, once each', () => {
    expect(weeks).toEqual([0, ...Array.from({ length: 38 }, (_, i) => i + 4)]);
  });

  it.each(['en', 'fr'] as const)('has complete %s text for every week, and nothing extra', (language) => {
    const text = CONTENT[language].weeks;
    expect(Object.keys(text).map(Number).sort((a, b) => a - b)).toEqual(weeks);
    for (const week of weeks) {
      const entry = text[String(week)];
      expect(entry.baby.trim().length).toBeGreaterThan(20);
      expect(entry.body.trim().length).toBeGreaterThan(20);
      // Every week from 4 on is compared to something; weeks 0-3 aren't.
      if (week > 0) expect(entry.size.trim().length).toBeGreaterThan(0);
      if (entry.milestone) expect(CONTENT[language].milestones[entry.milestone]).toBeTruthy();
    }
  });

  it('puts the same milestones on the same weeks in both languages', () => {
    const pick = (l: 'en' | 'fr') => milestoneWeeks(l).map(({ week, key }) => [week, key]);
    expect(pick('fr')).toEqual(pick('en'));
    expect(pick('en')).toEqual([
      [20, 'halfway'],
      [37, 'full_term'],
      [40, 'due_date'],
    ]);
  });

  it('gives every week an emoji, and lengths that only grow', () => {
    let previous = 0;
    for (const w of WEEK_DATA) {
      expect(w.emoji.length).toBeGreaterThan(0);
      if (w.lengthCm !== null) {
        expect(w.lengthCm).toBeGreaterThanOrEqual(previous);
        previous = w.lengthCm;
      }
    }
  });
});

describe('entryWeekFor and contentForWeek', () => {
  it('shares one entry for weeks 0 to 3', () => {
    expect([0, 1, 2, 3].map((w) => entryWeekFor(w))).toEqual([0, 0, 0, 0]);
  });

  it('uses the week 41 entry for 41 and beyond', () => {
    expect(entryWeekFor(41)).toBe(41);
    expect(entryWeekFor(43)).toBe(41);
  });

  it('returns the size and text for a week in the chosen language', () => {
    const week20 = contentForWeek(20, 'en');
    expect(week20).toMatchObject({ entryWeek: 20, lengthCm: 25.6, measure: 'head_to_heel', milestone: 'halfway' });
    expect(week20.size).toBe('a banana');
    expect(contentForWeek(20, 'fr').size).toBe('une banane');
  });
});

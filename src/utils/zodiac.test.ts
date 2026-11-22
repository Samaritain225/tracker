/**
 * Tests for star signs.
 */

import { likelyStarSign, starSignFor } from './zodiac';

describe('starSignFor', () => {
  it.each([
    ['2027-01-19', 'capricorn'],
    ['2027-01-20', 'aquarius'],
    ['2027-02-18', 'aquarius'],
    ['2027-02-19', 'pisces'],
    ['2027-03-20', 'pisces'],
    ['2027-03-21', 'aries'],
    ['2027-04-19', 'aries'],
    ['2027-04-20', 'taurus'],
    ['2027-05-20', 'taurus'],
    ['2027-05-21', 'gemini'],
    ['2027-06-20', 'gemini'],
    ['2027-06-21', 'cancer'],
    ['2027-07-22', 'cancer'],
    ['2027-07-23', 'leo'],
    ['2027-08-22', 'leo'],
    ['2027-08-23', 'virgo'],
    ['2027-09-22', 'virgo'],
    ['2027-09-23', 'libra'],
    ['2027-10-22', 'libra'],
    ['2027-10-23', 'scorpio'],
    ['2027-11-21', 'scorpio'],
    ['2027-11-22', 'sagittarius'],
    ['2027-12-21', 'sagittarius'],
    ['2027-12-22', 'capricorn'],
    ['2027-12-31', 'capricorn'],
    ['2028-01-01', 'capricorn'],
  ])('%s is %s', (date, sign) => {
    expect(starSignFor(date)).toBe(sign);
  });
});

describe('likelyStarSign', () => {
  it('mentions the next sign when the birth could fall after the boundary', () => {
    // Due 10 April: Aries, but 20 April onwards is Taurus.
    expect(likelyStarSign('2027-04-10')).toEqual({
      sign: 'aries',
      other: { sign: 'taurus', when: 'after', boundary: '2027-04-19' },
    });
  });

  it('mentions the previous sign when the birth could fall before the boundary', () => {
    // Due 25 March: Aries, but up to 20 March is Pisces.
    expect(likelyStarSign('2027-03-25')).toEqual({
      sign: 'aries',
      other: { sign: 'pisces', when: 'before', boundary: '2027-03-21' },
    });
  });

  it('gives one sign when the due date sits well inside it', () => {
    // Due 5 April 2027 with a 10-day window: 26 March to 15 April, all Aries.
    expect(likelyStarSign('2027-04-05', 10)).toEqual({ sign: 'aries', other: null });
  });

  it('mentions the nearer boundary first', () => {
    // Due 3 April: Pisces 14 days earlier (20 March), Taurus 17 days
    // later (20 April) — only Pisces is in reach, and it is nearer.
    expect(likelyStarSign('2027-04-03').other).toEqual({
      sign: 'pisces',
      when: 'before',
      boundary: '2027-03-21',
    });
  });

  it('stays Capricorn across New Year', () => {
    // 22 December to 19 January either side of 5 January: all Capricorn.
    expect(likelyStarSign('2028-01-05')).toEqual({ sign: 'capricorn', other: null });
  });
});

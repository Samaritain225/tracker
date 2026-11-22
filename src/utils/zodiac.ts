/**
 * Western (tropical) star signs, for the "baby's likely star sign" detail
 * on the pregnancy screens. Pure functions with tests.
 */

import { addDays, parseISODate, toISODate } from './date';

export type StarSign =
  | 'capricorn'
  | 'aquarius'
  | 'pisces'
  | 'aries'
  | 'taurus'
  | 'gemini'
  | 'cancer'
  | 'leo'
  | 'virgo'
  | 'libra'
  | 'scorpio'
  | 'sagittarius';

export const STAR_SIGN_SYMBOLS: Record<StarSign, string> = {
  capricorn: '♑',
  aquarius: '♒',
  pisces: '♓',
  aries: '♈',
  taurus: '♉',
  gemini: '♊',
  cancer: '♋',
  leo: '♌',
  virgo: '♍',
  libra: '♎',
  scorpio: '♏',
  sagittarius: '♐',
};

/** First day of each sign as [month (1-12), day], in calendar order. */
const SIGN_STARTS: [StarSign, number, number][] = [
  ['capricorn', 1, 1], // continues from 22 December
  ['aquarius', 1, 20],
  ['pisces', 2, 19],
  ['aries', 3, 21],
  ['taurus', 4, 20],
  ['gemini', 5, 21],
  ['cancer', 6, 21],
  ['leo', 7, 23],
  ['virgo', 8, 23],
  ['libra', 9, 23],
  ['scorpio', 10, 23],
  ['sagittarius', 11, 22],
  ['capricorn', 12, 22],
];

export function starSignFor(dateISO: string): StarSign {
  const date = parseISODate(dateISO);
  const md = (date.getMonth() + 1) * 100 + date.getDate();
  let sign: StarSign = 'capricorn';
  for (const [s, m, d] of SIGN_STARTS) {
    if (md >= m * 100 + d) sign = s;
  }
  return sign;
}

/** How far either side of a due date a birth can reasonably fall. */
export const DUE_DATE_UNCERTAINTY_DAYS = 14;

export type LikelyStarSign = {
  sign: StarSign;
  /**
   * Set when the sign changes within the uncertainty window around the
   * due date: "Aries, or Taurus if after 19 April". `boundary` is the last
   * day of `sign` when `when` is 'after', or its first day when 'before'.
   */
  other: { sign: StarSign; when: 'before' | 'after'; boundary: string } | null;
};

/**
 * The likely sign for a due date, and the neighbouring one when the
 * birth could easily fall on the other side of a boundary. A due date is
 * an estimate, so a single confident sign would often be wrong.
 */
export function likelyStarSign(
  dueDateISO: string,
  uncertaintyDays: number = DUE_DATE_UNCERTAINTY_DAYS,
): LikelyStarSign {
  const sign = starSignFor(dueDateISO);
  const due = parseISODate(dueDateISO);

  // Walk outwards a day at a time and stop at the nearer boundary, so
  // the closer alternative is the one mentioned.
  for (let offset = 1; offset <= uncertaintyDays; offset++) {
    const later = toISODate(addDays(due, offset));
    if (starSignFor(later) !== sign) {
      return {
        sign,
        other: {
          sign: starSignFor(later),
          when: 'after',
          boundary: toISODate(addDays(due, offset - 1)),
        },
      };
    }
    const earlier = toISODate(addDays(due, -offset));
    if (starSignFor(earlier) !== sign) {
      return {
        sign,
        other: {
          sign: starSignFor(earlier),
          when: 'before',
          boundary: toISODate(addDays(due, -offset + 1)),
        },
      };
    }
  }

  return { sign, other: null };
}

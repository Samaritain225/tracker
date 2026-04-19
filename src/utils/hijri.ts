/**
 * Hijri (Islamic) calendar conversion utilities.
 * Uses native Intl API with the Umm al-Qura calculation (islamic-umalqura).
 * Zero external dependencies.
 */

type HijriParts = {
  day: number;
  month: number;
  year: number;
  monthName: string;
};

/**
 * Converts a Gregorian Date to Hijri display parts.
 */
export function toHijri(date: Date): HijriParts {
  const formatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const parts = formatter.formatToParts(date);

  let day = 1;
  let month = 1;
  let year = 1;
  let monthName = '';

  for (const part of parts) {
    switch (part.type) {
      case 'day':
        day = parseInt(part.value, 10);
        break;
      case 'month':
        monthName = part.value;
        // Derive month number from a separate formatter
        break;
      case 'year':
        year = parseInt(part.value, 10);
        break;
    }
  }

  // Get numeric month via a separate formatter
  const monthFormatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
    month: 'numeric',
  });
  const monthParts = monthFormatter.formatToParts(date);
  for (const part of monthParts) {
    if (part.type === 'month') {
      month = parseInt(part.value, 10);
    }
  }

  return { day, month, year, monthName };
}

/**
 * Formats a month header in Hijri calendar.
 *
 * A Gregorian month may span two Hijri months.
 * Uses the 15th of the month as the representative date for the header label.
 *
 * e.g. "Shawwal 1446" (en) or "Chawwal 1446" (fr)
 */
export function formatHijriMonthHeader(
  gregorianYear: number,
  gregorianMonth: number,
  locale: 'en' | 'fr',
): string {
  const mid = new Date(gregorianYear, gregorianMonth, 15);
  const localeTag = locale === 'fr' ? 'fr-u-ca-islamic-umalqura' : 'en-u-ca-islamic-umalqura';
  const fmt = new Intl.DateTimeFormat(localeTag, {
    month: 'long',
    year: 'numeric',
  });
  return fmt.format(mid);
}

/**
 * Gets the Hijri day number for display in a calendar cell.
 */
export function getHijriDay(date: Date): number {
  const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
    day: 'numeric',
  });
  return parseInt(fmt.format(date), 10);
}

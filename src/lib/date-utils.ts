/**
 * Shared date utility functions for consistent date handling across actions.
 *
 * IMPORTANT: All dates are calculated relative to Brazil timezone (America/Sao_Paulo)
 * to ensure "Hoje" means today in Brazil, not today in UTC (Vercel runs in UTC).
 * Date boundaries use UTC midnight/end-of-day for consistent Prisma queries.
 */

const BRAZIL_TZ = "America/Sao_Paulo";

/**
 * Get current date string in Brazil timezone (YYYY-MM-DD).
 * When it's 11pm in Brazil (2am UTC next day), this still returns today's Brazil date.
 */
function getBrazilToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: BRAZIL_TZ });
}

/**
 * Parse a YYYY-MM-DD string into a UTC Date at midnight.
 */
function parseDateUTC(dateStr: string): Date {
  const clean = dateStr.split("T")[0];
  const [year, month, day] = clean.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Get date range for queries.
 * - Always returns both `since` and `until`
 * - `since` is at UTC 00:00:00.000, `until` is at UTC 23:59:59.999
 * - Preset periods (days) use Brazil timezone to determine "today"
 * - Custom from/to strings are parsed as-is (YYYY-MM-DD)
 */
export function getDateRange(
  days: number,
  from?: string,
  to?: string
): { since: Date; until: Date } {
  let sinceStr: string;
  let untilStr: string;

  if (from && to) {
    sinceStr = from.split("T")[0];
    untilStr = to.split("T")[0];
  } else {
    // Use Brazil timezone to determine "today"
    untilStr = getBrazilToday();
    if (days === 0) {
      sinceStr = untilStr;
    } else {
      const ref = parseDateUTC(untilStr);
      ref.setUTCDate(ref.getUTCDate() - days);
      sinceStr = ref.toISOString().split("T")[0];
    }
  }

  const since = parseDateUTC(sinceStr);
  since.setUTCHours(0, 0, 0, 0);

  const until = parseDateUTC(untilStr);
  until.setUTCHours(23, 59, 59, 999);

  return { since, until };
}

/**
 * Get the previous period date range for comparison.
 * If current period is 7 days, previous is the 7 days before that.
 */
export function getPreviousDateRange(
  days: number,
  from?: string,
  to?: string
): { since: Date; until: Date } {
  const current = getDateRange(days, from, to);

  const durationMs = current.until.getTime() - current.since.getTime();
  const durationDays = Math.max(1, Math.ceil(durationMs / (1000 * 60 * 60 * 24)));

  // Previous period ends 1ms before current starts
  const previousUntil = new Date(current.since.getTime() - 1);

  const previousSince = new Date(previousUntil);
  previousSince.setUTCDate(previousSince.getUTCDate() - durationDays);
  previousSince.setUTCHours(0, 0, 0, 0);

  return { since: previousSince, until: previousUntil };
}

/**
 * Build a Prisma date filter object.
 */
export function buildDateFilter(range: { since: Date; until: Date }) {
  return { gte: range.since, lte: range.until };
}

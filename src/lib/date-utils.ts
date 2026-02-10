/**
 * Shared date utility functions for consistent date handling across actions.
 *
 * IMPORTANT: All dates are calculated relative to Brazil timezone (America/Sao_Paulo).
 * "Hoje" means today in Brazil, not today in UTC (Vercel runs in UTC).
 * Date boundaries are converted from Brasilia local time to UTC for Prisma queries.
 *
 * Brasilia (UTC-3): Start of day 00:00 BRT = 03:00 UTC
 *                   End of day 23:59:59 BRT = 02:59:59 UTC (next day)
 */

export const BRAZIL_TZ = "America/Sao_Paulo";

/**
 * Get current date string in Brazil timezone (YYYY-MM-DD).
 * When it's 11pm in Brazil (2am UTC next day), this still returns today's Brazil date.
 */
export function getBrazilToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: BRAZIL_TZ });
}

/**
 * Parse a YYYY-MM-DD string into a UTC Date at midnight UTC.
 */
function parseDateUTC(dateStr: string): Date {
  const clean = dateStr.split("T")[0];
  const [year, month, day] = clean.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Convert a YYYY-MM-DD date string to the START of that day in Brasilia (00:00:00 BRT),
 * returned as a UTC Date object.
 * Brasilia is UTC-3, so 00:00 BRT = 03:00 UTC.
 */
export function toBrasiliaStartOfDay(dateStr: string): Date {
  const clean = dateStr.split("T")[0];
  const [year, month, day] = clean.split("-").map(Number);
  // 00:00:00 in Brasilia = 03:00:00 UTC (UTC-3)
  return new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0));
}

/**
 * Convert a YYYY-MM-DD date string to the END of that day in Brasilia (23:59:59.999 BRT),
 * returned as a UTC Date object.
 * Brasilia is UTC-3, so 23:59:59 BRT = 02:59:59 UTC (next day).
 */
export function toBrasiliaEndOfDay(dateStr: string): Date {
  const clean = dateStr.split("T")[0];
  const [year, month, day] = clean.split("-").map(Number);
  // 23:59:59.999 in Brasilia = 02:59:59.999 UTC (next day)
  return new Date(Date.UTC(year, month - 1, day + 1, 2, 59, 59, 999));
}

/**
 * Convert any Date/timestamp to a YYYY-MM-DD string in Brasilia timezone.
 * Use this when grouping orders by day for display.
 */
export function toDateKeyBrasilia(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-CA", { timeZone: BRAZIL_TZ });
}

/**
 * Format a Date for API calls, converting a Brasilia local date to ISO string.
 * Useful when sending date filters to external APIs (Shopify, Nuvemshop, etc.).
 */
export function toBrasiliaISO(dateStr: string, startOfDay: boolean = true): string {
  if (startOfDay) {
    return toBrasiliaStartOfDay(dateStr).toISOString();
  }
  return toBrasiliaEndOfDay(dateStr).toISOString();
}

/**
 * Parse a date from an external platform (Shopify, Nuvemshop, etc.) and
 * return a Date object. Preserves the timezone offset from the original string.
 * If no timezone info, treats as Brasilia (UTC-3).
 */
export function parseOrderDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  // If the string has timezone info (e.g., "2026-02-08T22:00:00-03:00"),
  // JavaScript Date constructor handles it correctly as UTC internally.
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return new Date();
  return d;
}

/**
 * Format a date string for Facebook/Google Ads API calls.
 * Returns YYYY-MM-DD in Brasilia timezone.
 */
export function toBrasiliaDateStr(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: BRAZIL_TZ });
}

/**
 * Get date range for queries.
 * - Always returns both `since` and `until`
 * - `since` is start of day in Brasilia (converted to UTC)
 * - `until` is end of day in Brasilia (converted to UTC)
 * - Preset periods (days) use Brazil timezone to determine "today"
 * - Custom from/to strings are parsed as Brasilia dates
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

  return {
    since: toBrasiliaStartOfDay(sinceStr),
    until: toBrasiliaEndOfDay(untilStr),
  };
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
  previousSince.setUTCHours(3, 0, 0, 0); // Start of day in Brasilia

  return { since: previousSince, until: previousUntil };
}

/**
 * Build a Prisma date filter object.
 */
export function buildDateFilter(range: { since: Date; until: Date }) {
  return { gte: range.since, lte: range.until };
}

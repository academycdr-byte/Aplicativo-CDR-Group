/**
 * Shared date utility functions for consistent date handling across actions.
 * Fixes timezone issues and ensures proper date range calculations.
 */

/**
 * Get date range for queries.
 * - Always returns both `since` and `until`
 * - `until` is always set to end of day (23:59:59.999)
 * - When using custom from/to strings, parses as YYYY-MM-DD local dates
 */
export function getDateRange(
  days: number,
  from?: string,
  to?: string
): { since: Date; until: Date } {
  let since: Date;
  let until: Date;

  if (from && to) {
    // Parse as local date parts to avoid timezone shift
    since = parseLocalDate(from);
    until = parseLocalDate(to);
  } else {
    until = new Date();
    since = new Date();
    if (days === 0) {
      since.setHours(0, 0, 0, 0);
    } else {
      since.setDate(since.getDate() - days);
      since.setHours(0, 0, 0, 0);
    }
  }

  // Always set until to end of day
  until.setHours(23, 59, 59, 999);

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

  // Calculate duration in days (round up to at least 1)
  const durationMs = current.until.getTime() - current.since.getTime();
  const durationDays = Math.max(1, Math.ceil(durationMs / (1000 * 60 * 60 * 24)));

  // Previous period ends 1ms before current starts
  const previousUntil = new Date(current.since.getTime() - 1);
  const previousSince = new Date(previousUntil);
  previousSince.setDate(previousSince.getDate() - durationDays);
  previousSince.setHours(0, 0, 0, 0);

  return { since: previousSince, until: previousUntil };
}

/**
 * Parse a date string as local date (not UTC).
 * Handles both "YYYY-MM-DD" and ISO strings.
 */
function parseLocalDate(dateStr: string): Date {
  // If it's a simple YYYY-MM-DD, parse as local
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  // For ISO strings, extract the date part and parse as local
  const datePart = dateStr.split("T")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const [year, month, day] = datePart.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(dateStr);
}

/**
 * Build a Prisma date filter object.
 */
export function buildDateFilter(range: { since: Date; until: Date }) {
  return { gte: range.since, lte: range.until };
}

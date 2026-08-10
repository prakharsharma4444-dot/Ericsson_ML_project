// Parses a "dd/mm/yyyy" string into a real Date object.
// JS's built-in `new Date("07/08/2026")` assumes MM/DD/YYYY and silently
// gives the wrong date for dd/mm/yyyy input — this avoids that trap.
export function parseDDMMYYYY(value) {
  if (!value) return null;
  const str = String(value).trim();
  const match = str.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const day = parseInt(dd, 10);
  const month = parseInt(mm, 10);
  const year = parseInt(yyyy, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  return isNaN(date) ? null : date;
}

export function daysBetween(from, to) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((to.getTime() - from.getTime()) / msPerDay);
}

// Overdue = High, due within 7 days = Medium, else Low
export function calculatePriority(targetDate, today = new Date()) {
  if (!targetDate) return 'low';
  const daysUntil = daysBetween(today, targetDate);
  if (daysUntil < 0) return 'high';
  if (daysUntil <= 7) return 'medium';
  return 'low';
}
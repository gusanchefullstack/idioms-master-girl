/** Local calendar date YYYY-MM-DD (the laptop's timezone, not UTC). */
export function localDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toUtcNoon(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 12);
}

/** Add n days to a YYYY-MM-DD string without timezone drift. */
export function addDays(date: string, n: number): string {
  const t = new Date(toUtcNoon(date) + n * 86_400_000);
  return t.toISOString().slice(0, 10);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtcNoon(b) - toUtcNoon(a)) / 86_400_000);
}

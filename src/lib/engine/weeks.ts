/** ISO-week helpers. All planning weeks start on Monday and are stored as YYYY-MM-DD. */
export const toIso = (d: Date) => d.toISOString().slice(0, 10);

export const weekStart = (input: string | Date): string => {
  const d = new Date(typeof input === "string" ? `${input.slice(0, 10)}T00:00:00Z` : input);
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  const diff = (day + 6) % 7; // days since Monday
  d.setUTCDate(d.getUTCDate() - diff);
  return toIso(d);
};

export const addWeeks = (week: string, n: number): string => {
  const d = new Date(`${week}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7 * n);
  return toIso(d);
};

export const weekRange = (from: string, count: number): string[] => Array.from({ length: count }, (_, i) => addWeeks(from, i));

export const monthFirstWeek = (yyyyMm: string): string => weekStart(`${yyyyMm.slice(0, 7)}-01`);

export const thisWeek = () => weekStart(new Date());

export const fmtWeek = (week: string) => {
  const d = new Date(`${week}T00:00:00Z`);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })}`;
};

export const isoWeekNumber = (week: string): number => {
  const d = new Date(`${week}T00:00:00Z`);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};

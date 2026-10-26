export const kg = (n: number | null | undefined, digits = 0) =>
  n === null || n === undefined ? "—" : `${Math.round(n).toLocaleString("en-GB", { maximumFractionDigits: digits })}`;

export const tonnes = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${(n / 1000).toLocaleString("en-GB", { maximumFractionDigits: 1 })} t`);

export const pct = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${Math.round(n * 100)}%`);

export const fmtAsOf = (d: string | null | undefined) => {
  if (!d) return "none";
  const x = new Date(`${d}T00:00:00Z`);
  return x.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
};

export const staleness = (d: string | null | undefined, staleAfterDays: number): "ok" | "stale" | "missing" => {
  if (!d) return "missing";
  const age = (Date.now() - new Date(`${d}T00:00:00Z`).getTime()) / 86400000;
  return age > staleAfterDays ? "stale" : "ok";
};

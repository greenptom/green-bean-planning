"use client";
import { useState } from "react";

/**
 * The forecast export is ~11 MB — over the 4.5 MB request limit on Vercel — so it is parsed here in the browser
 * and sent as compact rows in batches. Locked beats Forecast when set.
 */
type Progress = { stage: string; done?: number; total?: number; error?: string; result?: { demand_rows: number; green_rows: number; unmapped: string[] } };

const BATCH = 4000;

export const ForecastUploadForm = () => {
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [p, setP] = useState<Progress | null>(null);

  const post = async (payload: unknown) => {
    const r = await fetch("/api/upload/rows", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const j = await r.json();
    if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : JSON.stringify(j.error));
    return j;
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const file = (new FormData(e.currentTarget).get("file") as File | null) ?? null;
    if (!file) return;
    setBusy(true);
    setP({ stage: "Reading workbook…" });
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const sheetName = wb.SheetNames.find((n) => /forecast/i.test(n)) ?? wb.SheetNames[0];
      const table = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], { defval: null, raw: true });
      const rows = table
        .map((r) => {
          const sku = String(r.SKU ?? r.sku ?? "").trim();
          const w = r.Week ?? r.week ?? r.forecast_date;
          const week = w instanceof Date ? w.toISOString().slice(0, 10) : String(w ?? "").slice(0, 10);
          const locked = Number(r.Locked ?? 0) || 0;
          const fc = Number(r.Forecast ?? r.forecast_value ?? 0) || 0;
          const units = locked > 0 ? locked : fc;
          return { sku, week, units, channel: (r["Forecast Channel"] ?? r.Channel ?? r.channel ?? null) as string | null };
        })
        .filter((r) => r.sku && /^\d{4}-\d{2}-\d{2}/.test(r.week) && r.units > 0);
      if (!rows.length) throw new Error(`No rows with SKU, Week and Forecast/Locked found on sheet “${sheetName}”.`);

      setP({ stage: "Starting upload…", done: 0, total: rows.length });
      const { upload_id } = await post({ action: "begin", kind: "forecast", as_of: asOf, file_name: file.name, total: rows.length });
      for (let i = 0; i < rows.length; i += BATCH) {
        await post({ action: "rows", kind: "forecast", as_of: asOf, upload_id, rows: rows.slice(i, i + BATCH) });
        setP({ stage: "Uploading rows…", done: Math.min(i + BATCH, rows.length), total: rows.length });
      }
      setP({ stage: "Computing green demand…", done: rows.length, total: rows.length });
      const result = await post({ action: "finish", kind: "forecast", as_of: asOf, upload_id });
      setP({ stage: "Done", result });
    } catch (err) {
      setP({ stage: "Failed", error: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2">
      <label className="text-xs">As of<br /><input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="rounded border border-rule bg-paper px-2 py-1 text-sm" /></label>
      <input type="file" name="file" required accept=".xlsx,.xls,.csv" className="text-xs" />
      <button type="submit" disabled={busy} className="rounded bg-ink text-paper px-3 py-1.5 text-sm disabled:opacity-50">{busy ? "Working…" : "Upload"}</button>
      {p && (
        <div className={`basis-full text-xs mt-2 rounded p-2 ${p.error ? "bg-red-soft" : p.result ? "bg-green-soft" : "bg-paper-2"}`}>
          <p>{p.stage}{p.total ? ` ${p.done?.toLocaleString()} / ${p.total.toLocaleString()} rows` : ""}</p>
          {p.error && <p className="mt-1">{p.error}</p>}
          {p.result && (
            <p className="mt-1">{p.result.demand_rows.toLocaleString()} forecast rows saved → {p.result.green_rows.toLocaleString()} green-demand rows.{p.result.unmapped.length ? ` No recipe for: ${p.result.unmapped.slice(0, 15).join(", ")}${p.result.unmapped.length > 15 ? ` +${p.result.unmapped.length - 15} more` : ""}.` : ""}</p>
          )}
        </div>
      )}
    </form>
  );
};

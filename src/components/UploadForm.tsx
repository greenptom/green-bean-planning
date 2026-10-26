"use client";
import { useState } from "react";

type Result = { persisted: boolean; rows: number; warnings: string[]; headers?: string[]; error?: string };

export const UploadForm = ({ kind }: { kind: string }) => {
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("kind", kind);
    fd.set("as_of", asOf);
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      setResult(await r.json());
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2">
      <label className="text-xs">As of<br /><input type="date" name="as_of" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="rounded border border-rule bg-paper px-2 py-1 text-sm" /></label>
      <input type="file" name="file" required accept=".xlsx,.xls,.csv" className="text-xs" />
      <button type="submit" disabled={busy} className="rounded bg-ink text-paper px-3 py-1.5 text-sm disabled:opacity-50">{busy ? "Parsing…" : "Upload"}</button>
      {result && (
        <div className={`basis-full text-xs mt-2 rounded p-2 ${result.error ? "bg-red-soft" : result.persisted ? "bg-green-soft" : "bg-paper-2"}`}>
          {result.error ? <p>Upload failed: {result.error}</p> : <p>{result.rows} rows {result.persisted ? "saved" : "parsed (preview only)"}.</p>}
          {result.warnings?.length ? <ul className="list-disc pl-4 mt-1 space-y-0.5">{result.warnings.slice(0, 12).map((w, i) => <li key={i}>{w}</li>)}{result.warnings.length > 12 && <li>…and {result.warnings.length - 12} more</li>}</ul> : null}
          {result.headers && <p className="text-ink-3 mt-1">Columns seen: {result.headers.join(", ")}</p>}
        </div>
      )}
    </form>
  );
};

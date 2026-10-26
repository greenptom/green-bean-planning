/**
 * Upload parsers. Each takes a file buffer and returns typed rows plus warnings.
 * Header matching is case/space-insensitive so Cropster, Cin7 and the forecast tool can rename columns a little without breaking the weekly run.
 */
import * as XLSX from "xlsx";
import type { DemandFg, FgStock, FixingStatus, Lot, ProductionJob, PurchaseOrder, Site, SiteCode, Location as PlanLocation, Origin } from "../types";
import { weekStart } from "../engine/weeks";

export type ParseResult<T> = { rows: T[]; warnings: string[]; headers: string[] };

const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9#]/g, "");

export const readTable = (buf: ArrayBuffer | Buffer, sheet?: string): Record<string, unknown>[] => {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[sheet ?? wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null, raw: true });
};

const pick = (row: Record<string, unknown>, ...names: string[]): unknown => {
  const keys = Object.keys(row);
  for (const n of names) {
    const k = keys.find((x) => norm(x) === norm(n));
    if (k !== undefined && row[k] !== null && row[k] !== "") return row[k];
  }
  return null;
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

const dateIso = (v: unknown): string | null => {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  const dmy = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return ymd[0];
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
/** "April 2027" → 2027-04-01 */
const monthIso = (v: unknown): string | null => {
  const m = String(v ?? "").trim().toLowerCase().match(/^([a-z]+)\s+(\d{4})$/);
  if (!m) return null;
  const i = MONTHS.indexOf(m[1]);
  return i < 0 ? null : `${m[2]}-${String(i + 1).padStart(2, "0")}-01`;
};

// ---------- origin inference ----------
const ORIGIN_WORDS: [RegExp, string][] = [
  [/decaf/i, "DECAF"],
  [/brazil|brasil/i, "BR"], [/colombia/i, "CO"], [/guatemala/i, "GT"], [/mexico/i, "MX"], [/salvador/i, "SV"],
  [/costa\s*rica/i, "CR"], [/india/i, "IN"], [/uganda/i, "UG"], [/kenya/i, "KE"], [/ethiopia/i, "ET"], [/peru/i, "PE"], [/china/i, "CN"], [/rwanda/i, "RW"], [/nepal/i, "NP"],
];
export const inferOrigin = (text: string, country?: string | null, origins?: Origin[]): string | null => {
  const hay = `${country ?? ""} ${text}`;
  const decaf = /decaf/i.test(hay);
  let base: string | null = null;
  for (const [re, code] of ORIGIN_WORDS) if (code !== "DECAF" && re.test(hay)) { base = code; break; }
  if (!base) return null;
  const code = decaf ? `${base}_DECAF` : base;
  if (origins && !origins.some((o) => o.code === code)) return decaf ? base : null;
  return code;
};

// ---------- Cropster green inventory export ----------
const fixingFromLocation = (loc: string, locations: PlanLocation[]): FixingStatus => {
  const l = locations.find((x) => x.cropster_name === loc);
  if (l?.kind === "contracted" && l.fixing_status) return l.fixing_status;
  if (/contracted/i.test(loc)) {
    if (/fully fixed/i.test(loc)) return "fully_fixed";
    if (/c fixed/i.test(loc)) return "c_fixed_diff_open";
    if (/c open/i.test(loc)) return "c_open_diff_fixed";
    if (/fully open/i.test(loc)) return "fully_open";
  }
  return "landed";
};

export const parseCropsterLots = (buf: ArrayBuffer | Buffer, asOf: string, ctx: { locations: PlanLocation[]; origins: Origin[] }): ParseResult<Lot> => {
  const table = readTable(buf);
  const warnings: string[] = [];
  const rows: Lot[] = [];
  for (const r of table) {
    const lotId = String(pick(r, "ID-Tag", "Cropster ID", "ID") ?? "").replace(/[\[\]]/g, "").trim();
    if (!/^PG-\d+/.test(lotId)) continue;
    const name = String(pick(r, "Name", "Inventory lot name") ?? "");
    const loc = String(pick(r, "Location") ?? "");
    const kg = num(pick(r, "Weight (KG)", "Weight", "Current inventory")) ?? 0;
    const country = pick(r, "Country") as string | null;
    const origin = inferOrigin(name, country, ctx.origins);
    if (!origin) warnings.push(`${lotId}: could not infer origin from "${name}" / ${country ?? "no country"}`);
    const location = ctx.locations.find((l) => l.cropster_name === loc);
    if (!location) warnings.push(`${lotId}: unknown Cropster location "${loc}" — add it to locations`);
    const tracking = pick(r, "Tracking #", "Tracking");
    const arrival = monthIso(tracking);
    const fixing = fixingFromLocation(loc, ctx.locations);
    if (fixing !== "landed" && !arrival) warnings.push(`${lotId}: contracted but Tracking # is not a month ("${tracking ?? ""}") — no arrival week`);
    rows.push({
      as_of_date: asOf, lot_id: lotId, name, origin_code: origin, blend_designation: (pick(r, "Project") as string) ?? null,
      location_code: location?.code ?? null, cropster_location: loc,
      initial_kg: num(pick(r, "Initial weight")), kg, price_gbp_kg: num(pick(r, "Price", "Price / unit")),
      fixing_status: fixing, price_note: (pick(r, "Sales #") as string) ?? null, arrival_month: arrival,
      cin7_po: (pick(r, "PO #", "PO") as string) ?? null, cin7_sku: (pick(r, "Container #") as string) ?? null,
      supplier_contract: (pick(r, "Notes") as string) ?? null, supplier: (pick(r, "Supply network", "Importer") as string) ?? null,
      run_out_weeks: num(pick(r, "Run out estimation")),
    });
  }
  if (!rows.length) warnings.push("No PG- lots found. Export from Green Inventory → Export, or Reports → Inventory Report → By lot → Excel.");
  return { rows, warnings, headers: Object.keys(table[0] ?? {}) };
};

// ---------- Forecast – All Channels export ----------
export const parseForecast = (buf: ArrayBuffer | Buffer, asOf: string, ctx: { sites: Site[]; skuSite: (sku: string) => SiteCode }): ParseResult<DemandFg> => {
  const table = readTable(buf);
  const warnings: string[] = [];
  const rows: DemandFg[] = [];
  for (const r of table) {
    const sku = String(pick(r, "SKU", "sku") ?? "").trim();
    const week = dateIso(pick(r, "Week", "forecast_date"));
    if (!sku || !week) continue;
    const locked = num(pick(r, "Locked"));
    const fc = num(pick(r, "Forecast", "forecast_value"));
    const units = locked && locked > 0 ? locked : fc ?? 0;
    if (!units) continue;
    rows.push({ as_of_date: asOf, site_code: ctx.skuSite(sku), sku, week_start: weekStart(week), units, kind: "forecast", channel: (pick(r, "Forecast Channel", "Channel", "channel") as string) ?? null, source: "Forecast – All Channels" });
  }
  if (!rows.length) warnings.push("No forecast rows with SKU + Week found.");
  return { rows, warnings, headers: Object.keys(table[0] ?? {}) };
};

// ---------- Cin7 purchase orders export ----------
export const parseCin7Pos = (buf: ArrayBuffer | Buffer, asOf: string, ctx: { sites: Site[]; origins: Origin[] }): ParseResult<PurchaseOrder> => {
  const table = readTable(buf);
  const warnings: string[] = [];
  const rows: PurchaseOrder[] = [];
  for (const r of table) {
    const code = String(pick(r, "Code", "SKU", "Product Code") ?? "");
    if (!/^GRN/i.test(code)) continue;
    const po = String(pick(r, "Ref", "Order Ref", "PO", "Reference") ?? "");
    const branch = (pick(r, "Branch") as string) ?? null;
    const site = ctx.sites.find((s) => s.cin7_branch && branch && norm(branch).startsWith(norm(s.cin7_branch).slice(0, 5)))?.code ?? null;
    const ordered = num(pick(r, "Qty Ordered", "Ordered", "Qty"));
    const received = num(pick(r, "Qty Received", "Received")) ?? 0;
    const name = String(pick(r, "Product Name", "Product") ?? "");
    const origin = inferOrigin(name, null, ctx.origins);
    if (!origin) warnings.push(`${po} ${code}: could not infer origin from "${name}"`);
    rows.push({
      as_of_date: asOf, po_number: po, branch, site_code: site, supplier: (pick(r, "Supplier", "Company") as string) ?? null,
      supplier_contract: (pick(r, "Project Name", "Project") as string) ?? null, cin7_sku: code, product_name: name, origin_code: origin,
      qty_ordered: ordered, qty_received: received, qty_open: Math.max(0, (ordered ?? 0) - received),
      unit_cost: num(pick(r, "Unit Cost", "Cost", "Unit Price")), currency: (pick(r, "Currency") as string) ?? null,
      etd: dateIso(pick(r, "ETD")), eta: dateIso(pick(r, "ETA")), status: (pick(r, "Cin7 Status", "Status") as string) ?? null,

    });
  }
  if (!rows.length) warnings.push("No GRN lines found — export the PO list with line items (Product Code / Qty Ordered / Qty Received).");
  return { rows, warnings, headers: Object.keys(table[0] ?? {}) };
};

// ---------- Cin7 production jobs ----------
export const parseCin7Production = (buf: ArrayBuffer | Buffer, asOf: string, ctx: { sites: Site[] }): ParseResult<ProductionJob> => {
  const table = readTable(buf);
  const rows: ProductionJob[] = [];
  for (const r of table) {
    const sku = String(pick(r, "Code", "SKU", "Product Code") ?? "");
    const qty = num(pick(r, "Qty", "Quantity", "Qty To Make", "Qty Ordered"));
    if (!sku || !qty) continue;
    const branch = (pick(r, "Branch") as string) ?? null;
    const site = ctx.sites.find((s) => s.cin7_branch && branch && norm(branch).startsWith(norm(s.cin7_branch).slice(0, 5)))?.code ?? "RST";
    rows.push({ as_of_date: asOf, job_ref: String(pick(r, "Ref", "Job", "Reference") ?? ""), site_code: site, sku, qty, scheduled_date: dateIso(pick(r, "Scheduled", "Date Scheduled", "Production Date", "Created")), status: (pick(r, "Status", "Cin7 Status") as string) ?? null });
  }
  return { rows, warnings: rows.length ? [] : ["No production job lines found."], headers: Object.keys(table[0] ?? {}) };
};

// ---------- Cin7 FG stock ----------
export const parseFgStock = (buf: ArrayBuffer | Buffer, asOf: string, ctx: { sites: Site[] }): ParseResult<FgStock> => {
  const table = readTable(buf);
  const rows: FgStock[] = [];
  for (const r of table) {
    const sku = String(pick(r, "Code", "SKU", "Product Code") ?? "");
    const qty = num(pick(r, "Stock On Hand", "Available", "Qty", "Stock"));
    if (!sku || qty === null) continue;
    const branch = (pick(r, "Branch") as string) ?? null;
    const site = ctx.sites.find((s) => s.cin7_branch && branch && norm(branch).startsWith(norm(s.cin7_branch).slice(0, 5)))?.code ?? null;
    rows.push({ as_of_date: asOf, sku, branch, site_code: site, qty });
  }
  return { rows, warnings: rows.length ? [] : ["No stock rows found."], headers: Object.keys(table[0] ?? {}) };
};

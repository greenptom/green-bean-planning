export type SiteCode = "RST" | "UM" | "HAC" | "MUN" | "CRL" | "MAS";

export type Site = {
  code: SiteCode;
  name: string;
  country: string;
  role: "roastery" | "pod_coman" | "instant_coman" | "rtd_coman" | "roaster_coman";
  stock_source: "cropster" | "email";
  cropster_location: string | null;
  cin7_branch: string | null;
  green_conversion_factor: number;
  conversion_note: string | null;
  active: boolean;
};

export type Origin = { code: string; name: string; country: string; decaf: boolean; sort_order: number };

export type Location = {
  code: string;
  cropster_name: string | null;
  kind: "physical" | "in_transit" | "contracted";
  site_code: SiteCode;
  fixing_status: FixingStatus | null;
};

export type FixingStatus = "landed" | "fully_fixed" | "c_fixed_diff_open" | "c_open_diff_fixed" | "fully_open";

export type Recipe = {
  site_code: SiteCode;
  sku: string;
  origin_code: string;
  qty: number;
  unit_kind: "g_green_per_unit" | "g_coffee_per_can";
  valid_from: string;
  source: string;
};

export type DemandFg = {
  as_of_date: string;
  site_code: SiteCode;
  sku: string;
  week_start: string;
  units: number;
  kind: "forecast" | "production_planned" | "actual";
  channel?: string | null;
  source?: string;
};

export type DemandGreen = { as_of_date: string; site_code: SiteCode; origin_code: string; week_start: string; kg: number };

export type Lot = {
  as_of_date: string;
  lot_id: string;
  name: string;
  origin_code: string | null;
  blend_designation: string | null;
  location_code: string | null;
  cropster_location: string;
  initial_kg: number | null;
  kg: number;
  price_gbp_kg: number | null;
  fixing_status: FixingStatus;
  price_note: string | null;
  arrival_month: string | null;
  cin7_po: string | null;
  cin7_sku: string | null;
  supplier_contract: string | null;
  supplier: string | null;
  run_out_weeks: number | null;
};

export type PurchaseOrder = {
  as_of_date: string;
  po_number: string;
  branch: string | null;
  site_code: SiteCode | null;
  supplier: string | null;
  supplier_contract: string | null;
  cin7_sku: string | null;
  product_name: string | null;
  origin_code: string | null;
  qty_ordered: number | null;
  qty_received: number | null;
  qty_open: number | null;
  unit_cost: number | null;
  currency: string | null;
  etd: string | null;
  eta: string | null;
  status: string | null;
};

export type ProductionJob = {
  as_of_date: string;
  job_ref: string;
  site_code: SiteCode | null;
  sku: string;
  qty: number;
  scheduled_date: string | null;
  status: string | null;
};

export type FgStock = { as_of_date: string; sku: string; branch: string | null; site_code: SiteCode | null; qty: number };

export type SiteStockReport = {
  as_of_date: string;
  site_code: SiteCode | null;
  location_code: string | null;
  origin_code: string;
  kg_green: number;
  kg_semi_finished: number;
  source: string;
};

export type Inbound = {
  eta_week: string;
  origin_code: string;
  supplier: string;
  contract_ref: string;
  kg: number;
  gbp_per_kg: number | null;
  processing: string;
  po_number: string;
  source: string;
};

export type ScenarioBuy = { origin_code: string; site_code: SiteCode | "ALL"; land_week: string; kg: number; note?: string };

export type Settings = {
  coverage_target: number;
  coverage_tolerance: [number, number];
  container_kg: number;
  horizon_weeks: number;
  roast_loss: number;
  haco_sf_yield: number;
  stale_after_days: number;
};

export type Dataset = {
  mode: "local" | "supabase";
  sites: Site[];
  origins: Origin[];
  locations: Location[];
  blendDesignations: { name: string; origin_code: string; site_code: SiteCode; note: string }[];
  recipes: Recipe[];
  demandFg: DemandFg[];
  lots: Lot[];
  purchaseOrders: PurchaseOrder[];
  productionJobs: ProductionJob[];
  fgStock: FgStock[];
  siteStockReports: SiteStockReport[];
  inbound: Inbound[];
  settings: Settings;
  asOf: Record<string, string | null>;
};

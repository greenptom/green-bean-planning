-- Grind Green Bean Planning — core schema
-- Grain: origin-grade × site × week for planning; lot × location underneath for stock.
-- Every uploaded dataset is versioned by as_of_date so any Monday can be re-created.

create extension if not exists "pgcrypto";

-- ---------- reference ----------
create table sites (
  code text primary key,                 -- RST, UM, HAC, MUN, CRL, MAS
  name text not null,
  country text,
  role text not null,                    -- roastery | pod_coman | instant_coman | rtd_coman | roaster_coman
  stock_source text not null,            -- cropster | email
  cropster_location text,                -- Cropster location name holding Grind-owned green at this site
  cin7_branch text,                      -- Cin7 branch that green POs land on
  green_conversion_factor numeric not null default 1,  -- multiplier applied to recipes in g_coffee_per_can (e.g. instant -> green 3.0)
  conversion_note text,
  active boolean not null default true
);

create table origins (
  code text primary key,                 -- BR, CO, CO_DECAF, GT, ...
  name text not null,
  country text,
  decaf boolean not null default false,
  sort_order int not null default 100
);

-- Cropster "Project" field = blend designation. Maps to an origin-grade for coverage.
create table blend_designations (
  name text primary key,                 -- House Brazil 1, Dark Brazil 2, House Central, Emerald Blend, ...
  origin_code text references origins(code),
  site_code text references sites(code), -- when a designation is site-specific (Ultramar, HACO (Micro Ground))
  note text
);

create table locations (
  code text primary key,                 -- GALLEYWALL, COMMODITY_CENTRE, IN_TRANSIT, UM, HAC, MAS, CONTRACT_FIXED, ...
  cropster_name text unique,             -- exact Cropster location string
  kind text not null,                    -- physical | in_transit | contracted
  site_code text references sites(code),
  fixing_status text                     -- for contracted pseudo-locations: fully_fixed | c_fixed_diff_open | c_open_diff_fixed | fully_open
);

create table skus (
  sku text primary key,
  product text,
  category text,
  sub_category text,
  site_code text references sites(code), -- site that makes it
  active boolean not null default true
);

-- Recipe: how many grams of each origin one unit of a SKU consumes at a site.
-- unit_kind: g_green_per_unit | g_coffee_per_can (multiplied by sites.green_conversion_factor)
create table recipes (
  id uuid primary key default gen_random_uuid(),
  site_code text not null references sites(code),
  sku text not null,
  origin_code text not null references origins(code),
  qty numeric not null,
  unit_kind text not null,
  valid_from date not null default current_date,
  valid_to date,
  source text,
  unique (site_code, sku, origin_code, valid_from)
);

create table settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text,
  note text
);

-- ---------- uploads (provenance for every number) ----------
create table uploads (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                    -- forecast | cropster_lots | cin7_pos | cin7_production | fg_stock | site_report | sheet_seed
  as_of_date date not null,
  file_name text,
  storage_path text,
  row_count int,
  uploaded_by text,
  uploaded_at timestamptz not null default now(),
  notes text
);

-- ---------- demand ----------
create table demand_fg (
  id bigserial primary key,
  upload_id uuid references uploads(id) on delete cascade,
  as_of_date date not null,
  site_code text not null references sites(code),
  sku text not null,
  channel text,
  customer_subgroup text,
  week_start date not null,
  units numeric not null,
  kind text not null default 'forecast', -- forecast | production_planned | actual
  source text
);
create index on demand_fg (as_of_date, site_code, week_start);

-- Derived: green kg per origin per site per week, computed on upload (never on read).
create table demand_green (
  id bigserial primary key,
  as_of_date date not null,
  site_code text not null references sites(code),
  origin_code text not null references origins(code),
  week_start date not null,
  kg numeric not null,
  unique (as_of_date, site_code, origin_code, week_start)
);

-- ---------- supply ----------
-- One row per Cropster lot × location, as exported. Repurposed fields decoded on ingest.
create table lots (
  id bigserial primary key,
  upload_id uuid references uploads(id) on delete cascade,
  as_of_date date not null,
  lot_id text not null,                  -- PG-0581
  name text,
  origin_code text references origins(code),
  country text,
  blend_designation text,                -- Cropster "Project"
  location_code text references locations(code),
  cropster_location text,
  initial_kg numeric,
  kg numeric not null,
  price_gbp_kg numeric,
  fixing_status text,                    -- landed | fully_fixed | c_fixed_diff_open | c_open_diff_fixed | fully_open
  price_note text,                       -- raw Sales # text: 281c/lb, GTC 260c/lb vs May 2027, Diff +85c/lb vs March 2027
  arrival_month date,                    -- from Tracking # when it is a month
  cin7_po text,                          -- Cropster PO #
  cin7_sku text,                         -- Cropster Container #
  supplier_contract text,                -- Cropster Notes
  supplier text,                         -- Cropster Supply network
  run_out_weeks numeric,
  raw jsonb
);
create index on lots (as_of_date, origin_code, location_code);

create table purchase_orders (
  id bigserial primary key,
  upload_id uuid references uploads(id) on delete cascade,
  as_of_date date not null,
  po_number text not null,
  branch text,
  site_code text references sites(code),
  supplier text,
  supplier_contract text,                -- Cin7 "Project Name"
  cin7_sku text,
  product_name text,
  origin_code text references origins(code),
  qty_ordered numeric,
  qty_received numeric,
  qty_open numeric,
  unit_cost numeric,
  currency text,
  etd date,
  eta date,
  status text,
  cropster_lot_id text,
  raw jsonb
);
create index on purchase_orders (as_of_date, site_code);

-- Cin7 production jobs (future roastery / co-man production), uploaded weekly
create table production_jobs (
  id bigserial primary key,
  upload_id uuid references uploads(id) on delete cascade,
  as_of_date date not null,
  job_ref text not null,
  branch text,
  site_code text references sites(code),
  sku text not null,
  qty numeric not null,
  scheduled_date date,
  status text,
  raw jsonb
);

-- Finished goods stock (Cin7 stock export), uploaded weekly
create table fg_stock (
  id bigserial primary key,
  upload_id uuid references uploads(id) on delete cascade,
  as_of_date date not null,
  sku text not null,
  branch text,
  site_code text references sites(code),
  qty numeric not null,
  raw jsonb
);

-- Co-man emailed stock reports (Ultramar, HACO, Masteroast) and Ash's Stock Master history
create table site_stock_reports (
  id bigserial primary key,
  upload_id uuid references uploads(id) on delete cascade,
  as_of_date date not null,
  site_code text references sites(code),
  location_code text references locations(code),
  origin_code text references origins(code),
  kg_green numeric not null default 0,
  kg_semi_finished numeric not null default 0,
  source text
);

-- Dated inbound (Tamas's Inbound tab, haulier confirmations) — until ETA is filled on Cin7 POs
create table inbound (
  id bigserial primary key,
  upload_id uuid references uploads(id) on delete cascade,
  eta_week date not null,
  origin_code text references origins(code),
  supplier text,
  contract_ref text,
  kg numeric not null,
  gbp_per_kg numeric,
  processing text,
  po_number text,
  destination_location text references locations(code),
  source text
);

-- ---------- scenarios (Ash's "Scenario Buy" row, made durable) ----------
create table scenarios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by text,
  created_at timestamptz not null default now(),
  base_as_of_date date not null,
  notes text
);
create table scenario_buys (
  id bigserial primary key,
  scenario_id uuid references scenarios(id) on delete cascade,
  origin_code text references origins(code),
  site_code text references sites(code),
  land_week date not null,
  kg numeric not null,
  containers int generated always as (ceil(kg / 20000.0)) stored,
  note text
);

-- ---------- views ----------
-- Latest as_of per table
create view v_latest_as_of as
select 'demand_green' as tbl, max(as_of_date) as as_of_date from demand_green
union all select 'lots', max(as_of_date) from lots
union all select 'purchase_orders', max(as_of_date) from purchase_orders
union all select 'production_jobs', max(as_of_date) from production_jobs
union all select 'fg_stock', max(as_of_date) from fg_stock
union all select 'site_stock_reports', max(as_of_date) from site_stock_reports;

-- Physical + contracted kg by origin and site, latest Cropster upload
create view v_stock_by_origin_site as
select l.as_of_date, l.origin_code, coalesce(loc.site_code, 'RST') as site_code, loc.kind, l.fixing_status, sum(l.kg) as kg
from lots l join locations loc on loc.code = l.location_code
where l.as_of_date = (select max(as_of_date) from lots)
group by 1,2,3,4,5;

-- 52-week coverage per origin × site (used by the Buy list)
create view v_coverage as
with d as (
  select site_code, origin_code, sum(kg) as demand_52w
  from demand_green
  where as_of_date = (select max(as_of_date) from demand_green)
    and week_start >= date_trunc('week', current_date)
    and week_start < date_trunc('week', current_date) + interval '52 weeks'
  group by 1,2
), s as (
  select site_code, origin_code,
         sum(kg) filter (where kind in ('physical','in_transit')) as on_hand,
         sum(kg) filter (where kind = 'contracted') as contracted
  from v_stock_by_origin_site group by 1,2
)
select d.site_code, d.origin_code, d.demand_52w,
       coalesce(s.on_hand,0) as on_hand, coalesce(s.contracted,0) as contracted,
       (coalesce(s.on_hand,0)+coalesce(s.contracted,0)) / nullif(d.demand_52w,0) as coverage,
       greatest(0, d.demand_52w * (select (value->>0)::numeric from settings where key='coverage_target') - coalesce(s.on_hand,0) - coalesce(s.contracted,0)) as gap_kg
from d left join s on s.site_code = d.site_code and s.origin_code = d.origin_code;

-- Reconciliation: Cropster branch balance vs latest co-man report
create view v_reconciliation as
with c as (
  select site_code, origin_code, sum(kg) as cropster_kg from v_stock_by_origin_site where kind='physical' group by 1,2
), r as (
  select distinct on (site_code, origin_code) site_code, origin_code, as_of_date, kg_green, kg_semi_finished
  from site_stock_reports order by site_code, origin_code, as_of_date desc
)
select coalesce(c.site_code, r.site_code) as site_code, coalesce(c.origin_code, r.origin_code) as origin_code,
       c.cropster_kg, r.kg_green as report_kg, r.kg_semi_finished, r.as_of_date as report_date,
       coalesce(c.cropster_kg,0) - coalesce(r.kg_green,0) as delta_kg
from c full outer join r on r.site_code = c.site_code and r.origin_code = c.origin_code;

-- ---------- RLS: grind.co.uk only ----------
alter table uploads enable row level security;
alter table demand_fg enable row level security;
alter table demand_green enable row level security;
alter table lots enable row level security;
alter table purchase_orders enable row level security;
alter table production_jobs enable row level security;
alter table fg_stock enable row level security;
alter table site_stock_reports enable row level security;
alter table inbound enable row level security;
alter table scenarios enable row level security;
alter table scenario_buys enable row level security;
alter table recipes enable row level security;
alter table settings enable row level security;

create or replace function is_grind() returns boolean language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') like '%@grind.co.uk'
$$;

do $$ declare t text; begin
  for t in select unnest(array['uploads','demand_fg','demand_green','lots','purchase_orders','production_jobs','fg_stock','site_stock_reports','inbound','scenarios','scenario_buys','recipes','settings']) loop
    execute format('create policy %I_grind_all on %I for all to authenticated using (is_grind()) with check (is_grind())', t, t);
  end loop;
end $$;

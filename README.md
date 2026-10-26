# Grind · Green Bean Planning

Weekly demand-to-supply view of green coffee across the roastery (Galleywall) and the co-manufacturers (Ultramar, HACO, Münsterland, Coffein Compagnie, Masteroast). Replaces the monthly rebuild of the "Green Bean Supply Plan" sheet with one repeatable Monday run.

**What it answers**
- Coverage per origin × site against the 70% target, and how many 20 t containers close the gap (the screenshot Howey gets).
- Week-by-week drawdown per origin at each site: opening · forecast use · arrivals · closing · weeks cover — Ash's "Green Bean" tab, with every arrival carrying its Cropster lot or Cin7 PO.
- Scenario buys: add containers landing in a week and watch the drawdown respond.
- The green → finished goods flow per site, with the conversion each recipe needs.

## Run it

```bash
npm install
npm run dev          # seed mode: reads supabase/seed/*.csv, no database needed
```

With Supabase:

1. Create a project, run `supabase/migrations/0001_schema.sql` in the SQL editor, create a private Storage bucket called `uploads`.
2. Copy `.env.example` to `.env.local` and fill in the URL and keys.
3. `npx tsx scripts/seed.ts` — loads sites, origins, locations, blend designations, recipes, settings, Ash's production plan, Stock Master and Inbound.
4. `npm run dev`, then upload the weekly files on **/uploads**.

Deploy on Vercel with the same env vars. Supabase Auth with Google, restricted to `@grind.co.uk`, is enforced by RLS (`is_grind()`).

## Weekly run

| When | Who | File | Where it comes from |
| --- | --- | --- | --- |
| Thu | Ethan | Forecast – All Channels.xlsx | Demand planning tool export |
| Fri | Planner | Cropster green inventory .xls | Cropster → Green inventory → Export |
| Fri | Planner | Cin7 purchase orders (GRN lines) .csv | Cin7 → Purchase Orders → Product Ordered = GRN → Export |
| Fri | Planner | Cin7 production jobs .csv | Cin7 → Production Jobs → Export |
| Fri | Planner | Cin7 FG stock .csv | Cin7 → Products → stock export |
| Monthly | Farasat → Planner | Ultramar / HACO / Masteroast stock reports | Email |
| Mon 09:00 | Planner | — | Review **/coverage**, copy the Monday post to #proj-coffee-buying |

## How the numbers are built

- `demand_fg` (units per SKU per week per site) × `recipes` (grams of each origin per unit) → `demand_green` (kg per origin per site per week). RTD recipes in g coffee per can are multiplied by the site's `green_conversion_factor`.
- Opening stock = Cropster physical lots at the site's locations (Galleywall, Commodity Centre, In Transit, Ultramar, Haco, Masteroast); until a Cropster upload exists, the latest site stock report / Stock Master.
- Arrivals = contracted Cropster lots (the four "Contracted – …" pseudo-locations) placed in the month held in Tracking #, plus Cin7 open GRN PO lines with an ETA/ETD not already carried by a lot, plus Inbound rows, plus scenario buys.
- Coverage = (on hand + contracted earmarked for the site) ÷ 52-week demand. Gap = target × demand − covered. Containers = ceil(gap ÷ 20,000).
- Contracted lots are earmarked to a site by the Cropster **Project** field (House Brazil 1, Ultramar, HACO (Micro Ground)…), then by name hints, else the roastery.

## Cropster field decoding

| Cropster field | What Grind puts in it |
| --- | --- |
| Project | Blend designation (planning key) |
| Ref. ID | Supplier register number (GRD-0000nn) |
| PO # | Cin7 purchase order |
| Container # | Cin7 green SKU (GRN0346) |
| Sales # | Fixed C (281c/lb) or GTC / diff text for open lots |
| Tracking # | "in stock", or arrival month for contracted lots |
| Notes | Supplier contract number (S2606898) |
| Location | Physical site, or one of four contract states |

## Layout

```
supabase/migrations/0001_schema.sql   tables, views, RLS
supabase/seed/                        reference data + Ash's plan, extracted 26 Oct 2026
scripts/seed.ts                       push seed to Supabase
src/lib/engine/                       green.ts (demand → green), plan.ts (drawdown, coverage), weeks.ts
src/lib/parsers/                      forecast, Cropster, Cin7 POs, production jobs, FG stock
src/lib/flow.ts                       green → FG stages per site
src/app/                              overview, sites/[code], coverage, scenario, flow, uploads, reference
```

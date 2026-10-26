/**
 * How green becomes finished goods at each site. This is the business logic the planner reasons with:
 * where Grind-owned green sits, what transforms it, the conversion that applies, and where the FG goes.
 * Sources: Cropster locations (26 Oct 2026), Ash's recipe tabs, HACO Sept 2026 reconciliation, Ultramar blend recap 7 Oct 2026.
 */
import type { SiteCode } from "./types";

export type FlowStage = {
  label: string;
  where: string;
  what: string;
  conversion?: string;
  system?: string;
  owner?: string;
};

export type SiteFlow = {
  site: SiteCode;
  title: string;
  summary: string;
  stages: FlowStage[];
  caveats: string[];
};

export const SITE_FLOWS: SiteFlow[] = [
  {
    site: "RST",
    title: "Roastery — Galleywall",
    summary: "Green lands at Commodity Centre (bonded) or Vollers, shunts to Galleywall, is roasted and packed into bags, wholesale and café coffee.",
    stages: [
      { label: "Contract", where: "Cropster · Contracted – … pseudo-locations", what: "Howey contracts 20 t containers; fixing state (C / diff) tracked as a location; Cin7 PO raised on Grind Roastery branch", system: "Cropster + Cin7", owner: "Howey" },
      { label: "Land", where: "Commodity Centre / Vollers", what: "Container lands at the bonded warehouse; Cropster lot moves from Contracted to Commodity Centre; Cin7 PO received", system: "Cropster + Cin7", owner: "Tamas" },
      { label: "Shunt", where: "In Transit to Galleywall", what: "Pallets shunted to the roastery on demand (Ketra)", system: "Cropster" },
      { label: "Roast", where: "Galleywall", what: "Roast profiles consume lots; Cropster records green used per batch and run-out weeks", conversion: "≈15% roast loss (235.2 g green → 200 g roasted)", system: "Cropster", owner: "Josh" },
      { label: "Pack & ship", where: "Galleywall → GXO (Cygnia)", what: "Bags, 1 kg wholesale, café coffee; Cin7 production job consumes GRN SKU and creates FG", system: "Cin7" },
    ],
    caveats: ["Cropster is accurate for Galleywall and Commodity Centre; Cin7 branch stock lags because POs are received late (27 Oct Jean session)."],
  },
  {
    site: "UM",
    title: "Ultramar — pods (Italy)",
    summary: "Grind buys the green, ships it to Ultramar as a free-issue material, Ultramar roasts, grinds and fills compostable pods, and ships finished boxes back to GXO.",
    stages: [
      { label: "Buy", where: "Cropster · Project = Ultramar", what: "Lots earmarked for Ultramar (names carry (UM) or (Ultramar, Blend)); Cin7 PO on Ultramar branch", system: "Cropster + Cin7", owner: "Howey / Will" },
      { label: "Ship green", where: "UK → Ultramar (Pesaro)", what: "Trucked by Grind; Francesco confirms receipt and asks for the invoice to book it in their ERP", owner: "Tamas" },
      { label: "Hold", where: "Cropster · Ultramar location", what: "Grind-owned green at Ultramar (27,989 kg on 26 Oct 2026). Ultramar also buys its own robusta — not Grind stock", system: "Cropster + Ultramar stock email" },
      { label: "Roast, grind, fill", where: "Ultramar", what: "Blend recipes agreed with Howey (7 Oct 2026 recap); production against the monthly Grind PO (e.g. PO-2762719)", conversion: "61.2 g green per 10-pod box · 611.8 g per 100-pod bulk" },
      { label: "Ship FG", where: "Ultramar → GXO", what: "26-pallet trucks; FG received into Cin7 on Wincanton – Cygnia branch", system: "Cin7", owner: "Tamas" },
    ],
    caveats: ["Ultramar stopped production on 22 Oct 2026 for lack of Arabica Brasil — the drawdown for UM × BR is the early warning.", "Ultramar's own robusta (Uganda €7.76/kg) must be excluded from Grind coverage."],
  },
  {
    site: "HAC",
    title: "HACO — instant (Switzerland)",
    summary: "Green goes to HACO, is roasted and extracted into a 20% micro-ground semi-finished (SF) bulk, then filled into jars and sachets on a later slot.",
    stages: [
      { label: "Buy", where: "Cropster · Project = HACO (Micro Ground)", what: "Brazil Cruzeiro / Capetinga decaf lots; Cin7 PO on Haco branch (e.g. PO-2637719, 20,000 kg GRN0342)", system: "Cropster + Cin7", owner: "Howey / Connor" },
      { label: "Ship green", where: "Falcon → HACO", what: "Falcon invoices on dispatch (INV26-07724/5); HACO books in on receipt — compare the two", owner: "Tamas / Zak" },
      { label: "Extract", where: "HACO", what: "Green roasted and extracted into semi-finished 20% MG", conversion: "38% yield green → SF (30,646 kg green → 11,709 kg SF, Sept 2026)" },
      { label: "Hold SF", where: "HACO", what: "SF stock sits at HACO until a filling slot (Roger Wäfler material orders); report monthly via Lisa", system: "HACO monthly stock report" },
      { label: "Fill", where: "HACO", what: "Jars (CRAFT-INSTANT 245 g green-equivalent per unit incl. MG) and sachets (7.5 g)", conversion: "recipe g green per unit" },
      { label: "Ship FG", where: "HACO → GXO", what: "FG received into Cin7", system: "Cin7" },
    ],
    caveats: ["HACO's Sept 2026 report double-counted ~30 t of green (60,788 vs 30,646 kg) — reconcile every report to Falcon invoices.", "Plan SF in green-equivalent (SF kg ÷ 0.38) so coverage is on one unit."],
  },
  {
    site: "MUN",
    title: "Münsterland — RTD cold brew (Germany)",
    summary: "RTD cans use instant coffee rather than green; the instant is produced from Brazil green upstream.",
    stages: [
      { label: "Instant required", where: "Münsterland", what: "Instant coffee per can from recipe (2.5 g/can for FW and CL)", conversion: "g instant per can" },
      { label: "Green-equivalent", where: "upstream (HACO)", what: "Instant made from Brazil green", conversion: "× 3.0 green per kg instant — Ash's note: 'need conf'" },
      { label: "Fill & ship", where: "Münsterland → GXO / Prism (rework)", what: "Cans; receipted dates tracked on the Munster tab", system: "Cin7" },
    ],
    caveats: ["Conversion factor 3.0 is unconfirmed. Small volume (≈0.6 t green per 5,000-can run)."],
  },
  {
    site: "CRL",
    title: "Coffein Compagnie — RTD concentrate (Bremen)",
    summary: "Cold brew concentrate made from roasted Grind coffee; Cin7 branch 'Coffein, Bremen' holds POs for materials.",
    stages: [
      { label: "Coffee per can", where: "CRL", what: "15.9–31 g coffee per can depending on SKU (Recipes CRL)", conversion: "g coffee per can × 1.18 → green (roasted → green, to confirm)" },
      { label: "Fill & ship", where: "CRL → GXO", what: "Cans received into Cin7", system: "Cin7" },
    ],
    caveats: ["No Cropster location for CRL; coffee is supplied roasted. Treat as roastery demand if Grind roasts it."],
  },
  {
    site: "MAS",
    title: "Masteroast — contract roasting (UK)",
    summary: "Masteroast roasts specific lines (BA lounges, Soho House) from Grind-owned green held at their site.",
    stages: [
      { label: "Buy & hold", where: "Cropster · Masteroast location", what: "e.g. Terra Rica (BA) 8,000 kg + 2,000 kg in Aug 2026 export; 0 kg on 26 Oct 2026", system: "Cropster" },
      { label: "Roast & pack", where: "Masteroast", what: "Converted to FG against Grind orders; Will's note 18 Sep: ~8 t on site, ~10 t convertible" },
      { label: "Ship FG", where: "Masteroast → GXO / customer", what: "FG into Cin7", system: "Cin7" },
    ],
    caveats: ["No Masteroast demand tab in Ash's sheet yet — add production planned when the BA/Soho House schedule is known."],
  },
];

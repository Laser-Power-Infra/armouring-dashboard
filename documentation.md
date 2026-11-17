# Armouring 5 Dashboard — Implementation Spec (v1)

> **Source of truth:** "Armouring 5 (Kharagpur) – Complete Handover", VERSION 16-Nov-26 / Rev 1 (Deepak Goel / Laser Power & Infra Ltd).
> **Owner:** Asmita Mallick · **Spec version:** 17-Nov-26 / Rev 2 (field lists checked against the SFG data pull "Armouring 5 – SFG Dashboard Data (pulled 17-Nov-26 15:34)")
> **Audience:** Claude Code (or any developer) building this project from scratch in a new codebase.

---

## 0. Instructions for Claude Code (read first)

1. **Do not invent data.** Every number on screen must come from a source in §4 through a rule in §7. If a rule or column is marked `TBD` or `VERIFY`, implement it behind a setting or adapter and leave a `// TODO(spec §x)` comment. Do not guess silently.
2. **Map sheet columns by header name, not by position.** The column letters in §4 come from the handover PDF and were not checked against the live sheets. Each loader must read the header row, map headers to fields, and fail loudly with a clear `refresh_log` error if a required header is missing.
3. **All constants go in the `settings` table** (rates, thresholds, lookback days, margins). Nothing is hard-coded in components or SQL. Section §5.4 lists them with defaults.
4. **The SFG dashboard API is not available yet** (see §13 Open items). Build `SfgClient` as an interface with three implementations:
   - (a) a **fixture** implementation that reads JSON files from `/fixtures/sfg/*.json`
   - (b) a **snapshot-sheet** implementation that reads the tabs of the SFG data pull sheet in §4.2 through the Google Drive/Sheets API
   - (c) an **HTTP** implementation stub for Samrat's API

   Generate the fixtures from that sheet. Everything downstream must work with (a) and (b). §4.2 has the exact column headers.
5. **Build in the phase order of §15.** Phase 1 uses only the Google Sheets sources, so it can ship before SFG access exists.
6. **Units:** all cable lengths are shown in **km** (1 decimal place on tiles, 2 in tables). Grid gives metres, so divide by 1000. Never show "TON" for armouring output (a known sheet error).
7. **Timezone:** all business logic runs in **Asia/Kolkata (IST, UTC+5:30)**. Store timestamps as `timestamptz`. Compute shift day in IST (§7.1).
8. Every dashboard block shows a **"Data as of <time>"** label, taken from the `loaded_at` of the sources it uses.

---

## 1. Business context

**Machine:** Armouring No-5 at the Kharagpur (KGP) plant.

| Name | Where it's used |
|---|---|
| `Armouring 5` / `Arm 5` | Everyday name |
| `ARMOURING NO- 5` | Grid (WorkOnGrid) machine name. **Exact spacing: "NO-" then a space then "5"** |
| `AR005` | ERP labour cost code |

- It is the plant's **bottleneck**: about 72–81 km of work is pending, against roughly 7 km/day of output. Bottleneck check order: Laying 5 → Armouring 5 → Extruder 52.
- It is a **must-run-daily** machine: 2 shifts/day with 3 men per shift (Deepak's norm).
- **Output rates in use (they conflict):** the routing sheet says 7.8 km per running day, 6 days a week. Deepak's planning rule is ~10 km/day on smaller sizes and ~7 km/day on bigger sizes. Use a size-wise rate table (§5.4 `armour_rate_by_size`), which is `TBD` until Deepak provides it. Fallback: 7.8 km/day.
- **Purpose of the dashboard:** the morning meeting with Deepak (CMD). It must answer four questions:
  1. Men allocated vs production for a date (Grid + ERP)
  2. Bobbins opened / still to open / extra opened for the running item
  3. Planning pending vs capacity: days of work left
  4. "Feedback" (Deepak's word) = feed lying in front of the machine: inner sheath done, armouring pending

### 1.1 Process chain (stages, in order)

```
CONDUCTOR (stranding) → INSULATION (cores) → LAYING (lay-up) → INNER (inner sheath)
   → ARMOURING (Armouring 5) → FINISH / OUTER SHEATH (Extruder 52)
```

Armour wire/strip is spooled in parallel onto 500 DIN bobbins on GI Opening machines (GI-7, 12, 13, 14, 15). Spooling follows the **lots** in the Spooling Production Log. Bobbins must be filled **before** the cable reaches armouring.

### 1.2 Glossary

| Term | Meaning |
|---|---|
| SFG | Semi-finished goods. The SFG dashboard (laser-sfg.duckdns.org, built by Samrat) gives order lines and stage balances |
| Grid / WorkOnGrid | Shop-floor production entry system, one entry per drum |
| Lot | A spooling batch raised against an order priority (LOT-002, LOT-003…). One armour type per lot |
| FREE LOT | Reserve-stock spooling, not tied to an order |
| Feed / "feedback" | Cable that has finished the previous stage and is waiting at this stage |
| Shift day | Production day that runs 08:00 → 08:00 next day (§7.1) |
| Working day | A shift day with Armouring 5 production > 0 |
| N.D. | Batches never counted as usable stock |
| Dead stock | SFG-defined, made more than 90 days ago, not dispatched. Used before new manufacture |
| P7 | Kharagpur order series |
| HT core lines | Lines whose HOD is Mukesh or Kamalesh |
| Approved by MD | Tick in the Club & Run sheet. Only approved lots are planned |

---

## 2. Tech stack and decisions

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16** (App Router, TypeScript strict) | Use React Server Components for data reads. In Next 16, `middleware.ts` is renamed **`proxy.ts`**, and `params`/`searchParams`/`cookies()` are async. **Check the current Next.js 16 docs before scaffolding.** |
| DB | **Postgres on Neon** | Accessed through Prisma (use `@prisma/adapter-neon` if serverless connections become a problem) |
| ORM / migrations | **Prisma** (`prisma migrate`) | Neon via `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (migrations). Views are defined in SQL migrations (`prisma migrate dev --create-only`, then add the SQL) |
| Validation | **zod** | For every loader input and API body |
| Server state (client) | **TanStack Query** | Only for client-side polling/refetch ("Refresh" button, auto refetch every 5 min). Initial data comes from RSC |
| UI state | **Zustand** (recommended over Redux) | State is small: selected machine, selected date, table sort, collapsed sections. Redux Toolkit would be overkill. Do **not** put server data in Zustand |
| UI | **Tailwind CSS + shadcn/ui** | Tiles, tables, badges |
| Charts | **Recharts** | Stacked bars, simple bars. **No Gantt charts** (§10) |
| Auth | **Auth.js (NextAuth v5)** with Google provider | Restrict to the `laserpowerinfra.com` domain (§11) |
| Google Sheets | `googleapis` with a **read-only service account** | Writes only for alerts (§9), and only to the Urgent WhatsApp Message sheet |
| Scheduling | **n8n** (existing Laser n8n cloud) | n8n calls protected job endpoints on the app (§8). Business logic stays in this codebase, not in n8n nodes |
| Hosting | **Vercel** | Job routes need `export const maxDuration = 300` (check the plan limit) |
| Dates | `date-fns` + `date-fns-tz` | All shift logic in Asia/Kolkata |
| Tests | Vitest (logic) + Playwright (smoke) | Business rules in §7 must have unit tests with the examples given |

**Why loaders live in the app, not in n8n:** formulas and mappings stay versioned and tested in one repo. n8n only does three things: (1) trigger jobs on schedule, (2) watch for sheet changes, (3) optionally deliver messages.

---

## 3. Architecture

```
                ┌──────────────────────── n8n (schedules) ───────────────────────┐
                │ 07:30 / 11:47 / 16:47 full · every 2h grid+bobbins · alerts      │
                └───────────────┬────────────────────────────────────────────────┘
                                │ POST /api/jobs/* (Bearer JOB_SECRET)
                                ▼
┌──────────────┐   Sheets API   ┌──────────────────────────────┐   SQL    ┌──────────────┐
│ Google Sheets│ ─────────────▶ │  Next.js 16 on Vercel         │ ───────▶ │ Neon Postgres │
│ (11 sources) │                │  • loaders (lib/loaders/*)    │          │ raw tables    │
└──────────────┘                │  • calc layer (lib/calc/*,    │ ◀─────── │ + SQL views   │
┌──────────────┐  SfgClient     │    SQL views)                 │          │ + settings    │
│ SFG dashboard│ ─────────────▶ │  • alerts evaluator           │          │ + refresh_log │
│ (Samrat API) │  (TBD, mock)   │  • dashboard pages (RSC)      │          └──────────────┘
└──────────────┘                └──────────────┬───────────────┘
                                               │ append rows
                                               ▼
                                 Urgent WhatsApp Message sheet (existing alert channel)
```

Data flow per refresh:

1. A loader fetches the source.
2. It validates the data with zod.
3. It writes to a raw table in a single transaction, using the snapshot replace or upsert strategy from §6.
4. It writes a `refresh_log` row.
5. It calls `revalidateTag('<source>')` so the dashboard pages show fresh data.

---

## 4. Data sources

There are 16 logical sources. **L** = Google Sheet (live). **S** = SFG dashboard (via Samrat's saved queries / API, currently `TBD`).

### 4.1 Google Sheets (Phase 1 — available now with a service account)

> Share every sheet below with the service account email as **Viewer**. Exception: the Urgent WhatsApp Message sheet needs **Editor**.
> Column letters are from the PDF and need checking (`VERIFY`) against the real headers.

| Source id | Spreadsheet → tab!range | Key columns (per PDF) | Raw table |
|---|---|---|---|
| `lots` | **Spooling Production Log** (`1Kog4-rI6ACEiLiw9lzMOhVfg5s1SGmUz516LjYLSkp0`) → `Production Planning!A1:X300` | Plan rows A–K: plan date, location, cable item, no. of wires/strips, wire/strip size, cable length (m), priority, lot nos, spool stock available, remarks, mark complete. **Lot block M:X**: lot no, plan date, location, cable item, size, spool length, spools required, spools produced, balance, status, manual complete, priority | `spool_plan`, `spool_lots` |
| `bobbinlog` | same → `Bobbin Log` | A date, B shift, C spooling machine, D operator, E bobbin off time, F bobbin no., G lot no. (incl. FREE LOT / Not applicable), H item (auto), I rotations, J length m (auto), K remarks, L item if no lot, M weight kg (auto), N shift code (auto) | `bobbin_log` |
| `bobstatus` | same → `Bobbin Status!A1:E1000` | A Sl, B bobbin status, C item, D no. of bobbins, E date | `bobbin_status` |
| `owned` | same → `Bobbin Status!G1:L20` | G:J date / total counted / owned / difference; K:L owned-from date / bobbins owned | `bobbin_owned`, `bobbin_count_check` |
| `itemmaster` | same → `Item Master` | Per armour item: shape, dia/width, thickness, density, kg/m, max spool length, spool wt, length required, turns, bobbin net wt; L:N barrel, traverse, packing factor, lay factor, weight correction, kg per cable km; per-day bobbin opening capacity | `armour_items` |
| `inner` / `innermeta` | same → `Unconsumed Inner!A1:I200`; `A1:A2` = "Last updated" | From row 4: prod order, prod date, party, armoured item, equipment, HOD, current stage, inner item, unconsumed km | `inner_feed` |
| `sfgstock` | **UNCONSUMED SFG STOCK** (SFG Progress Report KGP) → `DETAILS!A1:Q500` | One row per order × stage: prod order, stage, previous stage, item, previous item, stage done, balance, previous done, ratio, unconsumed km, equipment | `sfg_unconsumed` |
| `machines` | **KGP Machine Routing** (`1OxvdZo9Uv-tVn5_S_6MLxF_Wzq5FBd_H6G27TGvpsrQ`) → `Machines!A1:F100` | machine, stage, speed km/running day, unit, days/week, source | `machine_routing` |
| `itemroute` | same → `Item Routing!A1:F300` | item code → machine, alternative machine | `item_routing` |
| `orderroute` | same → `Order Routing!A1:F300` | per order: laying / inner / armouring / outer machine | `order_routing` |
| `clubappr` | same → `Club Approval!A1:F300` | club-run approval rows (v2) | `club_approval` |
| `rundaily` | **KHG Machines to Run Daily** (`1EiRA3GUfM0aI7Mp1IpPDqnK41L3PBWN-nvje7AK3dWg`) → `Machines!A7:S100` | machine, ERP code, type, must-run tick, shifts, men per shift, ERP history, capacity, usual/good output, days run, crew type | `machine_master` |
| `prodlots` | **KGP Production Lots – Club & Run Together** (`1fOY-x0tEh20S8jC2cHg2LkaF8N1bGAcHYGaKJNlF_30`) → `Orders`, `Run Sheet` | Orders A:V = balances per stage (incl. column O = Armouring balance); Run Sheet = lots ticked "Approved by MD" | `club_orders`, `run_sheet` |
| `otherarm` | **Armoring 1 / 4 / 6 / Multi-Strand 6** sheets → `Production Planning` (same layout as Spooling Production Log) | Used only to know if an order is planned on *any* armouring machine | `spool_plan` (with `machine` column) |
| `alerts_out` | **Urgent WhatsApp Message** (`1uVEt7aE5gDffTrxWTvpS2ajA4290rbGCjZ-M_3htZ5w`) | Write target for alerts. Columns `TBD`; read the header row and append matching columns | — (write only) |

Full spreadsheet links are in §17.

### 4.2 SFG dashboard (Phase 2 — needs Samrat's API; field lists VERIFIED from the 17-Nov pull)

**Rule from Samrat:** access only through the SFG dashboard pages / Query Panel saved queries, exposed as read-only JSON endpoints. **Never connect to Oracle directly.**

**Reference pull (use for fixtures and as the first parallel-check baseline):** spreadsheet **"Armouring 5 – SFG Dashboard Data (pulled 17-Nov-26 15:34)"**, ID `1V5YkE3ukRRib_1hlUU3xDTZuskJaYCXMPPcbqIeKPPI`, owner deepak@laserpowerinfra.com. Pulled from laser-sfg.duckdns.org with Deepak's sign-in. Latest Grid entry in the pull: 2026-11-17 15:18:40. It is one snapshot and **does not refresh**. Its tabs and **exact headers** are below.

#### 4.2.1 `orders` — tab "Order lines" (669 rows, 119 orders)

**SFG origin:** page global `LINES_ALL`. Done qty comes from `getLineProdDone(line)`; stage comes from `sfgLevelSchedule_()`.

**Scope:** one row per production order × SFG stage. It covers every Kharagpur (P7) order, plus every Sioplas HT core order Kharagpur makes for Poly Park (P1), that still has work pending at **any** stage.

| Header | Field | Notes |
|---|---|---|
| Production order | `prod_order` | `P726Y-00260` (P7 = Kharagpur); `P126Y-…` (P1 = Poly Park HT core) |
| MC no | `mc_no` | `L126Y-…`, `SP26Y-…`, `L626Y-…` |
| Order date | `order_date` | ISO date |
| Party | `party` | Truncated to about 28 characters by SFG (e.g. "ADANI ELECTRICITY MUMBAI LIM") |
| FG item | `fg_item` | |
| FG type | `fg_type` | Seen: HT POWER CABLE - ARD, HT POWER CABLE -UNARD, SMALL POWER CABLE - ARD, BIG POWER CABLE - ARD, RAILWAY-POWER CABLE -ARD, COVERED CONDUCTOR, 7 STRAND, 61 STRAND. "Power cable" = FG type contains `POWER CABLE` |
| Approved | `approved` | Yes / No |
| Stage | `stage` | Seen: CONDUCTOR, INSULATION, TAPING, LAYING, INNER, ARMOURING, FINISH, plus RUBBERIZED COTTON TAPE, CONDUCTING TAPE, REWINDING, CORE WIRE. **TAPING sits between INSULATION and LAYING for HT cables** |
| SFG code | `sfg_code` | MC… conductor, MS07… insulated core, MS06… taped core, MS05… laid, MP02… inner, MA02… armoured |
| SFG item | `sfg_item` | |
| Net order qty | `net_qty` | **Units differ by stage** (see below) |
| Done qty | `done_qty` | |
| Balance | `balance` | |
| FG item code | `fg_item_code` | `FA…`; joins to the stock and dead-stock tabs |
| Scope | `scope` | `Kharagpur` or `Core for Poly Park (P1)` |

**Units rule:** CONDUCTOR and INSULATION quantities are in **core km**. TAPING onward (LAYING, INNER, ARMOURING, FINISH) are in **cable km**.

**cores_per_cable** = net qty at CONDUCTOR or INSULATION ÷ net qty at LAYING or ARMOURING for the same order. In the data, 2-core = 2, 3.5-core = 4, 4-core = 4. Use this as the **BOM ratio**, so no separate BOM source is needed. Store it in `order_cores`, computed at load time. If neither stage line exists, parse it from the FG item text ("3.5 CORE" → 4, "N CORE" → N).

#### 4.2.2 Derived tab "Armouring pending" (25 rows)

This tab is derived from Order lines. Rebuild it as SQL view `v_armouring_pending`; do **not** load it. Its rows are KGP (P7) orders with armouring pending > 0.

Headers: Production order · MC no · Party · Cable · Approved · Armouring net km · Armouring done km · Armouring pending km · Conductor bal (core km) · Insulation bal (core km) · Laying bal km · Inner bal km · Finish bal km.

A stage with no line gives a blank balance (e.g. P726Y-00180 has no LAYING/INNER line). Show it as "—" and treat it as unknown, not as 0.

#### 4.2.3 `grid` — tab "Arm5 Grid entries" (71 rows, last 30 shift days)

**SFG origin:** Grid Production Entry page, `showGridProdPage(); await loadGridProd_(true)` → `GP_ROWS`, filtered `production_machine_name = "ARMOURING NO- 5"`. Request the same for every KGP machine (needed for the stage output, §7.7).

| Header | Field | Notes |
|---|---|---|
| Shift day | `shift_day` | Computed by the pull. **Recompute it ourselves** (§7.1) and flag differences |
| Shift | `shift` | Day / Night |
| Start time | `start_time` | `yyyy-mm-dd HH:MM:SS` IST |
| Production order (as entered) | `production_order_raw` | **Can hold two orders**, e.g. `P726Y-00267,P726Y-00268` (11 of 71 rows), **or the wrong order** (§7.13) |
| Item | `item` | Armoured SFG item text |
| Take-up drum no | `take_up_drum_no` | |
| Take-up drum size | `take_up_drum_size` | e.g. `PROCESS DRUM 2500 X1200 X 1440` |
| km | `qty_km` | **Already in km** in the pull. Check the API unit (`qty_m`?) and normalise to km |
| Entered by | `entered_by` | Format `NAME@EMPCODE` (e.g. `ANUPAM DAS@50857`). Split into `entered_by_name` and `entered_by_emp_code` |
| Remarks | `remarks` | e.g. "Grid app problem" |

The raw `GP_ROWS` also carries `job_type` and `production_machine_name`. Keep both: the stage output groups by `job_type` + machine.

#### 4.2.4 Derived tabs "Arm5 daily output" (21 rows) and "KGP stage output" (10 rows)

Rebuild both as views (§7.2, §7.7). Do not load them.

- **Arm5 daily output** headers: Shift day · Day km · Night km · Total km · Men AR005 – shift A (ERP) · Men AR005 – shift B (ERP).
- **KGP stage output** headers: Shift day · Insulation core km · Insulation cable km · Laying km · Inner sheath km · Armouring 5 km · Sioplas 3 HT core km · Sioplas 4 HT core km · Sioplas HT total · Covered conductor km.

  Insulation cable km = core km ÷ cores_per_cable. Power cable = P7 orders whose FG type contains `POWER CABLE`.
- **Conductor speed** (README): Kharagpur Grid stranding over the last 10 shift days, turned into cable km, was **37.33 km** for 2026-11-08 → 2026-11-17. Stranding output is core km, so divide by cores_per_cable of the order.

#### 4.2.5 `labour` — tab "ERP labour AR005" (3 rows)

**SFG origin:** Query Panel saved query `EMP_ALLOCATION` via `_attRunQuery_("EMP_ALLOCATION")`.

**men** = count of distinct `EMP_CODE` with `ATTEND_VAL > 0`, per date and shift, for cost code AR005.

Headers: Date · Men shift A · Men shift B · Total.

The query returned only 15, 16 and 17 Nov in this pull. **Load the raw rows** (`date, emp_code, name, cost_code, shift, attend_val, in_time, out_time`) and aggregate in SQL.

#### 4.2.6 `stock` — tab "ERP stock" (110 rows)

**SFG origin:** stock report `loadStockReport_(true)` → `STOCK_ROWS`.

Headers: Item code · Item (from order lines) · Stock qty (N.D. excluded) · Of which older than 90 days.

Scope: SFG and FG item codes of the pending orders. N.D. batches are already excluded. Store the raw rows with batch / N.D. flag / mfg date if the API gives them; otherwise store the two quantities as given.

#### 4.2.7 `deadstock` — tab "Dead stock" (19 rows)

**SFG origin:** Dead Stock page `loadDeadStockData(true)` → `DEAD_STOCK_ROWS`.

Headers: Item code · Item (from order lines) · Dead stock qty (N.D. excluded).

#### 4.2.8 Rules confirmed by the pull README

- **Shift day:** before 08:00 → previous date, night shift. Night = before 08:00 or from 20:00; otherwise Day.
- **Done qty:** `getLineProdDone(line)` as shown on the dashboard. The dashboard cards also use: if net > 0 and `SFG_REQUIRED_AG_BAL TO PRD FG` ≤ 0, then done = net. **Ask Samrat which one the API should return; implement both behind setting `done_qty_rule`.**
- **Kharagpur orders:** the P7 series. P1 orders appear only for the HT core Kharagpur makes for Poly Park (`scope = 'Core for Poly Park (P1)'`). **Exclude P1 rows from Armouring 5 pending; include them in the stage/HT views.**
- **HT core lines:** HOD Mukesh / Kamalesh per the PDF. The pull does not include a HOD column: **ask Samrat to add `HOD` to the order-lines query.**

**Interim fallback (until the API exists):** the `UNCONSUMED SFG STOCK` sheet still covers sections 1–5. The snapshot-sheet SfgClient (§0.4) lets every SFG block be built and demoed now. Mark such blocks with "Snapshot data – pulled <time>".

### 4.3 Not used (for awareness only)

These are reference only: the Kharagpur Armoring Machine Project Tracker, the Cable Armouring Machine #1 Upgrade Tracker, the Armouring & Spooling Roster, and the Labour Allocated vs Machine Production sheet.

Same-day attendance comes from the biometric punch data (EMP DAILY ATTENDANCE PUNCH) and is out of scope for v1 (§13).

---

## 5. Database schema (Neon Postgres)

Implement this with Prisma. The names are the contract between the loaders, the views and the UI.

### 5.1 Conventions

- Every raw table has `loaded_at timestamptz not null default now()` and `source_id text not null`.
- **Snapshot sources** (sheets, stock, dead stock, orders) are fully replaced inside one transaction per refresh: `DELETE` and then `INSERT`. **Incremental sources** (grid, labour, bobbin log) are upserted on their natural key.
- `machine` columns always hold a **canonical machine code**. Map aliases through `machine_alias` (for example `ARMOURING NO- 5`, `Armouring 5`, `Arm 5`, `AR005` → `ARM5`).

### 5.2 Raw tables

```sql
-- machines & config
create table machine_alias (alias text primary key, machine_code text not null);
create table machine_master (            -- KHG Machines to Run Daily
  machine_code text primary key, name text, erp_cost_code text, type text,
  must_run boolean, shifts_per_day int, men_per_shift int, capacity_km_day numeric,
  usual_output_km numeric, good_output_km numeric, days_run int, crew_type text,
  loaded_at timestamptz not null default now());
create table machine_routing (           -- KGP Machine Routing > Machines
  machine_code text primary key, stage text, speed_km_per_running_day numeric,
  unit text, days_per_week int, source text, loaded_at timestamptz not null default now());
create table item_routing (item_code text primary key, machine_code text, alt_machine_code text,
  loaded_at timestamptz not null default now());
create table order_routing (prod_order text primary key, laying_machine text, inner_machine text,
  armouring_machine text, outer_machine text, loaded_at timestamptz not null default now());

-- SFG (Phase 2)
create table order_lines (              -- headers per §4.2.1
  prod_order text, stage text, sfg_code text, mc_no text, order_date date, party text,
  fg_item text, fg_type text, fg_item_code text, approved boolean, sfg_item text,
  net_qty numeric, done_qty numeric, balance numeric,
  qty_unit text check (qty_unit in ('CORE_KM','CABLE_KM')),   -- CONDUCTOR/INSULATION = CORE_KM
  scope text,                               -- 'Kharagpur' | 'Core for Poly Park (P1)'
  series text,                              -- 'P7' | 'P1' (from prod_order)
  hod text,                                 -- TBD: ask Samrat to add
  loaded_at timestamptz not null default now(), primary key (prod_order, stage, sfg_code));
create table order_cores (prod_order text primary key, cores_per_cable numeric, source text);
create table grid_entries (              -- headers per §4.2.3
  id text primary key, machine_code text not null, machine_raw text, job_type text,
  production_order_raw text,                -- may be 'P726Y-00267,P726Y-00268'
  production_orders text[] not null default '{}', multi_order boolean default false,
  item text, take_up_drum_no text, take_up_drum_size text, qty_m numeric not null,
  start_time timestamptz not null, entered_by text, entered_by_emp_code text, remarks text,
  source_shift_day date,                    -- as given by SFG (for mismatch check)
  shift_day date not null, shift text not null check (shift in ('DAY','NIGHT')),  -- computed §7.1
  loaded_at timestamptz not null default now());
create index on grid_entries (machine_code, shift_day);
create table grid_allocations (grid_id text references grid_entries(id), prod_order text,
  qty_m numeric, rule text, primary key (grid_id, prod_order));   -- §7.13
create table labour_alloc (
  date date, emp_code text, name text, cost_code text, shift text, attend_val numeric,
  in_time timestamptz, out_time timestamptz, loaded_at timestamptz not null default now(),
  primary key (date, emp_code, cost_code, shift));
create table erp_stock (item_code text, item text, qty_excl_nd numeric, qty_over_90d numeric,
  godown text, batch text, nd_flag boolean, mfg_date date,      -- optional, if the API gives raw rows
  loaded_at timestamptz not null default now());
create table dead_stock (item_code text, item text, qty_excl_nd numeric,
  loaded_at timestamptz not null default now());
-- No bom_ratio table: cores_per_cable is derived from order_lines (§4.2.1).

-- Unconsumed SFG stock (sheet now, SFG later)
create table sfg_unconsumed (
  prod_order text, stage text, prev_stage text, item text, prev_item text,
  stage_done_km numeric, balance_km numeric, prev_done_km numeric, ratio numeric,
  unconsumed_km numeric, equipment text, party text,
  loaded_at timestamptz not null default now());
create table inner_feed (               -- Unconsumed Inner tab
  prod_order text, prod_date date, party text, armoured_item text, equipment text,
  hod text, current_stage text, inner_item text, unconsumed_km numeric,
  sheet_last_updated timestamptz, loaded_at timestamptz not null default now());

-- Spooling & bobbins
create table spool_plan (               -- Production Planning rows (Arm5 + other armouring sheets)
  machine_code text, row_no int, plan_date date, location text, cable_item text,
  no_of_wires int, wire_size text, cable_length_m numeric, priority int, lot_nos text,
  spool_stock_available text, remarks text, mark_complete boolean,
  loaded_at timestamptz not null default now(), primary key (machine_code, row_no));
create table spool_lots (               -- lot block M:X
  machine_code text, lot_no text, plan_date date, location text, cable_item text,
  armour_size text, spool_length_m numeric, spools_required int, spools_produced int,
  balance int, status text, manual_complete boolean, priority int,
  loaded_at timestamptz not null default now(), primary key (machine_code, lot_no));
create table bobbin_log (
  date date, shift text, spooling_machine text, operator text, bobbin_off_time time,
  bobbin_no text, lot_no text, item text, rotations int, length_m numeric, remarks text,
  item_if_no_lot text, weight_kg numeric, shift_code text,
  loaded_at timestamptz not null default now(), primary key (date, shift, bobbin_no, bobbin_off_time));
create table bobbin_status (            -- daily count by state
  sl int, status text, item text, count int, date date,
  loaded_at timestamptz not null default now());
create table bobbin_count_check (date date primary key, total_counted int, owned int, difference int);
create table bobbin_owned (from_date date primary key, bobbins_owned int);
create table armour_items (             -- Item Master
  item text primary key, shape text, dia_or_width_mm numeric, thickness_mm numeric,
  density numeric, kg_per_m numeric, max_spool_length_m numeric, spool_wt_kg numeric,
  length_required_m numeric, turns int, bobbin_net_wt_kg numeric,
  barrel_mm numeric, traverse_mm numeric, packing_factor numeric, lay_factor numeric,
  weight_correction numeric, kg_per_cable_km numeric, opening_capacity_per_day numeric,
  loaded_at timestamptz not null default now());

-- Club & run (v2)
create table club_orders (prod_order text primary key, party text, data jsonb,
  armouring_balance_km numeric, loaded_at timestamptz not null default now());
create table run_sheet (lot_no text, prod_order text, approved_by_md boolean, supply_from text,
  loaded_at timestamptz not null default now());
create table club_approval (row_no int primary key, data jsonb, loaded_at timestamptz not null default now());
```

### 5.3 Operational tables

```sql
create table refresh_log (
  id bigserial primary key, job text not null, source_id text not null,
  started_at timestamptz not null, finished_at timestamptz,
  rows int, status text check (status in ('running','ok','error','skipped')),
  error text, triggered_by text);           -- 'n8n' | 'manual:<email>'
create table settings (key text primary key, value jsonb not null, description text,
  updated_by text, updated_at timestamptz default now());
create table alert_events (
  id bigserial primary key, rule text, machine_code text, severity text,
  message text, payload jsonb, first_seen timestamptz default now(),
  last_seen timestamptz default now(), sent_at timestamptz, resolved_at timestamptz,
  escalation_level int default 0);
create unique index on alert_events (rule, machine_code) where resolved_at is null;
```

### 5.4 Settings (seed values)

| key | default | meaning / source |
|---|---|---|
| `avg_lookback_days` | `14` | Window for "average km per working day" (§7.3). PDF: last two weeks |
| `entries_window_shift_days` | `7` | Latest entries table |
| `stage_chart_days` | `10` | Production-by-stage chart |
| `armour_rate_fallback_km_day` | `7.8` | Routing sheet. Used when the size-wise table has no match |
| `armour_rate_by_size` | `[]` | **TBD from Deepak.** `[{ "size_pattern": "...", "km_per_day": 10 }]` (~10 for small, ~7 for big) |
| `day_shift_start` | `"08:00"` | §7.1 |
| `night_shift_start` | `"20:00"` | §7.1 |
| `pace_margin_pct` | `30` | §7.10 |
| `bobbin_amber_early_days` | `10` | §7.8 |
| `feed_cover_alert_days` | **TBD** (suggest `2`) | Alert threshold (§9) |
| `bobbin_short_alert` | **TBD** (suggest `1`) | Alert when bobbins short for next lot ≥ this |
| `erp_grid_mismatch_km` | `0.5` | §9 |
| `no_grid_entry_hours` | `6` | §9 |
| `stale_data_hours` | `18` | §9 |
| `escalation_matrix` | **TBD from Deepak** | `[{ "level": 0, "name": "...", "phone": "..." }, ...]` |
| `excluded_labour_cost_centres` | `["GMD"]` | §10: exclude GMD labour |
| `kgp_order_series` | `["P7"]` | KGP orders |
| `ht_hods` | `["Mukesh","Kamalesh"]` | HT core lines |
| `nd_stock_max_age_days` | `90` | Dead-stock age |

Build an `/admin/settings` page (admin role only) to edit these values. Log every change with `updated_by`.

---

## 6. Loaders (ingestion)

Location: `lib/loaders/<sourceId>.ts`. Each loader exports:

```ts
export const loader: Loader = {
  id: 'bobstatus',
  kind: 'sheet' | 'sfg',
  strategy: 'snapshot' | 'upsert',
  tags: ['bobbins'],                // revalidateTag targets
  async fetch(ctx): Promise<unknown[]>,
  schema: z.object({...}),          // row schema after header mapping
  async write(tx, rows): Promise<number>,
};
```

A generic runner `runLoader(id, triggeredBy)` does the following:

1. Opens a `refresh_log` row with status `running`.
2. Fetches the data.
3. Maps headers to fields: case-insensitive, trimmed, using an alias list per field.
4. Validates with zod. Rows that fail validation are collected; if more than 10% fail, the loader errors.
5. Writes in a transaction.
6. Closes the log row with `ok`, the row count and `finished_at`.
7. Calls `revalidateTag` for the loader's tags.

Errors never wipe existing data. Snapshot replace happens only after validation succeeds.

**Sheet parsing rules:**

- Treat empty strings as null.
- Parse dates in `dd-mm-yyyy`, `dd/mm/yyyy` and Sheets serial number formats.
- Strip commas from numbers.
- Treat a ticked checkbox as `TRUE`.
- Skip blank rows. Skip rows where the key field is empty.

**Per-loader notes:**

- **`lots`:** read A:X in one request. Rows with data in A:K go to `spool_plan`. Rows with a lot no in M go to `spool_lots`. A lot is **open** when `status` is not "Complete", `manual_complete` is false, **and** its parent plan row is not marked complete.
- **`bobstatus`:** the tab holds daily counts. Keep all dates; the dashboard uses `max(date)`.
- **`inner`:** read `A1:A2` for "Last updated" and store it as `sheet_last_updated`. Data rows start at row 4.
- **`grid`:** compute `shift_day` and `shift` at load time (§7.1). Map `machine_raw` to `machine_code` through `machine_alias`. Unknown machines are stored with `machine_code = 'UNMAPPED'` and logged as a warning.
- **`labour`:** drop rows whose cost centre is in `excluded_labour_cost_centres`.
- **`otherarm`:** same parser as `lots`, with `machine_code` set to ARM1 / ARM4 / ARM6 / MS6.

---

## 7. Business rules and calculations

Put the core logic in **SQL views** (`db/views/*.sql`, created in migrations) or in pure TS functions in `lib/calc/*`. Unit-test each rule with Vitest. Read constants from `settings`.

### 7.1 Shift day and shift

```
t = start_time in IST
if  08:00 <= t.time < 20:00  → shift = DAY,   shift_day = t.date
if  t.time >= 20:00          → shift = NIGHT, shift_day = t.date
if  t.time < 08:00           → shift = NIGHT, shift_day = t.date - 1 day
```

Test cases:

- 16-Nov 07:59 → NIGHT, 15-Nov
- 16-Nov 08:00 → DAY, 16-Nov
- 16-Nov 20:00 → NIGHT, 16-Nov
- 16-Nov 23:30 → NIGHT, 16-Nov

**Seen in the 17-Nov pull: 3 Grid entries started between 23:00 and 23:59 were given the *next* date as shift day by SFG.** Examples: start 2026-11-15 23:05:14 → shift day 16-Nov; also 03-Nov 23:25 and 05-Nov 23:47. This contradicts the stated rule, while another entry at 15-Nov 23:01:51 followed it. Likely cause: SFG uses a different timestamp (entry/end time). Rules for the app:

- Always compute shift day from `start_time` with the rule above.
- Store SFG's value in `source_shift_day`.
- List mismatches on `/admin/mapping`.
- **Ask Samrat which timestamp the Grid shift day uses.**

ERP shift A = day and B = night, per the pull README. **However, in the pull every man was booked on shift A** (15–16 Nov: A = 6, B = 0). So day/night men from ERP are unreliable. Show "Men (ERP) A / B / Total" with the labels as given, and use **Total** for km-per-man. Mapping lives in setting `erp_shift_map` (default `{ "A": "DAY", "B": "NIGHT" }`).

### 7.2 Daily output per machine (view `v_daily_output`)

```sql
select machine_code, shift_day,
  sum(qty_m) filter (where shift='DAY')/1000.0   as day_km,
  sum(qty_m) filter (where shift='NIGHT')/1000.0 as night_km,
  sum(qty_m)/1000.0                               as total_km,
  count(*) as entries
from grid_entries group by 1,2;
```

**"Slip" km** appears as a third bar segment in the PDF, but **no slip field exists in the 17-Nov pull** (only Day / Night). Its meaning is **TBD**: ask Deepak whether it is a Grid `job_type` or a correction entry. Implement it as a `job_type`-based filter from setting `slip_job_types` (default `[]`). Slip km is excluded from day/night km when set.

### 7.3 Average km per working day

```
working_days = shift_days in last N days (N = avg_lookback_days, ending yesterday or latest shift_day)
               where total_km > 0 for the machine
avg_km_per_working_day = sum(total_km over working_days) / count(working_days)
```

If `count = 0`, fall back to the rate from `armour_rate_by_size`, or else `armour_rate_fallback_km_day`. When a fallback is used, show the "rate (planned)" badge.

### 7.4 Men allocated and km per man (view `v_labour_daily`)

```
men(date, shift) = count(distinct emp_code) from labour_alloc where cost_code = machine.erp_cost_code
latest_labour_day = max(date) in labour_alloc for that cost code
km_per_man(date) = total_km(date) / men(date, all shifts)    -- null if men = 0
```

ERP posts 1–2 days late. Always show the actual `latest_labour_day`. Do not assume it is yesterday.

### 7.5 Feed cover — inner done, armouring pending (Section 1)

```
feed_rows = inner_feed rows (Unconsumed Inner)   -- VERIFY filter: equipment/armouring machine = ARM5?
feed_km   = sum(unconsumed_km)
feed_cover_days = feed_km / avg_km_per_working_day      (§7.3)
```

Shows a table by order with party, prod order, armoured item, HOD and unconsumed km, sorted by km descending.

Example from the PDF on 16-Nov 18:44: 5.00 km, 1 order (Adani 3.5C×300).

**SFG-based alternative (preferred once `orders` is loaded):** compute feed per order from order lines (cable km):

```
inner_done_km   = armouring_net_km − inner_bal_km
feed_km (order) = max(armouring_pending_km − inner_bal_km, 0)      -- inner done, not yet armoured
```

17-Nov pull: only P726Y-00265 (Adani, 4C×25) had feed, 10.0 km.

This **differs** from the Unconsumed Inner tab, which showed 5.00 km on 16-Nov for Adani 3.5C×300. Show both values during the parallel run, and let Deepak choose the source for v1. Setting `feed_source` takes `inner_sheet` or `order_lines`; default `inner_sheet` (it matches today's dashboard).

### 7.6 Upstream waiting (Sections 2–5), from `sfg_unconsumed`

| Section | Filter (stage / prev_stage) | Waiting km | Days |
|---|---|---|---|
| 2 Laid-up waiting for inner | `INNER` / `LAYING` | `laid_km − inner_done_km` = `prev_done_km − stage_done_km` (floor 0) | waiting_km / avg Arm5 km per working day ("days of armouring once inner done") |
| 3 Insulated core waiting for laying | `LAYING` / `INSULATION` | `layable_km − laying_done_km`, where `layable_km = min over cores c of (insulation_done_c / cores_per_cable)` | waiting_km / avg Arm5 km/day |
| 4 Conductor waiting for insulation | `INSULATION` / `CONDUCTOR` | `prev_done_km − stage_done_km`. **A conductor feeding two insulated items is counted once** (dedupe on prod_order + prev_item). Split into **4a** extruders (Ext 22 / Ext 35: HT + covered) and **4b** Sioplas 4 | km and days at the respective machine speed (machine_routing) |
| 5 Armoured, waiting for outer sheath | `FINISH` / `ARMOURING` | `prev_done_km − stage_done_km` | waiting_km / (outer_machine.speed_km_per_running_day × days_per_week / 7) |

`ratio` in `sfg_unconsumed` is the BOM ratio when present. Otherwise use `order_cores.cores_per_cable` (§4.2.1).

**Same sections from order lines (cable km, per order, P7 only):**

- Laid, waiting for inner = `inner_bal − laying_bal`
- Insulated, waiting for laying = `laying_bal − insulation_bal / cores` (use TAPING balance in place of insulation where a TAPING line exists)
- Conductor waiting for insulation (core km) = `insulation_bal − conductor_bal`
- Armoured, waiting for outer sheath = `finish_bal − armouring_pending`

All values have a floor of 0. A missing stage line means unknown, not 0. Stage names must match SFG exactly. Keep a `stage_alias` map in code.

### 7.7 Production by stage, last 10 days

```
for each shift_day in last stage_chart_days:
  insulation_core_km, laying_km, inner_km, ht_core_sioplas_km (Sioplas 3 & 4),
  covered_conductor_km, arm5_km
speed_by_stage = avg km per working day per stage (same window)
slowest stage = min(speed_by_stage)  → shown in RED
```

Stage ↔ machine mapping comes from `machine_routing.stage`. The conductor/stranding output is converted to cable km by dividing core km by `order_cores.cores_per_cable` of the entry's order. 17-Nov pull reference: 37.33 cable km over 08–17 Nov (§4.2.4).

### 7.8 Bobbins (Section 8)

For **open lots** of the selected machine (see §6):

```
bobbins_to_open (per lot)  = max(spools_required − spools_produced, 0)
extra_opened   (per lot)   = max(spools_produced − spools_required, 0)
total_to_open              = Σ bobbins_to_open
latest = bobbin_status where date = max(date)
loaded  = Σ count where status ilike 'loaded%'
filled  = Σ count where status ilike 'filled%'        (group by item)
empty   = Σ count where status ilike 'empty%'
other   = bad rewinding / Fassa / workshop / broken   (show separately)
owned   = bobbins_owned where from_date = max(from_date <= today)
not_counted = owned − (loaded + filled + empty + other)
filled_idle = filled bobbins whose item ≠ running item and ≠ next lot's item
```

"Running item" = the item of the latest Grid entry on the machine. "Next lot" = the open lot with the lowest priority number.

**Per priority — spooling readiness (8.3):**

```
balance_spools  = spools_required − spools_opened
spooling_days   = ceil(balance_spools / (armour_items.opening_capacity_per_day × machines_on_item))
must_start_by   = inner_ready_date − spooling_days − 1 day
spool_finish    = today + spooling_days
RED    if spool_finish > inner_ready_date
AMBER  if spool_finish < inner_ready_date − bobbin_amber_early_days   (ties up bobbins)
GREEN  otherwise
```

`machines_on_item` comes from setting `spooling_machines_per_item` (default `1`, **VERIFY**).

`inner_ready_date` comes from the inner feed or the order's expected inner date. **VERIFY the source**: the DEMO sheet's "Plan Readiness" tab has an "expected inner-ready date". Use it if it is promoted to the real sheet.

**Bobbin lifecycle flags.** Show these as a warnings list:

1. Free-lot bobbins > 30% of a day's spooling.
2. Rotations < 90% of target, or blank item / bobbin no.
3. Filled bobbin older than 7 days, or filled with no approved lot.
4. Strip on machine does not match the order's armour (for example 0.6 vs 0.8).
5. Strip kg used vs Grid km × kg/km differs by more than 5%.
6. Bobbin in workshop for more than 7 days.
7. More than 3 bad-rewinding / Fassa bobbins per day.
8. Owned count reduced without MD approval, or broken bobbins kept for more than 15 days.
9. Counted ≠ owned on any day.

**Reference — rotation → length** (the sheet computes this already; use it only for validation):

```
Length (m) = N × 3.1416 × (196 + Do) ÷ 2000
  N  = rotations
  Do = outer diameter of winding (mm)
  barrel = 196 mm, traverse = 232 mm
```

Steel strip 4×0.6 target: 6,724 rotations ≈ 8.4 km ≈ 169 kg (packing 0.35, lay 1.07, weight correction 1.0665, 21.5 kg per cable km).

### 7.9 Planning pending and days of work (Section 9)

```
pending_orders = order_lines where series in kgp_order_series and stage = 'ARMOURING'
                 and balance_km > 0          (Phase-1 fallback: club_orders.armouring_balance_km)
pending_km     = Σ balance_km
days_of_work   = pending_km / avg_km_per_working_day
planned        = order present in spool_plan of ARM5 (open plan rows)
unplanned_km   = pending orders not in spool_plan of ANY armouring machine (ARM1/4/5/6/MS6)
unapproved_km  = pending orders whose lots are not "Approved by MD" in run_sheet
                 (SFG order-level flag: order_lines.approved = 'No')
```

**17-Nov pull baseline:**

- 25 P7 orders, **176.3 km** armouring pending (175.3 km approved, 1.0 km not approved: EFKON P726Y-00301).
- Average over the last 10 working days ≈ **7.9 km**, so about **22 days of work**.
- Grid order numbers can be multiple or wrong (§7.13), so the km per order must use §7.13.

The orders table shows party, prod order, item, pending km, planned? (machine), approved?, and inner status. Sort by km descending.

### 7.10 Pace rule (v2: machine plan)

Upstream stages (laying, insulation, conductor) may be released at most `pace_margin_pct` % above the slowest downstream stage (laying / inner + outer sheathing / armouring), **counting stock already lying first**.

ACSR/AAAC may run at full speed. Sioplas conductor runs only as much as Sioplas needs.

### 7.11 Execution sequence (v2: Section 6)

Rank pending armouring orders by tier, then within a tier:

1. Inner ready (feed lying)
2. Laid, waiting for inner
3. Insulated, waiting for laying
4. Still at conductor / insulation

Within each tier, sort by a higher share of cable with bobbins ready, then by older `order_date`. **Unapproved orders always go last.**

Action text per order:

| Situation | Action text |
|---|---|
| Ready and bobbins ready | "Armour now" |
| Inner not done | "Inner first" |
| Bobbins short | "Open n more spools" |
| No lot | "Raise a lot" |
| Not in plan | "Add to spooling plan" |

`done_by_days` = cumulative pending km ÷ avg km per working day.

### 7.12 Planning rules the UI must respect (8.1)

- Plan only lots ticked **"Approved by MD"**. Only Deepak creates or approves lots.
- An order whose conductor has not started is not put into a lot.
- **One armour type per lot.** Strip 4×0.8 and 4×0.6 go in separate lots; wire lots are split by wire size. One kind of core per lot. A cable lot is ≤ 70–80 km.
- Machine plans use the machine's own Grid history (sizes, parties, real km/day), not assumed capacity.
- **Stage-feed check:** armouring cannot be planned unless the inner sheath is done or planned the day before.
- **Balances:** use SFG first, then Grid entries not yet in SFG. **Never use Club & Run balances alone.** N.D. batches are never stock. Dead stock is used before new manufacture.
- ABJ Syndicates: all manufacturing is stopped, so exclude it. Very small power-cable orders are not made. CC conductor cables and items needing 3.15 mm armour wire are made at Poly Park, not KGP, so exclude them.
- Finished-goods drums must be ready 4 days before outer sheath.

### 7.13 Matching Grid entries to orders

The pull README says a Grid entry may carry **two order numbers** (e.g. `P726Y-00267,P726Y-00268`) or the **wrong order**: "match by item, drum and metres".

1. Split `production_order_raw` on `,`, `/` and spaces into `production_orders[]`. Set `multi_order` when there is more than one.
2. Pick a candidate order only if its armoured SFG item matches the Grid `item`, ignoring the bracketed suffix and spacing, and its armouring balance is > 0.
3. With several candidates, allocate the metres to the **oldest order first** (by order date) until its armouring balance is used up, then the next. Write the allocations to `grid_allocations(grid_id, prod_order, qty_m, rule)`.
4. With no candidate, allocate to `UNMATCHED`, show it in a warning list, and keep it in the machine totals.

Machine-level totals (daily output, average) **always use the full entry** and are never affected by allocation.

---

## 8. Scheduling (n8n) and job endpoints

All job endpoints are `POST`. They require `Authorization: Bearer ${JOB_SECRET}` and return `{ ok, results: [{ source, rows, status, error }] }`. They are idempotent. A job takes a Postgres advisory lock, so two runs of the same job never overlap.

| n8n workflow | Schedule (IST) | Calls | Sources |
|---|---|---|---|
| A5 – full refresh | **07:30**, **11:47**, **16:47** daily | `/api/jobs/refresh?scope=all` then `/api/jobs/alerts` | all |
| A5 – shift refresh | every 2 h, 24×7 (00, 02, … 22) | `/api/jobs/refresh?scope=grid,bobbinlog,bobstatus,owned,lots` then `/api/jobs/alerts` | grid, bobbins |
| A5 – unconsumed watch | every 30 min | `/api/jobs/refresh?scope=inner,sfgstock&ifChanged=1` | reloads only when `Unconsumed Inner!A2` (last updated) has changed |
| A5 – stale check | hourly | `/api/jobs/alerts?rules=stale` | — |
| Bobbin Status auto-date (**existing** workflow `fMF4u5KCWuTGnezV`) | existing | — | **Add the Spooling Production Log (Armouring 5) to it** (gap noted in the PDF). This writes today's date in column E of Bobbin Status where D is filled and E is blank. This is an n8n change, not app code |

Each n8n workflow must:

- Retry once after 2 minutes on a non-2xx response.
- Post a failure message to the Urgent WhatsApp Message sheet (or n8n's error workflow) after the retry fails.

The app also has a **"Refresh now"** button on the dashboard for admins. It calls the same runner through a server action, with `triggered_by = manual:<email>`.

Do **not** use Vercel Cron. n8n is the single scheduler.

---

## 9. Alerts

The evaluator (`/api/jobs/alerts`) checks each rule, upserts `alert_events` (one open event per rule + machine), and **sends only on first occurrence or escalation**, never on every run.

Sending means appending a row to the **Urgent WhatsApp Message** sheet. Build the row from that sheet's header row (columns are `TBD`; read the headers). If no one acknowledges within `escalation_after_min` (setting, default 60, **TBD**), the evaluator sends again to the next level of `escalation_matrix`.

An event auto-resolves when its condition is false on a later run.

| Rule id | Condition | Severity |
|---|---|---|
| `feed_cover_low` | feed_cover_days (§7.5) < `feed_cover_alert_days` | RED |
| `bobbins_short_next_lot` | the next lot's bobbins_to_open > 0 **and** its readiness = RED (§7.8) | RED |
| `men_no_grid` | men allocated on the machine for the current shift, but no Grid entry in the last `no_grid_entry_hours` | AMBER |
| `erp_grid_mismatch` | \|ERP-reported armouring km − Grid km\| > `erp_grid_mismatch_km` for a date | AMBER |
| `bobbin_count_mismatch` | latest counted ≠ owned (`bobbin_count_check.difference ≠ 0`) | AMBER |
| `stale_data` | any source's last `ok` refresh is older than `stale_data_hours` | AMBER |
| `refresh_failed` | the last run of a source has status `error` | AMBER |

The PDF also proposes a KGP 6-hourly report (08/14/20/02) per machine, comparing Grid entry with men allocated. Build it as `/api/jobs/report-6h` in Phase 3, using the same send channel.

**Data for `men_no_grid` (Phase 2+):** ERP labour posts late, so this rule needs same-day attendance. Until biometric punch data is integrated (§13), compute it from `machine_master.men_per_shift` and the must-run flag: the machine is *expected* to run, so a missing Grid entry for 6 h still triggers the alert. Label the message accordingly.

---

## 10. UI specification

### 10.1 Global display rules (from Deepak — mandatory)

- **Visual, colourful, distinct colour per tile and per stage.** Deepak remembers sections by colour, so colours must be **stable** across releases. Define them once in `lib/theme/stageColors.ts`.
- **Load colours:** bottleneck = **red**; low load = **blue**; no load = **violet**; normal = green.
- **No Gantt charts.** Use machine tiles and a day-wise board instead.
- **Always show the party name**, not only the order number (e.g. "Adani – P7-209").
- When a machine has no plan, its labour "**can be utilized for some other purposes**". Never say "free".
- In labour reports, exclude GMD labour/cost centres. Show machine-wise first, then process groups (Plant, Logistics, Maintenance, Miscellaneous).
- Every block shows **"Data as of DD-Mon HH:mm"**. If the data is older than `stale_data_hours`, show the label in red.
- Every printed or exported card carries **"VERSION DD-Mon-YY / Rev n"**, from the app setting `report_version`.
- Responsive: desktop (meeting screen) and phone width. Tables are sorted **largest first**.
- Numbers: km to 1 decimal place on tiles and 2 in tables. Days to 1 decimal place. Dates as `16-Nov`.

### 10.2 Page layout — `/dashboard/[machine]` (default `arm5`)

Order of blocks, top to bottom. **v1** = must ship. **v2** = later.

| # | Block | v | Content | Visual |
|---|---|---|---|---|
| H | **Header line** | v1 | Last Grid entry date+time on the machine · men allocated and km on `latest_labour_day` · days of planned work left (§7.9) · days of inner feed ready (§7.5) | 4 large KPI tiles. Feed-days tile turns red below the threshold |
| 1 | **Inner waiting for armouring** | v1 | feed_km, feed_cover_days, order table (party, order, item, HOD, km) | Tile + table |
| 2 | **Laid-up, waiting for inner sheath** | v1 | waiting km, days of armouring once inner is done, order table | Tile + collapsible table |
| 3 | **Insulated core, waiting for laying-up** | v1 | layable km − laying done, days | Tile + collapsible table |
| 4 | **Conductor waiting for insulation** | v1 | 4a extruders (Ext 22/35), 4b Sioplas 4; km and days each | Two tiles + tables |
| 5 | **Armoured, waiting for outer sheath** | v1 | km, days at outer speed (Extruder 52) | Tile + table |
| — | **Production by stage, last 10 days** | v1 | bars per shift day per stage + "speed by stage" bar, slowest stage in red | Grouped bar chart + horizontal bar |
| 7 | **Manpower vs production** | v1 | latest labour day: men shift A/B, km day/night, km per man, avg km per working day (last 2 weeks) | KPI tiles |
| — | **Daily armouring output & men** | v1 | last 14 shift days: day / night / slip km, men count above each bar | Stacked bar chart with labels |
| 8 | **Bobbins for running and next items** | v1 | to open, extra opened, filled idle; pool bar (loaded / filled / empty / other / not counted = owned − counted); lot-wise table (lot, item, required, produced, balance, readiness RED/AMBER/GREEN, must start by); lifecycle warnings | Horizontal stacked pool bar + table + warnings list |
| 9 | **Planning pending and days of work** | v1 | pending km, days of work, unplanned km (not on any armouring machine), unapproved km, orders table | Tiles + table |
| — | **Latest production entries** | v1 | last 7 shift days of Grid entries: shift day, shift, order, party, item, drum, km, entered by | Table, newest first |
| 6 | **Suggested execution sequence** | v2 | §7.11 ranked list with action text and cumulative "done by" days | Numbered card list (not a Gantt) |
| — | **Club & approve – common items** | v2 | each conductor/insulated item with all orders needing it, routed machine, run days, same-item stock (ERP, N.D. excluded, of which > 90 days), stock further down, FG dead stock, approval ticks | Table grouped by item |
| — | **Final program – all pending KGP orders** | v2 | all KGP orders ranked, machine route, finish date; tiles for orders, programme end date, bottleneck machine | Tiles + table |
| — | **Machine plan & "Next 7 days" board** | v2 | machine tiles (load colour), 7-day board by machine; idle must-run machine in red with the "labour can be utilized…" note; dashed tile = run only when needed | Tile grid + day columns |

**Source availability per block.** Phase 1 (Sheets only) can fully show blocks **1, 2–5 (via the UNCONSUMED SFG STOCK sheet), 8, and 9** (using the Club & Run Orders balance as a temporary fallback, labelled as such). **H, Production by stage, 7, Daily chart and Latest entries** need the SFG `grid` and `labour` sources. Until then they render a grey "Waiting for SFG data connection" tile.

### 10.3 Other pages

| Route | Purpose |
|---|---|
| `/` | Redirects to `/dashboard/arm5` |
| `/dashboard/[machine]` | Main dashboard. Machine selector (v2): arm1, arm4, arm5, arm6, ms6 |
| `/admin/settings` | Edit `settings` (admin only) |
| `/admin/refresh-log` | Last 200 runs, filter by source/status, "Refresh now" button |
| `/admin/alerts` | Open and resolved alert events, acknowledge button |
| `/admin/mapping` | View the `machine_alias` / `stage_alias` maps and unmapped Grid machines |
| `/print/[machine]` | Print-friendly morning card with the version label |

### 10.4 Client state

- **Zustand store** (`store/ui.ts`): `selectedMachine`, `selectedDate` (default = latest shift day), `collapsed: Record<blockId, boolean>`, `tableSort`. Persist `collapsed` to localStorage inside try/catch.
- **TanStack Query** wraps `GET /api/dashboard/[machine]?date=` for auto refetch every 5 minutes while the tab is visible. Initial data is passed from the RSC page as `initialData`.

---

## 11. Auth and access

- Auth.js v5 with the Google provider. In the `signIn` callback, allow the user only if `profile.hd === 'laserpowerinfra.com'` **and** `email_verified`.
- Roles live in a `users` table (`email`, `role: 'viewer' | 'admin'`). Seed Asmita and Deepak as `admin`. Everyone else in the domain is `viewer`.
- Protect `/dashboard`, `/admin` and `/print` via `proxy.ts` (Next 16), plus a server-side check in each route.
- Job endpoints use only the Bearer `JOB_SECRET`. No session is needed.
- The Google service account is read-only on every sheet except the Urgent WhatsApp Message sheet, which needs Editor.

---

## 12. Project structure

```
app/
  (auth)/login/page.tsx
  dashboard/[machine]/page.tsx          # RSC; composes blocks
  dashboard/[machine]/_blocks/*.tsx     # one component per block (§10.2)
  admin/{settings,refresh-log,alerts,mapping}/page.tsx
  print/[machine]/page.tsx
  api/
    auth/[...nextauth]/route.ts
    dashboard/[machine]/route.ts        # JSON for client refetch
    jobs/refresh/route.ts
    jobs/alerts/route.ts
    jobs/report-6h/route.ts             # phase 3
db/
  schema.prisma                         # Prisma models (§5)
  views/*.sql                           # v_daily_output, v_labour_daily, v_feed, v_upstream, v_bobbins, v_pending ...
  migrations/
  seed.ts                               # settings, machine_alias, users
lib/
  sheets/client.ts                      # googleapis service account, batchGet, header mapper
  sfg/client.ts                         # SfgClient interface + fixture / snapshot-sheet / http impls
  loaders/*.ts                          # one per source id (§4)
  loaders/runner.ts
  calc/{shift,averages,feed,upstream,bobbins,pending,sequence,pace,sfgRules}.ts
  alerts/{rules,evaluator,send}.ts
  settings.ts                           # typed getter with cache
  theme/stageColors.ts
store/ui.ts
fixtures/sfg/*.json                     # generated from the 17-Nov SFG pull sheet (§4.2)
tests/{calc,loaders}/*.test.ts
proxy.ts
```

---

## 13. Open items (must be settled; track as GitHub issues)

From handover §9 and §10.2:

1. **SFG API (blocker for live Phase 2; not for building).** Samrat needs to confirm read-only saved queries / JSON endpoints for:
   - `LINES_ALL`
   - `GP_ROWS` (ARMOURING NO- 5 + KGP stages)
   - `EMP_ALLOCATION` (AR005)
   - `STOCK_ROWS` (N.D. excluded)
   - `DEAD_STOCK_ROWS`

   The field lists are now known from the 17-Nov pull (§4.2). The BOM ratio is no longer needed (cores_per_cable is derived).
2. **Sheet access.** Share every sheet in §17 with the service account. Today the Claude dashboard is private to Deepak.
3. **v1 scope sign-off (step 0).** Deepak confirms which blocks are "must" for the morning meeting.
4. **Thresholds.** Deepak provides feed cover days, bobbin short, mismatch limit and escalation timing.
5. **Escalation matrix.** Who gets the alert first, and who next.
5a. **From the 17-Nov SFG pull. Ask Samrat:**
    - Which timestamp the Grid shift day uses (§7.1: 23:00–23:59 entries moved to the next day).
    - Add `HOD` and `job_type` to the query outputs.
    - Which done-qty rule the API returns (§4.2.8).
    - ERP labour booked all men on shift A, so ask whether shift B exists in ERP for AR005.
    - The EMP_ALLOCATION query returned only 3 dates. Ask whether it can take a date range.
5b. **Feed source.** Unconsumed Inner showed 5.0 km on 16-Nov; order lines gave 10.0 km on 17-Nov. Deepak chooses (§7.5).
5c. **Grid data quality.** 11 of 71 Armouring 5 entries carry two order numbers. The plant should enter one order per drum.
6. **Size-wise armouring rate table.** This replaces the conflicting 7.8 km/day vs 7/10 km rules.
7. **Unit error.** KHG Machines to Run Daily shows Armouring 5 capacity as "10 TON". It should be km. Fix it in the sheet; the loader should also treat that field as km.
8. **Old lots open.** For example LOT-007/008 (order 209) are open in Production Planning while ERP shows them fully armoured. The plant must close them, or "bobbins to open" will be too high. Add a dashboard warning: *"lot open but order fully armoured"*. Phase 2 needs order_lines for this.
9. **Spooling Data auto-fill from the Bobbin Log.** Confirm it works and is locked.
10. **Bobbin Status auto-date** for Armouring 5 (the n8n change in §8).
11. **Data-entry fixes (plant: Devika / Kamlesh).** Make lot creation mandatory before loading, add an "Armouring machine" column in Production Planning, and add a downtime reason per shift in Grid.
12. **VERIFY items in this spec:**
    - the meaning of "slip" km
    - ERP shift A/B mapping
    - the Unconsumed Inner filter for ARM5
    - the source of the inner-ready date
    - spooling machines per item
    - the Urgent WhatsApp sheet columns
13. **Same-day manpower.** The biometric punch sheet (EMP DAILY ATTENDANCE PUNCH) is a candidate Phase 3 source.

---

## 14. Testing and acceptance

**Unit tests (Vitest), required for:**

- §7.1 shift day (the examples given)
- §7.3 average with zero days and fallback
- §7.5 feed cover
- §7.6 each section, including conductor dedupe and min-over-cores
- §7.8 to-open / extra / pool / readiness RED-AMBER-GREEN at the boundaries (exactly 10 days early = GREEN)
- §7.9 unplanned across machines
- the SFG done-qty rule

**Loader tests:** use header-mapping fixtures with shuffled columns, a missing header (must error), and blank rows.

**Playwright smoke test:** log in as a stubbed session, the dashboard renders every v1 block, and stale labels show when `loaded_at` is old.

**Snapshot test (before the parallel run):** load the 17-Nov pull with the snapshot SfgClient and assert:

- 669 order lines and 119 orders.
- 25 armouring-pending P7 orders, totalling 176.301 km.
- 71 Arm5 Grid entries. The latest entry is 2026-11-17 15:18:40.
- Daily output for 2026-11-12 = 14.989 km (Day 9.990 / Night 4.999).
- KGP stage output: Armouring 5 = 51.017 km over 08–17 Nov.
- ERP stock has 110 items; dead stock has 19.
- Shift-day mismatches flagged: 3.
- Feed from order lines = 10.0 km.

**Parallel run (handover step 8):** run the new dashboard side by side with the existing Claude dashboard for 2 weeks. Build `/admin/parallel-check` with a manual entry form for the Claude dashboard values. Each morning, compare:

- last Grid entry
- km and men for the latest day
- inner feed km
- bobbins to open
- pending km and days of work

**Accept** when all of these match within **±0.5 km** and **±1 bobbin** for **10 working days**, and every scheduled refresh ran on time (`refresh_log`).

**Switch-over (step 9):** Deepak approves. The Claude refresh task part (A) is switched off. The Club & Run refresh (B) and filter guard (C) move to n8n. The new link is shared with the morning-meeting group, and the Claude dashboard is marked "retired".

---

## 15. Build phases

| Phase | Deliverable | Done when |
|---|---|---|
| **0 – Setup** | Next 16 app, Prisma + Neon, Auth.js Google (domain-restricted), settings seed, Sheets client with header mapper, runner + refresh_log, `/admin/refresh-log` | Login works; a dummy loader runs from n8n |
| **1 – Sheets data** | Loaders: lots, bobbinlog, bobstatus, owned, itemmaster, inner, sfgstock, machines, itemroute, orderroute, rundaily, prodlots, otherarm. Blocks **1, 2–5, 8, 9** (fallback), stale labels, colours | Values match the Claude dashboard for these blocks |
| **2 – SFG data** | `SfgClient` HTTP implementation, loaders grid, labour, orders, stock, deadstock (built first against the snapshot SfgClient). Blocks **H, Production by stage, 7, Daily chart, Latest entries**; switch block 9 to order_lines | Parallel run starts |
| **3 – Alerts & reports** | Alert evaluator + Urgent WhatsApp send + escalation; 6-hourly report; print card with version | Alerts fire in test |
| **4 – Parallel run & go-live** | `/admin/parallel-check`, 10 matching working days, switch-over | Deepak sign-off |
| **5 – v2** | Execution sequence, Club & approve, Final program, Machine plan / 7-day board, pace rule, machine selector (Arm 1/4/6/MS6), target lines (km/day, km/man per size), then Laying 5 and Extruder 52 | — |

---

## 16. Environment variables

```
DATABASE_URL=                     # Neon pooled connection string
DATABASE_URL_UNPOOLED=            # for migrations
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
ALLOWED_GOOGLE_DOMAIN=laserpowerinfra.com
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_KEY=       # private key, \n-escaped
JOB_SECRET=                       # shared with n8n
SFG_API_BASE_URL=                 # TBD (Samrat)
SFG_API_TOKEN=                    # TBD
SFG_CLIENT_MODE=fixture           # fixture | http
TZ_BUSINESS=Asia/Kolkata
```

Sheet IDs live in `settings` (`sheet_ids` JSON) rather than env vars, so they can change without a redeploy.

---

## 17. Source-link register (from handover §11)

| Name | Spreadsheet ID / link |
|---|---|
| Armouring 5 Morning Dashboard (Claude, private to Deepak; the thing being replaced) | https://claude.ai/artifact/KnBtNLLAS7kuod31EWNnNp |
| Spooling Production Log | `1Kog4-rI6ACEiLiw9lzMOhVfg5s1SGmUz516LjYLSkp0` |
| DEMO – Spooling Production Log (Plan Readiness trial) | `12IkDr6rAbDLvjyKpwkuw7znTSG0JfUe1Jit5m4azNp0` |
| TRIAL – Spooling Production Log (Lot Planning) | `1quWL2-39NZXwW6ZdarmLMQoq3wQmU-bd7Q8xFlYI15c` |
| KGP Machine Routing | `1OxvdZo9Uv-tVn5_S_6MLxF_Wzq5FBd_H6G27TGvpsrQ` |
| KHG Machines to Run Daily | `1EiRA3GUfM0aI7Mp1IpPDqnK41L3PBWN-nvje7AK3dWg` |
| KGP Production Lots – Club & Run Together | `1fOY-x0tEh20S8jC2cHg2LkaF8N1bGAcHYGaKJNlF_30` |
| UNCONSUMED SFG STOCK (SFG Progress Report KGP) | `1Il18JWpTEuLi22rCVVPf7YnVoftgxp16KrMgRBbD0os4` (**VERIFY**: transcribed from the PDF, "not found" on test) |
| Armoring 1 | `1_uKcZmuZPCxoCSEZvJaUMOtfIBUH2vGkvIPovTEEKi8` |
| Armoring 4 | `1dplEUxAp6_pRreK_PvP1yYJViNBmizh8kDQjpZ_sWE8` |
| Armoring 6 | `1Y2YyVZO8HdASUOIvQzm36swrZbQgXFJQ5gk7i0isEsA` |
| Armoring Multi-Strand 6 | `1vv8FhXOeNUISBpWGTTYXwwuVs6WZbr_iWL2KtSt316E` |
| Armouring & Spooling Roster | `1SjasA28RXNPji7pxEzcU9RqfruTs7FYM1cP7WUDKIcc` |
| Labour Allocated vs Machine Production | `1TrpjwRw5TUkPa9ovYOBOl5LEeD0eOBUnvcumFp9Bbg4` |
| KGP RM Control – Opening Stock, Issue & Requisition | `1tJ8rwKBSlft0E2_kZWDT1Be-i0Q3NBlW2N29Y2nThb0` |
| Urgent WhatsApp Message (alerts) | `1uVEt7aE5gDffTrxWTvpS2ajA4290rbGCjZ-M_3htZ5w` |
| **Armouring 5 – SFG Dashboard Data (pulled 17-Nov-26 15:34)**: SFG reference pull, fixtures source (§4.2) | `1V5YkE3ukRRib_1hlUU3xDTZuskJaYCXMPPcbqIeKPPI` |
| SFG dashboard (Samrat) | https://laser-sfg.duckdns.org/ |
| Grid / WorkOnGrid | https://app.workongrid.com |
| n8n Bobbin Status auto-date workflow | `fMF4u5KCWuTGnezV` (Laser n8n cloud) |

> Spreadsheet IDs were transcribed from the PDF. Some characters (l / I / 1, O / 0) may be wrong. Confirm each ID by opening the sheet before seeding `sheet_ids`.

---

*End of spec — VERSION 17-Nov-26 / Rev 2*
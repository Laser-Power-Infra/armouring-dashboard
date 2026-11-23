# KGP 4 Cards – Build Specification (new layout)

**Version:** 19-Nov-26 Rev 1 · **Owner:** Deepak Goel (CMD) · **Plant:** Kharagpur (KGP)
**Applies to:** the four new-layout cards approved on 18-Nov-26:

| No | Card | Who uses it | Period |
|---|---|---|---|
| 1 | KGP Machine Production Cards (one page per machine + cover page) | Shift supervisors, machine operators | 15 days (day 0 … day 14) |
| 2 | KGP Labour Allocation Card | Shift supervisors, HR / time office | 14 days (day 0 … day 13; roster ends on day 13) |
| 3 | KGP Finished Goods Drum Requirement Card | Stores, drum yard, purchase | Drums to be ready day 0 … day 14 |
| 4 | KGP Drum Assembly Card | Drum assembly team (Dilip Singh) | Drums to be made day 0 … day 14 |

This document is the single rule book. Claude builds every new card revision from it. Asmita's team uses it to map the dashboard to the data sheet. **If a rule here and a card differ, the card is wrong.**

---

## 0. Build order and data flow

```
 SOURCE SHEETS ──(hourly task copies)──▶  DATA SHEET "Armouring 5 – SFG Dashboard Data"
                                            (ID 1V5YkE3ukRRib_1hlUU3xDTZuskJaYCXMPPcbqIeKPPI)
                                                     │
            ┌────────────────────────────────────────┼────────────────────────────┐
            ▼                                        ▼                            ▼
   STEP 1 PRODUCTION PLAN                  STEP 2 LABOUR ALLOCATION      STEP 3 DRUM NEED
   (simulation, day by day)                (roster + skill + plan)       (outer-sheath dates)
            │                                        │                            │
            ▼                                        ▼                            ▼
   Card plan tab ──▶ CARD 1            Labour allocation + Spare men ──▶ CARD 2   FG drum need ──▶ CARD 3
                                                                                  Drum assembly ──▶ CARD 4
```

Always in this order: **plan → labour → drums**. Card 2 needs the machine working days from Card 1. Cards 3 and 4 need the outer-sheath and Raccoon dates from Card 1.

Day numbering: **day 0 = first day of the card (D0)**. Date of day *d* = D0 + *d* days. Shift day: Day shift 08:00–20:00, Night shift 20:00–08:00. A Night shift belongs to the date it starts on.

---

## 1. Data sheet – tabs and columns

Read every tab **by heading, never by column letter**: the source sheets can add columns.

### 1.1 Input tabs (filled by the hourly scheduled task)

| Tab | Source sheet (ID) and range | Refresh | Used for |
|---|---|---|---|
| **Order lines** | SFG dashboard `LINES_ALL` (laser-sfg.duckdns.org), all P7 orders + Sioplas HT core lines, only orders with balance > 0.05 | 08:58, 10:58, 14:58, 18:58 | Balances per order and stage (Card 1) |
| **Material per item** | SFG dashboard `ORACLE_MASTER_ROWS` (ERP BOM) for the SFG BOMs of pending orders | Daily | Raw material per job, armour size (Card 1, lot check) |
| **C&R Lots** | Club & Run `1fOY-x0tEh20S8jC2cHg2LkaF8N1bGAcHYGaKJNlF_30` 'Lots'!A1:L150 | Hourly | Lots, run order, Approved by MD |
| **C&R Orders** | same sheet 'Orders'!A1:V400 | Hourly | Order → lot, run order, Supply from |
| **Roster** | newest Drive file whose title contains `KGP-ROS-01`, tab 'MACHINE ROSTER (machine name)'!A1:AN500 | Daily | Shift / OFF per person per date (Card 2) |
| **Skill** | `1PpDwZ5vXyLGDsovbSlOiH3HxCYyQMy2XD5P6tQAfDYU` 'Highlighted (Excel data)'!A1:R500 (owner Sujoy) | Daily | Home machine, operator or helper (Card 2) |
| **Men per shift** | `1EiRA3GUfM0aI7Mp1IpPDqnK41L3PBWN-nvje7AK3dWg` 'Machines'!A6:N120 (headings in row 6) | Daily | Men needed per machine per shift (Cards 1, 2) |
| **Drum stock** | `1AwxIYC73AGS2hLL0MEuXAdt2vhE7IWZEu5ELDTp-XBE` 'Drum Stock'!A1:R120 | Daily | FG drum stock, alternative size, flange stock (Cards 3, 4) |
| **RM stock** | `1tJ8rwKBSIft0E2_kZWDT1Be-i0Q3NBlW2N29Y2nThb0` 'Opening Stock'!A1:L200 | Daily | Raw material shortage check (Card 1) |
| **Machine routing** | `1OxvdZo9Uv-tVn5_S_6MLxF_Wzq5FBd_H6G27TGvpsrQ` 'Machines'!A1:F100 | Daily | Machine speeds |
| **Cores per cable** | formula on Order lines | Automatic | Core km ↔ cable km conversion |

**Order lines columns (A–P):**

| Col | Heading | Meaning |
|---|---|---|
| A | Production order | e.g. P726Y-00267. Short name = last 3 digits ("267") |
| B | MC no | Customer order (MC), e.g. SP26Y-00188 |
| C | Order date | yyyy-mm-dd |
| D | Party | Customer, first 28 characters |
| E | FG item | Finished cable name |
| F | FG type | `FG_LEVEL_4_NAME`: SMALL POWER CABLE / BIG POWER CABLE / HT … (small vs big rule) |
| G | Approved | Yes / No (ERP approve status). Count both, flag "No" |
| H | Stage | CONDUCTOR, INSULATION, LAYING, INNER, ARMOURING, OUTER, … (`sfgLevelSchedule_`) |
| I | SFG code | Item code of that stage |
| J | SFG item | Item name of that stage (size, full / half core) |
| K | Net order qty | Ordered at that stage (core km up to insulation, cable km from laying) |
| L | Done qty | `getLineProdDone` – produced at that stage |
| M | Balance | K − L |
| N | FG item code | |
| O | Scope | Kharagpur, or Core for Poly Park (P1) |
| P | SFG BOM | Link key to Material per item column A |

**Material per item columns (A–I):** SFG BOM · Stage · SFG code · SFG item · Line no · Material code · Material · Qty per unit of SFG item · Unit.

**Roster columns:** Machine type · Team (operator) · Role (Operator / Helper) · Emp code · Name · Main machine · one column per date (e.g. "Tue 17"). Date cell values: `D <machine>` = day shift, `N <machine>` = night shift, `D spare` / `N spare` = on duty without machine, `OFF` or blank = off. **Only the first letter (D / N) and OFF are used. The machine written in the roster is not used.** Card 2 places men itself. When an emp code appears twice, the last row is the current one.

### 1.2 Output tabs (written by Claude each time cards are issued; the hourly task never touches them)

Every row starts with **Version** (e.g. `17-Nov R2 plan`). The whole tab is replaced at each issue. Dates are written as `dd-Mon-yy`.

| Tab | Card | Columns |
|---|---|---|
| **Card plan** | 1 | Version · Date · Process · Machine · Production order · MC · Party · cable · Lot · Plan qty · Unit · Size / core · Raw material to consume · Feed from previous process · Feed status (`ok` / `drum` / `wait`) · Job |
| **Labour allocation** | 2 | Version · Date · Shift (Day/Night) · Machine · Operator · Helpers (comma list) · Men needed · Men given · Note |
| **Spare men** | 2 | Version · Date · Shift · Men not allotted to a machine (comma list; "(op)" after an operator's name) |
| **FG drum need** | 3 | Version · Used on (outer sheath / conductor date) · Ready by (with "(LATE)" if before day 0) · Drum size · Drums needed · From stock · To assemble · Production order · Party · cable · Lot · Note |
| **Drum assembly** | 4 | Version · Assemble by (late rows: day 0 + "(LATE – was <date>)") · Drum size · Drums to make · Flanges needed · Flanges from · Production order · Party · cable · Lot · Drum used on |

---

## 2. Common rules for all four cards

### 2.1 Version and file names
- Label: `VERSION DD-Mon-YY / Rev n` in the box at top left of every page. First issue of a day = Rev 1. **Every card shown to Deepak or sent to anyone gets the next Rev, even a draft.** One Rev number is shared by all four cards of one issue. Never give two different cards the same Rev.
- Line at the top of the cover: "Rev n replaces Rev n-1: <changes>".
- File names: `KGP_Machine_Production_Cards_<DD>-<DD+14><Mon>_V<DDMon>-R<n>.pdf`, `KGP_Labour_Allocation_Card_…`, `KGP_Finished_Goods_Drum_Requirement_Card_…`, `KGP_Drum_Assembly_Cards_…`.
- Next revision after 18-Nov Rev 5 = **Rev 6**.

### 2.2 Look (fixed, approved 18-Nov-26)
- Built as **HTML** (template), printed to PDF A4 landscape, margins 9 mm (bottom 12 mm). Never PNG.
- Font **Roboto** 400/700, embedded base64 (`fonts/node_modules/@fontsource/roboto/files/roboto-latin-{400,700}-normal.woff2`). Body 9 pt.
- Colours: main blue `#1c3a6b` (headings, table heads), light blue `#dfe7f3` (label cells), attention orange `#c2410c` (all "needs attention" words), border `#9aa7bd`.
- **Calendar colours, two only:** working / OK day **green `#2e7d32`** with white text, off / nothing day **yellow `#fde047`**. Days outside the card are grey `#eceff3`. Cards 2–4 use orange `#c2410c` for "short / held up" days.
- Every table cell has a border. Table heads repeat on each printed page. Rows never split across pages.
- Page header, every card: version box · group line (small caps) · card title (20 pt) · **facts table** (label | value) on the left; **calendar** (Mon–Sun weeks, 345 px wide) with legend on the right.
- Box "How to read this card" (light blue) under the header.
- Labour wording (standing rule 13-Nov-26): never write "free", "freed" or "idle" for labour. Write **"the labour can be utilized for some other purposes"**.
- Name the party, not only the production order.

### 2.3 Calendar construction (all cards)
```
first = D0 − weekday(D0)              (Monday of the first week)
last  = (D0 + WIN − 1), moved forward to Sunday
for each date c from first to last:
    i = c − D0
    if i < 0 or i ≥ WIN  → grey cell "out", day number only
    else                  → coloured by the card's rule (below)
label = day number; add month name when day = 1 (e.g. "1 Dec")
```
WIN = 15 for Cards 1, 3, 4; ND = 14 for Card 2.

### 2.4 Units
- Conductor and insulation: **core km**. Laying onwards: **cable km**.
- Core km per cable km = cores (Cores per cable tab). 3.5-core cable: **3 core km full core + 1 core km half core per cable km**, always shown and checked separately. 3-core HT = ×3, 4-core = ×4, 2-core = ×2.

---

## 3. STEP 1 – Production plan (feeds Card 1 and the *Card plan* tab)

### 3.1 What may be planned
1. Only lots ticked **Approved by MD** in C&R Lots, in **Run Order**. Never tick, untick, create or change lots.
2. Orders whose conductor has not started and that are in no lot: not planned ("Waiting – no lot").
3. ABJ Syndicates: never planned (manufacturing stopped 30-Oct-26).
4. Very small power-cable orders: not manufactured (dead stock / market). Report, do not plan.
5. "Supply from" (C&R Orders column U) = Dead stock / Old stock / Free stock → do not plan manufacture of that order. The column belongs to Deepak; never fill it.
6. Before removing a finished order: check the balance at every stage.

### 3.2 Opening balances per order (day 0)
From **Order lines** (SFG dashboard only, Grid is no longer used):
```
balance[stage]   = Balance (col M) of the order's row for that stage
stock lying at a stage = Done(stage) − Done(next stage) × (cores, if units change)
   conductor stock  = Done(conductor) − Done(insulation)            (core km)
   insulated stock  = Done(insulation) − Done(laying) × cores       (core km, per full / half core)
   laid stock       = Done(laying) − Done(inner)                    (cable km)
   inner stock      = Done(inner) − Done(armouring)
   armoured stock   = Done(armouring) − Done(outer)
```
Write the time the balances were read on the cover ("Balances: SFG dashboard <date time>").

### 3.3 Machine rules (Deepak's decisions)

| Machine | Makes | Daily rate used in the plan | Shifts | Limits / rules |
|---|---|---|---|---|
| WD14 | Drawn Al wire for skip and multistrand machines | runs on every day any conductor machine runs | Day only | No order-wise jobs |
| WD17 | Drawn Al wire for ACSR Raccoon | runs on every Skip 10 day; about 5.0 t rod/day | Day only | No order-wise jobs |
| Skip (12+7)-1 | 19-wire conductor 70 and 95 sq mm | **10 core km/day** | D+N on work days | 70 sq mm left over runs first |
| Skip (12+7)-2 | 50 sq mm conductor | **11 core km/day** | D+N | Only as far ahead as Extruder 35 needs |
| Skip 8 | 25, 35, 16 sq mm conductor | **25 core km/day** | D+N | Raccoon here only when the yard gives 19 drums/day; otherwise line "WAITING FOR DRUMS" (status `wait`) |
| Skip 10 | ACSR Raccoon | **23 km/day = 10 drums/day** (2.5 km/drum) | D+N | Wound on FG drums: drums must be ready the day before. **Never 19-wire conductor on Skip 10** |
| Skip 11 | Covered conductor 120 sq mm, first pass | **31.9 km/day** | D+N | Released when HT insulation still to do ≤ 27 core km; first-pass stock ≤ 30 km |
| MS-14 | Power cable conductor 150–300 sq mm | **12.6 core km/day** | D+N | Starts only when earlier lots are nearly laid |
| MS-11 | All Sioplas 4 feed ≥ 300 sq mm | **12 core km/day** | D+N | HT conductor stock ≤ 27 core km (≈ 3 days of Sioplas 4) |
| MS-18 | Covered conductor final pass | **14.1 km/day** | D+N | Feed = Skip 11 output; stock ≤ 46 km |
| Laying 5 | All laying (Laying 7 off) | **300 sq mm (big): 3 km/day · other sizes: 7 km/day** | D+N | Laid + inner-sheathed WIP ≤ 22 km; needs all cores in stock |
| Armouring 5 | All armouring | **7 km/day big · 10 km/day small** | D+N | Feed = inner-sheathed cable made **the day before**; one strip size per campaign; a size change is marked "strip change" |
| Extruder 22 | XLPE insulation 300, 150, 95, 25 sq mm | **16 core km/day (big), 24 (medium 95), 30 (small)** | D+N | **≤ 3.5 t XLPE / 5.5 t PVC per day**; insulated stock (big) ≤ 26 core km and ≤ 4 × cores per order; < 1 day ahead of laying |
| Extruder 35 | All insulation up to 70 sq mm (16, 35, 50, 70) | **12 core km/day** | D+N | **≤ 2.5 t XLPE / 3.5 t PVC per day**; small insulated stock ≤ 44 core km and ≤ 9 × cores per order; XLPE and PVC in long batches |
| Extruder 51 | Nothing (MD 17-Nov) | – | at rest | Jobs it could take are marked on the Extruder 52 card: orders 265, 295, 278, 208, 192, 209 → "Extruder 51 could take this – plant to decide" |
| Extruder 52 | All inner and outer sheath | **inner: 9 km/day big, 12 small · outer: 8 km/day big, 13 small** (≈ 10 km/day) | D+N | **≤ 5.5 t HDPE / 7 t PVC per day**. **Bottleneck machine** (red / "Slowest step") |
| Sioplas 4 | HT core 300 sq mm, then covered conductor 120 sq mm | **HT: 9 core km/day · CC: 23 km/day** | D+N | HT first. Feed = MS-11 (HT), MS-18 (CC) |

Conductor machine selection (13-Nov rule): Sioplas ≥ 300 sq mm → MS-11; < 300 → MS-14. Power cable 150–300 → MS-14; > 300 → MS-11. Covered conductor 100 sq mm → MS-18 only; > 100 → Skip 11 then MS-18. Half core 150 → MS-14; 25/35/70 (7-strand) → Skip 10 preferred. 19-wire → never Skip 10 ("to confirm" machine). 16, 50, 95 sq mm → "to confirm". Skip (12+7) not for 7-strand.

### 3.4 Daily simulation (for each day d = 0 … until all done, horizon 70 days)
Run the stages **in this order every day**. Each machine has 1.0 day of time; a job uses q / rate of it.

1. **Conductor (cable)**, orders in lot order (lowest Run Order first), items of an order with the least stock first:
   - skip the order if more than 40 cable km of laying lies ahead of it in earlier lots
   - room = min(feed limit of its insulation line − feed stock, cores × (6 big / 9 small) − own conductor stock)
   - feed limits: Extruder 22 big 32, medium 45; Extruder 35 small 30 core km
   - **q = min(balance, time left × rate, room)**; skip if q < 0.05
   - Raw material = q × kg Al per core km (from Material per item, Aluminium rod line)
2. **ACSR Raccoon** on Skip 10: q = min(balance, time left × 23). Drums = ceil(q / 2.5). Feed status `ok` while drums are in stock (first 3 days), then `drum` with text "DRUMS: needs n drums of 48×20×28×2.25 RDSO from the yard that day – run only if assembled the day before". Raw material: Al rod q × 216 kg, steel wire 4.09 mm q × 103 kg.
3. **HT conductor** on MS-11: q = min(balance, time × 12, 27 − HT conductor stock). Al rod q × 810.8 kg.
4. **Covered conductor**: only when HT insulation left ≤ 27 core km. Skip 11 q = min(bal, time × 31.9, 30 − first-pass stock). MS-18 q = min(bal, time × 14.1, first-pass stock of that order, 46 − final-pass stock).
5. **Sioplas 4**: HT orders first: q = min(balance, time × 9, conductor stock). Raw material: HT XLPE Sioplas q × 269 kg, Semicon Sioplas q × 108.5 kg. Then covered conductor q = min(bal, time × 23, final-pass stock).
6. **Insulation** Extruder 22 and Extruder 35: orders in lot order; eligible = min(balance, conductor stock) and only if ≤ 28 cable km of laying lies ahead. **Compound campaign rule:** keep the current compound while it has ≥ 0.5 day of work; switch to the compound of the earliest lot only if the current has less, or an earlier lot has waited ≥ 4 days. q = min(eligible, time × rate, stock cap, (tonnage limit − tonnage used) / kg per core km). Raw material = "LT XLPE q × kg" (or "PVC compound – BOM to add" when kg is not in the BOM).
7. **Laying 5**: orders in lot order. can = min over cores (insulated stock / cores). q = min(balance, can, remaining daily limit for its class (3 big / 7 small), 22 − laid+inner WIP).
8. **Sheathing Extruder 52** (campaign rule: keep compound while ≥ 0.6 day of work, max wait 4 days; inner sheath gets priority when inner stock < 6 km):
   - a) inner sheath until inner stock reaches 9 km (keeps armouring fed one day)
   - b) outer sheath of everything armoured
   - c) more inner sheath up to 16 km inner stock
   - Raw material: inner "RP PVC black 1.45 q × kg" or "HDPE compound (B) q × kg"; outer "PVC compound q × kg" / "HDPE compound (B)". kg per km from Material per item.
9. **Armouring 5**: candidates = orders with inner-sheathed stock (made before today). Strip campaign rule (keep strip size while ≥ 0.4 day work, max wait 5 days). q = min(inner stock, time × (7 big / 10 small)). Raw material "Steel strip <size> q × kg per km" (armour size and kg from Material per item – ERP BOM, never from Club & Run). Job text "Strip 4×0.80" and " – strip change" on the first day of a new size.
10. Add today's production to stock **after** all stages run (so the next stage can use it tomorrow; same-day use is not allowed except where stated).

### 3.5 Feed text and stage-feed check (mandatory)
For every job line:
```
if opening stock > 0 and everything used so far came from it →  "<what>: ready in stock (<opening stock>)"
else  →  "<what>: from <machine> on <date range of the previous-stage production used>"
```
`<what>` = conductor / insulated core (full core / half core) / laid cable / inner-sheathed cable / armoured cable / first-pass conductor.

Check: cumulative planned qty of a stage ≤ previous-stage stock + previous-stage plan up to the day before. Order by order, never on a clubbed total. A job that needs same-day feed is marked **"same day – no margin"**. A job with no feed must be moved, given a previous-stage job, or listed "cannot be planned – feed missing". Feed only at Poly Park counts only after Deepak agrees.

Cover line: "Job lines checked n · Feed ready a day ahead or in stock n · Feed missing n · Need drums from the yard n".

### 3.6 Card plan tab = output of the simulation
One row per job line with qty > 0 (plus `wait` lines with qty 0), for dates day 0 … day 14:

| Column | Filled with |
|---|---|
| Date | D0 + day |
| Process | Wire drawing / Skip strander / Multistrand / Laying / Armouring / Extruder / Sioplas |
| Machine | machine name as in 3.3 |
| Production order, MC, Party · cable, Lot | from Order lines / C&R Orders (party · cores × size, conductor, armour, insulation) |
| Plan qty, Unit | q, rounded to 2 decimals; core km or km |
| Size / core | e.g. "300 sq mm – FULL core", "150 sq mm – HALF core", "INNER sheath", "OUTER sheath" |
| Raw material to consume | text from 3.4 |
| Feed from previous process | text from 3.5 |
| Feed status | ok / drum / wait |
| Job | Conductor, XLPE, PVC, HDPE, Laying, Strip 4×0.80 (– strip change), ACSR Raccoon, HT conductor, HT insulation, Covered conductor – first / final pass, Covered conductor insulation |

---

## 4. CARD 1 – KGP Machine Production Cards

**Source:** Card plan tab (+ Men per shift).
**Pages:** 1 cover page, then **one page per machine** in this fixed order:
`WD14, WD17, Skip (12+7)-1, Skip (12+7)-2, Skip 8, Skip 10, Skip 11, MS-14, MS-11, MS-18, Laying 5, Armouring 5, Extruder 22, Extruder 35, Extruder 51, Extruder 52, Sioplas 4`
(Wire drawing → skip → multistrand → laying → armouring → extruders and Sioplas.) Machines with no work keep their page.

### 4.1 Cover page
**Facts table:**

| Label | Value / formula |
|---|---|
| Card period | `<D0> to <D0+14> 2026 (15 days)` |
| Data | which plan / balance time, e.g. "Plan data of the 17-Nov-26 / Rev 2 cards" |
| Machines | `17, one card each, in process order` |
| Job lines checked | count of Card plan rows with Plan qty > 0 |
| Feed ready a day ahead or in stock | job lines − drum lines |
| Feed missing | count of lines with no feed (must be 0) |
| Need drums from the yard | count of Skip 10 lines with Feed status = `drum` (orange) |
| Men on each machine | "See the Labour Allocation Card" |

**Right side:** colour legend (green working day, yellow off day, grey outside, orange = needs attention).
**Table "All machines at a glance":** Machine · Group · Working days (`n of 15`) · Planned in this period · Load · Men per shift. Load other than "Normal" is orange.

### 4.2 Machine page – facts table

| Label | Value / formula |
|---|---|
| Machine group | WD14/WD17 → Wire drawing; Skip* → Skip strander; MS* → Multistrand; Laying 5 → Laying; Armouring 5 → Armouring; Sioplas* → Sioplas; rest → Extruder |
| Makes | fixed text per machine (column "Makes" of 3.3) |
| Runs | "Day shift only" (WD), "Day and night" (laying, armouring, extruders, Sioplas), "Day and night on the days it has work" (skip / multistrand), "At rest" (Ext 51) |
| Daily speed / limit | from 3.3 (only if known) |
| Feed comes from | previous machine(s), from 3.3 |
| Men needed | `<Men per shift> in each shift · names are on the Labour Allocation Card` (0 → "None in this period") |
| Card period | `<D0> to <D0+14> 2026 (15 days)` |
| Planned in this period | **Σ Plan qty grouped by unit** (e.g. "68.3 core km + 21.5 km") **on n of 15 days** |
| Load | see 4.3 |
| Note | fixed machine note from 3.3 (e.g. "Kept at most 3 days ahead of Sioplas 4") |

**Working days** = set of dates with Plan qty > 0 on that machine. Exceptions: WD14 = union of working days of Skip (12+7)-1, Skip (12+7)-2, Skip 8, MS-14, MS-11, Skip 11, MS-18. WD17 = working days of Skip 10.

### 4.3 Load rule
```
if machine = bottleneck (Extruder 52)  → "Slowest step – this machine decides the finish date"   (orange)
elif working days = 0                   → "No work in this period – the labour can be utilized for some other purposes" (orange)
elif working days ≤ 3                   → "Low – works only n of 15 days. On the other days the labour can be utilized for some other purposes" (orange)
else                                    → "Normal"
```

### 4.4 Machine page – calendar "Work days in this card"
For each date in the window:
- **Green** if the date is a working day. Big number = Σ Plan qty that day (1 decimal), or "runs" for WD machines.
- **White dot ●** after the day number if the size or material changes that day: Job text contains "change", or the first part of Job (before " – ") differs from the previous job line.
- **Yellow** if not a working day, with "off". If the machine has a `wait` line that day: "waiting for drums".
- Grey outside the window.

Legend: "Working day. Big number = <units> planned that day" · "White dot = size or material changes that day" (only if a dot exists) · "Off day (no work)" · "Day outside this card".

### 4.5 Machine page – table "Jobs, day by day"
One row = one Card plan row of that machine, in date then plan order. Date shown only on the first row of a date; a thicker blue line starts each new date.

| Column (width) | Content |
|---|---|
| Date (6 %) | `d Mon` on the first row of the date |
| Production order (10 %) | Production order; MC below in small grey |
| Customer · cable (19 %) | Party · cable; Job below in small grey ("strip change" in orange; on Extruder 52 for orders 265/295/278/208/192/209 add "Extruder 51 could take this – plant to decide" in orange) |
| Core (9 %) | Size / core, or "–" |
| Lot (6 %) | Lot |
| Planned qty (9 %, right) | `q unit` (2 decimals) or "–" for qty 0 |
| Material to be used (17 %) | Raw material to consume, or "–" |
| Feed – where it comes from (24 %) | Feed text. Status `drum` → main text plus orange line "Drums: …". Status `wait` → whole text in orange |

Box above the table: "How to read the table: one line = one job for one day …". Machines with working days but no job rows (WD14, WD17): "This machine has no order-wise job list. It runs on the n green days to supply wire to the machines named above."

---

## 5. STEP 2 – Labour allocation (feeds Card 2, tabs *Labour allocation* and *Spare men*)

### 5.1 Inputs
- **Who is on duty:** Roster tab, date column → `D…` = Day, `N…` = Night, `OFF`/blank = off. Shifts and weekly offs are **never changed** by Claude.
- **Who can run what:** Skill tab (home machine per emp code, operator / helper, machine type). Card section of a person = Roster "Machine type": Wire Drawing → WD, Multi Strand → MST, Skip → SKIP, Sioplas → SIO, Extruder → EXT, Laying → LAY, Armouring → ARM.
- **Second skill:** MST↔SKIP, SIO↔EXT, LAY→ARM.
- **Men needed per shift (Men per shift tab):** WD14 2 · WD17 1 · Skip (12+7)-1 2 · Skip (12+7)-2 2 · Skip 8 2 · Skip 10 2 · Skip 11 2 · MS-14 3 · MS-11 4 · MS-18 2 · Laying 5 2 · Armouring 5 3 · Extruder 22 4 · Extruder 35 3 · Extruder 52 4 · Sioplas 4 7.
- **Machine working days:** from Card plan (4.2). WD machines: no night shift.

### 5.2 Filling order (each date, Day then Night)
Machines are filled in priority order (most important first):
`Extruder 52, Armouring 5, Laying 5, Sioplas 4, Extruder 22, Extruder 35, MS-11, MS-14, MS-18, Skip 10, Skip (12+7)-1, Skip 8, Skip (12+7)-2, Skip 11, WD14, WD17`

**Operator choice – score each available person, take the highest (ties: name A–Z):**

| Condition | Score |
|---|---|
| Home machine (Skill) = this machine | 10 + 6 |
| Operator of the same machine type | 10 |
| Skilled helper acting as operator for this type | 6 |
| Operator of the second-skill type | 3 |
| anyone else | not allowed |
| Main machine (Roster) = this machine | +4 |
| Same man was on this machine in the same shift the day before | +5 |
| His own home machine also runs this shift and still has no operator | −8 |

If nobody scores > 0: **no operator** → "No experienced operator – plant to name".

**Note on the operator (column Note):**
- home machine → blank
- other machine type → "<type> operator – to confirm" (orange on the card)
- skilled helper acting → "skilled helper acting as operator – to confirm"
- same type, other machine → "same machine type, home <machine>" (grey "his usual machine: …")

**Helpers – rank, lowest first (ties: name A–Z), until Men given = Men needed:**
0 same team as the operator · 1 main machine = this machine · 2 same type, pool · 3 same type · 5 second-skill type · 7 pool · 8 others. Operators are not used as helpers.

**Men given** = (1 if operator) + helpers. **Short** = Men needed − Men given.
**Spare men** = everyone on duty in that shift not placed on a machine; "(op)" added after operators.

### 5.3 Output rows
- Labour allocation tab: one row per machine per working shift (5.1/1.2 columns).
- Spare men tab: one row per date per shift.
- Short list: (date, shift, machine, "no experienced operator" or blank, men short).

---

## 6. CARD 2 – KGP Labour Allocation Card

**Source:** Labour allocation + Spare men tabs. **Pages:** page 1 = summary + "Needs action"; then **one page per date** (14 pages).

### 6.1 Page 1 facts table

| Label | Formula |
|---|---|
| Card period | `<D0 day> to <D0+13 day> Nov 2026 (14 days)` |
| Follows | Machine Production Cards version used |
| Shifts and weekly offs | "Taken from the roster, not changed here" |
| Machine-shifts to fill | count of Labour allocation rows |
| With an operator | rows with Operator not blank, `n of total` |
| With the full team | rows with operator and Men given ≥ Men needed |
| Lines needing action | count of rows in the Needs action table |

### 6.2 Calendar "Men named, day by day"
For each date: need = Σ Men needed (day + night), got = Σ Men given. Cell text: big **got** + small "of need".
**Green** if got ≥ need and no shift that day is short or without operator; **orange** otherwise. Grey outside. Legend: "Numbers = men named of men needed that day (day + night shift)".

### 6.3 Table "Needs action"
Columns: Date (`Ddd d Mon`) · Shift · Machine · Problem (orange) · What to do. Sorted by date, shift (Day first), machine order. Rows:
- no operator → "No experienced operator for this machine" → "Plant to name an operator"
- men short n → "n man short" → "Plant to give n more man"
- operator note contains "to confirm" → "<name> (<type>) is not the usual operator of this machine" → "Plant to confirm he can run it"

### 6.4 Daily page (one per date)
Title: `Weekday d Month`. Table:

| Machine | Day shift: Men · Operator · Helpers | Night shift: Men · Operator · Helpers |
|---|---|---|
| machine name (bold) | `got of need` (orange cell if short or no operator) · operator in bold + note line · helpers comma list or "–" | same; "not running in this shift" (grey, 3 columns merged) if no row |

Only machines with at least one shift that day are listed. Then the box **"No job on the production card today: <machines>. The labour of these machines can be utilized for some other purposes."** Then the table **"Men without a machine today – can be utilized for some other purposes"**: Shift · Men (count) · Operators (names with "(op)", shown without it) · Helpers.

---

## 7. STEP 3 – Finished-goods drum need (feeds Cards 3, 4 and tabs *FG drum need*, *Drum assembly*)

### 7.1 Inputs
- **Outer-sheath plan:** Card plan rows of Extruder 52 with Size / core = "OUTER sheath" and qty > 0 (date and km per order).
- **Raccoon plan:** Card plan rows of Skip 10 for ACSR Raccoon (P726Y-00263, lot PL-019).
- **Drum size and packing length per order** (from Drum Stock tab / Raw Materials Requirement sheet, contract-wise). Packing length L (km per drum): cable 0.5 km (500 m); CESC 272 = 0.25 km (250 m); Raccoon 2.5 km; G.R. 235 steel drum 0.5 km. Current mapping:

| Order | Drum size | L (km) | Note |
|---|---|---|---|
| 267, 268 Adani 3.5C×300 | 84×35×38×3 + extra segment | 0.5 | |
| 294 Adani 3.5C×300 | 84×35×38×3 + seg | 0.5 | same item as 267/268 – to confirm |
| 272 CESC 3.5C×240 | 60×30×32×3 (250 m packing) | 0.25 | |
| 257 Laser 3.5C×240 | 76×40×36×3 (last drum 70×35×38×3) | 0.5 | 10 drums on 76″ + 1 on 70″ (12-Nov decision) |
| 265 Adani 4C×25 | 43×15×28×2.25 | 0.5 | |
| 295 Adani 4C×25 | 43×15×28×2.25 | 0.5 | same item as 265 – to confirm |
| 266 Adani 4C×50 | 48×20×28×2.25 RDSO | 0.5 | |
| 296 Adani 4C×50 | 48×20×28×2.25 RDSO | 0.5 | same item as 266 – to confirm |
| 236 SE Railway 4C×70 | 54×24×32×3 | 0.5 | |
| 192 T&T 2C×16 | 36×14×23×2 | 0.5 | |
| 263 Raccoon | 48×20×28×2.25 RDSO | 2.5 | conductor-only item |
| any other order | **SIZE TO CONFIRM** | 0.5 | "contract drum size to be given by the plant / Raw Materials Requirement sheet" |

- **Drum stock per size** (Drum Stock tab "Current stock") and **flange stock at Kharagpur** per size (Drum Stock flange columns). Values used in the 17-Nov Rev 2 build: 84″ 5 drums / 0 flanges (2 at Poly Park) · 76″ 2 / 43 · 70″ 0 / 0 · 60″ 8 / 330 · 43″ 37 / 230 · 48″ 31 / 711 · 54″ 1 / 127 · 36″ 0 / 2 (1,080 at Poly Park).

### 7.2 Drum count formula (per order)
```
cable order:  go through its outer-sheath days in date order
   cum += km that day
   drums today = (ceil(cum / L) on the LAST outer day, else round(cum / L, half-up)) − drums counted so far
Raccoon:      cum += km that day on Skip 10;  drums today = ceil(cum / 2.5) − drums counted so far
```
Order 257: the last drum of the order is moved to 70×35×38×3 ("the one 70″ drum decided on 12-Nov").
Rows with 0 drums are dropped.

### 7.3 Ready-by date
```
cable:   ready by = outer-sheath date − 4 days      (LEAD = 4)
Raccoon: ready by = Skip 10 run date − 1 day        (drum goes on the machine)
```
Ready by before day 0 = **LATE** (needed now).

### 7.4 Stock first
Sort all rows by (ready-by date, size, use date). For each row:
```
from stock  = min(stock left of that size, drums needed);  stock left −= from stock
to assemble = drums needed − from stock
```
Only rows with ready-by < day 15 are on the cards.

### 7.5 Flange check (Card 4)
Rows with to assemble > 0, assemble date = max(ready-by, day 0) ("LATE – make first" if ready-by < 0), sorted by (assemble date, ready-by, size).
```
flanges needed = 2 × drums to assemble
held up = size unknown OR flanges left at Kharagpur of that size < flanges needed
flanges left −= flanges needed (not below 0), in date order
Flanges from = "Kharagpur stock" if not held up, else:
   84″ "No flanges – to be bought" · 70″ "No flanges – buy 2, or use a complete 70″ drum" ·
   36″ "Poly Park (only 2 at Kharagpur)" · unknown "Size not known" · other "Not enough at Kharagpur"
```

---

## 8. CARD 3 – KGP Finished Goods Drum Requirement Card

**Source:** FG drum need tab. **Pages:** page 1 = header, Needs action, size-wise totals; next pages = date-wise table.

### 8.1 Facts table

| Label | Formula |
|---|---|
| Card period | `Drums to be ready from <D0> Nov to <D0+14> Dec 2026` |
| Follows | Machine Production Cards version used |
| Cable drums | "Ready 4 days before the outer sheath date" |
| ACSR Raccoon drums | "On the machine the day before it runs" |
| Drums needed | Σ Drums needed |
| In stock | Σ From stock |
| To be made | Σ To assemble `(needs 2× flanges)` |
| How to make them | "See the Drum Assembly Card" |

### 8.2 Calendar "Drums to be ready, day by day"
For each date (ready-by ≥ day 0 only): n = Σ drums needed, a = Σ to assemble.
- n = 0 → **yellow** "no drums"
- a = 0 → **green**, big n, "all in stock"
- a > 0 → **orange**, big n, "<a> to make"

Legend line in orange: "Already late (needed before <D0>): <Σ drums of late rows> drums, <Σ to assemble of late rows> of them still to be made".

### 8.3 Table "Needs action" (Drum size · Problem · What to do)
1. Late rows with drums to make, per size: "<n> drums should already be ready (needed before <D0>) and are not in stock" → "Drum team to assemble these first".
2. Per size where to-make × 2 > flanges at Kharagpur: "<n> drums to be made need <2n> flanges. Kharagpur has only <f>" → 84″ "Buy 84″ flanges, or decide another drum size" · 70″ "Buy 2 flanges, or use a complete 70″ drum from the yard" · 36″ "Shift flanges from Poly Park (1,080 there)" · other "Arrange flanges".
3. Size unknown: "<n> drums for <k> orders have no drum size: <PO party, …>" → "Plant to give the drum size for each order".

### 8.4 Table "Size by size: needed, in stock, to be made"
Drum size · Drums needed · In stock · To be made (orange cell if > 0) · Flanges needed (= 2 × to be made) · Flanges at Kharagpur (orange if less than needed; "–" for unknown size). Last row **Total**.

### 8.5 Table "Date by date: which drums must be ready when"
Ready by ("Late – needed now" in orange for late group, then `d Mon`; shown on the first row of each date) · Drum size ("Size not known" in orange) · Drums needed · From stock · To be made (orange if > 0) · For which order (party · cable; PO · lot below) · Drum is used on ("Outer sheath, d Mon" or "Skip 10, d Mon") · Remark (Raccoon: "Bare conductor – wound straight on this drum"; unknown size: "Plant to give the drum size"; else the order note).

---

## 9. CARD 4 – KGP Drum Assembly Card

**Source:** Drum assembly tab (rows with to assemble > 0). **Pages:** page 1 = header + "Cannot be made yet"; next pages = day-by-day table.

### 9.1 Facts table

| Label | Formula |
|---|---|
| Card period | `Drums to be made from <D0> Nov to <D0+14> Dec 2026` |
| Follows | "Finished Goods Drum Requirement Card, same version" |
| For | "The drum assembly team" |
| Drums to be made | Σ drums to make `(needs 2× flanges)` |
| Can be made now | total − held up |
| Held up | Σ held-up drums (orange) – see table |
| Already late | Σ drums with ready-by < day 0 (orange) – "make these first, listed under <D0>" |
| Not listed here | "Drums already in stock" |
| Every day | "Write the number made in the “Done” column" |

### 9.2 Calendar "Drums to be made, day by day"
Per assemble date: n = Σ drums to make, b = Σ held up.
- n = 0 → **yellow** "none"
- b = 0 → **green**, big n, "all ok"
- b > 0 → **orange**, big n, "<b> held up"

### 9.3 Table "Cannot be made yet" (Drum size · Drums · Problem · What to do)
One row per size with held-up drums:
- 84″: "No 84″ flanges at Kharagpur" → "Buy 84″ flanges, or decide another drum size"
- 70″: "No 70″ flanges at Kharagpur" → "Buy 2 flanges, or use a complete 70″ drum from the yard"
- 36″: "Only 2 flanges at Kharagpur" → "Shift flanges from Poly Park (1,080 there)"
- unknown: "Drum size not given for the order" → "Plant to give the drum size for each order"
- other: "Not enough flanges at Kharagpur" → "Arrange flanges"

### 9.4 Table "Day by day: which drums to make"
Make by (`d Mon` + small "<n> drums" on the first row of the date) · Drum size ("Late – make first" in orange under the size if late) · Drums to make · Flanges needed (2×) · Flanges from (7.5; orange if held up) · For which order (party · cable; PO · lot below) · Drum is used on (Outer sheath / Skip 10, date) · **Done – write number made** (blank, plant fills). Last row **Total** (drums, flanges).

---

## 10. Issue checklist (every revision)

1. Read balances: Order lines (time stamp in README B2). Check C&R Lots / Orders for approved lots and Supply from.
2. Run STEP 1 → write **Card plan** tab.
3. Run STEP 2 → write **Labour allocation** and **Spare men** tabs.
4. Run STEP 3 → write **FG drum need** and **Drum assembly** tabs.
5. Build the 4 HTML cards from these tabs with the next Rev number; print PDFs.
6. Checks before showing: stage-feed check (0 lines without feed) · bottleneck named · finish dates · material shortages vs RM stock · drum and flange shortages · "to confirm" list · labour wording.
7. Show Deepak first. Mail the plant only when he says "issue" / "send" (daily card time 11:00 IST).
8. After issue: the tabs stay as issued until the next revision (Version column shows which).

## 11. Constants still kept in Claude's scripts (move to sheets later)

| Constant | Where it should come from |
|---|---|
| Machine rates (3.3), tonnage limits, stock caps | Machine routing tab (one machine-speed table – open decision) |
| Men per shift per machine | Men per shift tab (fill the blanks – open decision) |
| Home machine per emp code, acting skilled helpers | Skill tab |
| Drum size and packing length per order | Drum stock tab / Raw Materials Requirement sheet (order → contract mapping – open decision) |
| Drum and flange stock | Drum stock tab (to be updated daily by the plant – open decision) |
| kg per km of each material | Material per item tab |

---
*Sources: card builders card1_new.py / cards1_all.py, card2_new.py, card3_new.py, card4_new.py; planner plan.py; labour alloc.py; drums drums.py (17-Nov-26 Rev 2 plan, new layout 18-Nov-26). Project rules: decisions/kgp-stage-feed-check.md, decisions/kgp-conductor-machine-selection.md, claude/kgp-card-auto-issue-runbook.md.*

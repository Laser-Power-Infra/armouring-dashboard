# KGP Production Cards – Developer Spec · Card 1 (Machine Production Cards)

**Version:** 20-Nov-26 v2 (dry run, Card 1 only) · **Owner:** Deepak Goel (CMD)
**Based on:** the approved build spec `KGP_4_Cards_Build_Spec.md` (19-Nov-26 Rev 2) and the approved HTML template `Machine_Production_Cards_New_Layout.html` (18-Nov-26), plus the fixes found in the 20-Nov test.
**Rule:** developers read **only the Google Sheets in Section 1**. Claude keeps sheet S8 filled from the SFG dashboard.
**Marker:** ⚠ = data or decision still missing; the code must show it on the card as "to confirm", never guess.

---

## 1. Source of truth – sheets

| Ref | Sheet | Spreadsheet ID | Tab | Header row | Data from | Filled by | Refresh |
|---|---|---|---|---|---|---|---|
| S1 | KGP Production Lots – Club & Run Together | `1fOY-x0tEh20S8jC2cHg2LkaF8N1bGAcHYGaKJNlF_30` | Lots | 1 | 2 | Deepak | any time |
| S1 | 〃 | 〃 | Orders | 1 | 2 | Deepak | any time |
| S2 | KGP Machine Routing | `1OxvdZo9Uv-tVn5_S_6MLxF_Wzq5FBd_H6G27TGvpsrQ` | Machines | 1 | 2 | Planning | rarely (see 3.3: not used for rates yet) |
| S3 | KGP RM Control – Opening Stock | `1tJ8rwKBSIft0E2_kZWDT1Be-i0Q3NBlW2N29Y2nThb0` | Opening Stock | 1 | 2 | Stores | daily |
| S4 | KHG Machines to Run Daily | `1EiRA3GUfM0aI7Mp1IpPDqnK41L3PBWN-nvje7AK3dWg` | Machines | 6 | 7 | Plant | rarely |
| S5 | Roster (KGP-ROS-01) – **dynamic** | `1H3lPNyhw3hazXA76GKVp9GwVCKgOq8MqvsLjroVADdw` (current file) | MACHINE ROSTER (machine name) | 1 | 2 | Plant | new file each period |
| S6 | Skill | `1PpDwZ5vXyLGDsovbSlOiH3HxCYyQMy2XD5P6tQAfDYU` | Highlighted (Excel data) | 1 | 2 | HR | rarely |
| S7 | KGP Finished Goods Drum Stock & Alternative | `1AwxIYC73AGS2hLL0MEuXAdt2vhE7IWZEu5ELDTp-XBE` | Drum Stock · NOTE | 1 | 2 | Plant | daily |
| S8 | Armouring 5 – SFG Dashboard Data | `1V5YkE3ukRRib_1hlUU3xDTZuskJaYCXMPPcbqIeKPPI` | Order lines · Material per item · README | 1 | 2 | **Claude** (from SFG dashboard) | 08:58, 10:58, 14:58, 18:58 IST |

S5 must be dynamic: a new roster file comes each period; never hard-code its ID. Card 1 does not use S5 or S6 (they are for Card 2).

---

## 2. Card 1 – which worksheet, which columns

### 2.1 S1 `Lots`
| Col | Header | Used for |
|---|---|---|
| A | Run Order (1 = first) | lot sequence |
| B | Lot No | key |
| I | Approved by MD | **plan only `TRUE`** |

### 2.2 S1 `Orders`
| Col | Header | Used for |
|---|---|---|
| A | Prod. Order | key |
| B | MC No | card text |
| C | Party | card text (first word, e.g. "Adani") |
| D | Cable | card text; covered conductor / ACSR detection |
| E | Size (sq mm) | card text |
| F | Cores | card text |
| G | Armour (strip / wire size) | info only (armour size is taken from the BOM, 2.4) |
| H | Insulation | card text |
| R | Lot No | lot membership |
| S | Run Order | order inside the lot |
| U | Supply from | **skip only if it says Dead stock / Old stock / Free stock** (any case, anywhere in the text). Blank = manufacture. |

Not used: K–P (Club & Run balances – never plan from these), Q, T, V.

### 2.3 S8 `Order lines` (balances – the only source of "how much is left")
| Col | Header | Used for |
|---|---|---|
| A | Production order | key → Orders.A |
| F | FG type | big / small class: contains `BIG` → big, `SMALL` → small |
| H | Stage | CONDUCTOR, INSULATION, LAYING, INNER, ARMOURING, FINISH (= outer sheath) |
| I | SFG code | item key |
| J | SFG item | size = first number in the text (e.g. "150 SQ. MM. SHAPED CONDUCTOR" → 150); ACSR / covered conductor detection |
| K | Net order qty | share of each core item (3.2) |
| L | Done qty | opening stock (3.2) |
| M | Balance | what is left to make |
| O | Scope | `Core for Poly Park (P1)` = HT order |
| P | SFG BOM | key → Material per item.A |

Units: CONDUCTOR, INSULATION = core km; LAYING onwards = cable km.

### 2.4 S8 `Material per item` (BOM)
| Col | Header | Used for |
|---|---|---|
| A | SFG BOM | key |
| F | Material code | key → RM stock |
| G | Material | card text; armour size = text after "STEEL STRIP" / "STEEL WIRE" |
| H | Qty per unit of SFG item | **kg per km of that SFG item** (checked 20-Nov: Raccoon 215 kg Al + 103 kg steel per km) |
| I | Unit | KG |

### 2.5 S3 `Opening Stock`
C Item code (key) · D Item · L Qty used for planning (commas allowed). Used for the shortage check on page 2.

### 2.6 S4 `Machines` (header row 6)
A Machine · D Must run daily · F Men per shift (you fill) · G History. Men per shift on the card = F; if blank, the number after "Day: mostly" in G; if neither, "⚠ to confirm".

S2 is **not used for rates** in this version: its speeds differ from the rates Deepak fixed (3.3). ⚠ Open decision: one machine-speed table.

---

## 3. Database (Prisma) and how to fill it

### 3.1 Schema
```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"  url = env("DATABASE_URL") }

model SyncRun   { id Int @id @default(autoincrement())  source String  tab String  at DateTime @default(now())  rows Int  ok Boolean  s8PulledAt String? }

model Lot       { lotNo String @id  runOrder Int  approvedByMd Boolean  orders Order[] }

model Order {
  prodOrder String @id
  mcNo String?   party String?   cable String?   sizeSqmm Float?   cores Float?   insulation String?
  lotNo String?  runOrderInLot Int?   supplyFrom String?
  lot Lot? @relation(fields:[lotNo], references:[lotNo])
  lines OrderLine[]
}

model OrderLine {                      // S8 Order lines
  id Int @id @default(autoincrement())
  prodOrder String  fgType String?  stage String  sfgCode String  sfgItem String
  netQty Float  doneQty Float  balance Float  scope String?  sfgBom String?
  order Order? @relation(fields:[prodOrder], references:[prodOrder])
  @@unique([prodOrder, stage, sfgCode])
}

model BomLine   { id Int @id @default(autoincrement())  sfgBom String  lineNo Float  materialCode String  material String  kgPerKm Float  @@unique([sfgBom, lineNo]) }
model RmStock   { itemCode String @id  item String  qtyForPlanning Float }
model MachineMen{ machine String @id  menPerShift Int?  mustRunDaily Boolean }

model CardIssue { id Int @id @default(autoincrement())  version String  d0 DateTime @db.Date  s8PulledAt String  jobs CardJob[] }
model CardJob {                         // = "Card plan" tab
  id Int @id @default(autoincrement())  issueId Int  date DateTime @db.Date
  process String  machine String  prodOrder String?  mcNo String?  partyCable String?  lotNo String?
  planQty Float  unit String  sizeCore String  rawMaterial String  feedText String  feedStatus String  job String
  issue CardIssue @relation(fields:[issueId], references:[id])
}
```

### 3.2 Sync rules
| Table | Range | Skip row if | Values |
|---|---|---|---|
| Lot | S1 `Lots!A2:L` | B empty | I = `TRUE` → true |
| Order | S1 `Orders!A2:V` | A empty | numbers: `-`/blank → null; commas removed |
| OrderLine | S8 `'Order lines'!A2:P` | A empty | K, L, M numbers |
| BomLine | S8 `'Material per item'!A2:I` | A empty | H number |
| RmStock | S3 `'Opening Stock'!A2:L` | C empty | L number, blank → 0 |
| MachineMen | S4 `Machines!A7:N` | A empty | joined to card machine by the name table in 3.3 |

Replace each table whole on every sync. Before building, read S8 `README!B2`: if it says "skipped"/"FAILED" or is more than 18 h old → **do not build**.

### 3.3 Machine table (fixed – Deepak's decisions, 19-Nov Rev 2)

| Seq | Card machine | S4 name | Makes | Rate | Note on card |
|---|---|---|---|---|---|
| 1 | WD14 | Wire Drawing No 14 | Drawn aluminium wire for the skip and multistrand machines | runs every day any conductor machine runs | no job list |
| 2 | WD17 | Wire Drawing No 17 | Drawn aluminium wire for ACSR Raccoon on Skip 10 | runs every Skip 10 day | no job list |
| 3 | Skip (12+7)-1 | Skip Machine (12+7) - 1 | 19-wire conductor 70 and 95 sq mm | 10 core km/day | 70 left over runs first |
| 4 | Skip (12+7)-2 | Skip Machine (12-7) ⚠ | 50 sq mm conductor | 11 core km/day | only as far ahead as Extruder 35 needs |
| 5 | Skip 8 | Skip Machine No 8 | Cable conductor 16, 25, 35 sq mm | 25 core km/day | |
| 6 | Skip 10 | Skip Machine No 10 | ACSR Raccoon | 23 km/day (= 10 drums of 2.5 km) | wound on FG drums; never 19-wire |
| 7 | Skip 11 | Skip Machine No 11 | Covered conductor 120 sq mm, first pass | 31.9 km/day | |
| 8 | MS-14 | Multi Strand No 14 | Power cable conductor 150–300 sq mm | 12.6 core km/day | |
| 9 | MS-11 | Multi Strand No 11 | Conductor ≥ 300 sq mm for Sioplas 4, and power cable > 300 | 12 core km/day | HT conductor stock ≤ 27 core km |
| 10 | MS-18 | Multi Strand No 18 | Covered conductor 120 sq mm, final pass | 14.1 km/day | |
| 11 | Laying 5 | Laying Machine No 5 | All laying | 300 sq mm: 3 km/day · other: 7 km/day | **bottleneck** (19-Nov Rev 2) |
| 12 | Armouring 5 | Armouring No 5 | Armouring of all cables | big 7 km/day · small 10 km/day | |
| 13 | Extruder 22 | Extruder No 22 | XLPE insulation 300, 150, 95, 25 sq mm | 300/150: 16 · 95: 24 · 25: 30 core km/day; ≤ 3.5 t XLPE / 5.5 t PVC per day | |
| 14 | Extruder 35 | Extruder No 35 | All insulation 16, 35, 50, 70 sq mm | 12 core km/day; ≤ 2.5 t XLPE / 3.5 t PVC per day | |
| 15 | Extruder 51 | Extruder No 51 | Inner and outer sheath of the small cables of orders 192, 209, 234, 236, 260, 265, 266, 278, 280, 295, 296, 298, 301 | inner 12 · outer 13 km/day; ≤ 6 t PVC per day | ⚠ diameters and HDPE rate to confirm |
| 16 | Extruder 52 | Extruder No 52 | Inner and outer sheath of all other cables | inner big 9 / small 12 · outer big 8 / small 13 km/day; ≤ 7.5 t PVC / 5.5 t HDPE per day | |
| 17 | Sioplas 4 | Sioplass Line 4 | HT core, then covered conductor 120 sq mm | HT 9 core km/day · CC 23 km/day | HT first |

**Conductor machine by size** (size = first number of the CONDUCTOR SFG item): HT order (scope P1) → MS-11 · > 300 → MS-11 · 150–300 → MS-14 · 70, 95 → Skip (12+7)-1 · 50 → Skip (12+7)-2 · 16, 25, 35 → Skip 8 · ACSR Raccoon → Skip 10 · covered conductor → Skip 11 then MS-18 · **any other size (e.g. 10 sq mm) → not planned, listed "⚠ machine to confirm"**.
**Insulation machine:** HT → Sioplas 4 · covered conductor → Sioplas 4 · size ≤ 70 → Extruder 35 · else Extruder 22.
**HT orders (scope P1): only CONDUCTOR and INSULATION are made at Kharagpur.** All other stages of P1 orders are ignored.

---

## 4. STEP 1 – the plan (fills `CardJob`)

### 4.1 What is planned
1. Lots with Approved by MD = TRUE, in Run Order; orders in a lot by Orders.S.
2. Skip: party contains "ABJ"; Supply from contains dead / old / free stock; orders in no lot.
3. An approved order with no row in Order lines has no machine balance left at KGP (the SFG dashboard only lists open balances). It is skipped silently: it is NOT shown as "not planned". Example 20-Nov: 18 orders marked Done in Club & Run, Jakson 728 (only curing left), JVVNL 872/873/874 (already in production as per CMD).

### 4.2 Opening stock (day 0), per order
```
share(item)        = netQty(INSULATION item) / netQty(LAYING)      // core km of this core per cable km (3.5C: full 3, half 1)
conductor stock(i) = done(CONDUCTOR item of size s) − done(INSULATION item of size s)      (≥ 0)
insulated stock(i) = done(INSULATION item i) − done(LAYING) × share(i)                      (≥ 0)
laid stock         = done(LAYING) − done(INNER)
inner stock        = done(INNER) − done(ARMOURING)
armoured stock     = done(ARMOURING) − done(FINISH)
```
Conductor item and insulation item are matched by **size** (first number in SFG item).

### 4.3 Day simulation – for d = 0 … 69 (cards show d = 0 … 14)
Each machine has 1.0 day of time; a job of q uses q / rate. Production of the day is added to stock **after** all stages run (usable from the next day).

1. **Cable conductor** (Skip 8, Skip (12+7)-1/-2, MS-14, MS-11 for > 300): orders in lot order.
   `skip the order if laying balance of earlier lots > 40 km`
   `room = min( feedLimit(ins machine) − conductor stock waiting for that machine , cores × (6 big / 9 small) − own conductor stock )`
   feedLimit: Extruder 22 big (≥ 150) 32 · medium (95) 45 · small (25) 45; Extruder 35 30 core km.
   `q = min(balance, timeLeft × rate, room)`, skip if q < 0.05.
2. **ACSR Raccoon** on Skip 10: `q = min(balance, timeLeft × 23)`; drums = ceil(q / 2.5). Feed status `ok` on day 0–2, `drum` from day 3 (needs drums assembled the day before – Card 4).
3. **HT conductor** on MS-11: `q = min(balance, timeLeft × 12, 27 − total HT conductor stock)`.
4. **Covered conductor** – only when HT insulation still to do ≤ 27 core km:
   Skip 11 `q = min(balance, timeLeft × 31.9, 30 − first-pass stock)`; MS-18 `q = min(balance, timeLeft × 14.1, first-pass stock, 46 − final-pass stock)`.
5. **Sioplas 4**: HT orders first `q = min(balance, timeLeft × 9, conductor stock)`; then covered conductor `q = min(balance, timeLeft × 23, final-pass stock)`.
6. **Insulation** (Extruder 22, Extruder 35): orders in lot order, only if laying balance of earlier lots ≤ 28 km.
   `eligible = min(balance, conductor stock of same size)`
   caps: Extruder 22 – insulated stock (all orders) ≤ 26 core km and ≤ 4 × cores per order; Extruder 35 – ≤ 44 core km and ≤ 9 × cores per order.
   compound campaign: keep current compound while it has ≥ 0.5 day of work; else switch to the compound of the earliest lot (or of a lot that waited ≥ 4 days).
   `q = min(eligible, timeLeft × rate, cap room, (tonnage limit − kg used today) / kg per core km)`.
7. **Laying 5**: orders in lot order. `can = min over insulation items ( insulated stock(i) / share(i) )`. `q = min(balance, can, timeLeft × rate, 22 − (laid + inner stock of all orders))`.
8. **Sheathing**: Extruder 51 on its order list, Extruder 52 on all others, each:
   a) inner sheath until total inner stock = 9 km · b) outer sheath of all armoured stock · c) more inner up to 16 km.
   compound campaign: keep compound while ≥ 0.6 day work, max wait 4 days. Tonnage limit per day as 3.3.
9. **Armouring 5**: orders with inner stock (from earlier days). Strip campaign: keep armour size while ≥ 0.4 day work, max wait 5 days. `q = min(inner stock, timeLeft × (7 big / 10 small))`.
10. Add the day's production to stock.

### 4.4 Feed text (every job line)
Stock is kept as a FIFO list of pieces `(qty, machine, date)`; opening stock has machine = none.
```
if every piece used is opening stock → "<what>: ready in stock (<opening stock> <unit>)"
else                                 → "<what>: from <machine> on <first date>–<last date>"
```
`<what>` = conductor / insulated core (full core / half core) / laid cable / inner-sheathed cable / armoured cable / first-pass conductor / final-pass conductor.
Because stock is used only from earlier days, **feed missing is always 0**; the cover shows the count as a check.

### 4.5 CardJob row (= Card plan tab)
| Column | Value |
|---|---|
| date | D0 + d (d ≤ 14) |
| process | Wire drawing / Skip strander / Multistrand / Laying / Armouring / Extruder / Sioplas |
| machine | 3.3 name |
| prodOrder, mcNo, lotNo | Orders A, B, R |
| partyCable | first word of party + " · " + cores "C×" size + " Al " + strip/wire + insulation (e.g. "Adani · 3.5C×300 Al strip XLPE") |
| planQty, unit | q (2 decimals); core km or km |
| sizeCore | "300 sq mm – FULL core" / "150 sq mm – HALF core" (half = smaller size of a 3.5C cable) / "INNER sheath" / "OUTER sheath" / "–" |
| rawMaterial | for each BOM line of the SFG item: `<Material> <q × kgPerKm, 0 dp> kg`, joined by " · " |
| feedText, feedStatus | 4.4; status ok / drum |
| job | Conductor · XLPE / PVC / HDPE (from BOM compound) · Laying · Strip 4×0.80 (+ " – strip change") · ACSR Raccoon · HT conductor · HT insulation · Covered conductor – first / final pass · Covered conductor insulation · Inner sheath · Outer sheath |

---

## 5. CARD 1 – HTML (template `Machine_Production_Cards_New_Layout.html`)

A4 landscape, Roboto, CSS exactly as the template. Pages: **cover · page 2 raw material issue plan · one page per machine (3.3 order, all 17, even with no work)**.

### 5.1 Cover
Version box `VERSION DD-Mon-YY / Rev n` · "Kharagpur plant" · h1 "KGP Machine Production Cards" · facts:

| Label | Value |
|---|---|
| Card period | `<D0> to <D0+14> (15 days)` |
| Data | `Balances: SFG dashboard <README B2 time>; lots: Club & Run (<n> approved lots)` |
| Machines | 17, one card each, in process order |
| Job lines checked | count of CardJob with planQty > 0 |
| Feed ready a day ahead or in stock | job lines − drum lines |
| Feed missing | count of lines without feed (must be 0) |
| Need drums from the yard | count of Skip 10 lines with status `drum` (orange) |
| Not planned – to confirm | count + list of orders / items not planned with the reason (orange) |
| Men on each machine | See the Labour Allocation Card |

Right: colour legend. Table **All machines at a glance**: Machine · Group · Working days `n of 15` · Planned in this period (Σ planQty by unit) · Load (5.3) · Men per shift (2.6).

### 5.2 Page 2 – Raw material issue plan
Facts: period; "Quantity = planned km × ERP BOM kg per km; issue on the morning of the date". Table date × material (kg, all machines) with Total row; stock check row = RM stock L, **orange** where total > stock. Table "Which machine takes each material": material · machine (kg) list · total.

### 5.3 Machine page
Facts table: Machine group · Makes · Runs · Daily speed / limit · Feed comes from · Men needed (`n in each shift · names are on the Labour Allocation Card`) · Card period · Planned in this period (`Σ by unit on n of 15 days`) · Load · Note.
**Working days** = dates with planQty > 0; WD14 = union of working days of all conductor machines except Skip 10; WD17 = working days of Skip 10.
**Load:** Laying 5 → "Slowest step – this machine decides the finish date" (orange) · 0 days → "No work in this period – the labour can be utilized for some other purposes" (orange) · ≤ 3 days → "Low – works only n of 15 days. On the other days the labour can be utilized for some other purposes" (orange) · else "Normal".
**Calendar** (Mon–Sun, from Monday of D0's week to Sunday after D0+14): green = working day with Σ qty (1 decimal) or "runs" for WD; white dot ● if the job (part before " – ") differs from the previous job line or contains "change"; yellow "off" otherwise; grey outside the window.
**Jobs, day by day** (columns as template: Date 6 % · Production order (+ MC) 10 % · Customer · cable (+ job) 19 % · Core 9 % · Lot 6 % · Planned qty 9 % · Material to be used 17 % · Feed – where it comes from 24 %). Date only on the first row of a date. Status `drum` adds an orange line "Drums: needs n drums of 48×20×28×2.25 RDSO – run only if assembled the day before".
WD machines: box "This machine has no order-wise job list. It runs on the n green days to supply wire to the machines named above."
After the jobs table: "Raw material to issue to this machine, date by date" (date × material, Total row).

---

## 6. Open points (shown on the card as "to confirm")
| # | Point | Who |
|---|---|---|
| 1 | One machine-speed table: S2 speeds vs the fixed rates in 3.3 | Deepak |
| 2 | Conductor machine for 10 sq mm and any size not in 3.3 | Plant |
| 3 | Club & Run balances are stale for some orders (JVVNL 872/873/874 show 6 km, order 248 shows 4 km with "Done"). Order lines (S8) is the only source for balances | Club & Run owner |
| 4 | Club & Run run order: PL-019 (Laser 263) is before PL-024 (Nucon 299/300); 18-Nov instruction was Nucon first | Deepak |
| 5 | RM stock "Qty used for planning" is 0 for LT XLPE and HDPE (B) | Stores |
| 6 | Skip (12+7)-2 = "Skip Machine (12-7)" in S4? | Plant |
| 7 | Extruder 51 cable diameters and HDPE rate | Praveen |

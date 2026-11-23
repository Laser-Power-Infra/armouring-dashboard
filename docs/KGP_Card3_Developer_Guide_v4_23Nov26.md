# KGP Card 3 – Finished Goods Drum Requirement Card – Developer Guide v4 (23-Nov-26)

Replaces v1, v2 and v3.
Rule: read only the sources in section 1. Nothing is typed into code. A missing value shows on the card as "Size not known" or "to confirm".
Template: `Drum_Requirement_Card_New_Layout.html` (approved layout, 18-Nov-26). Use only its `<head>` (fonts and CSS); the body is built by section 4.

---

## 1. Sources

| Ref | Source | ID / place | Tab | Columns read (by heading) |
|---|---|---|---|---|
| C1 | Card 1 plan of the same issue | DB `CardJob` (= S8 tab `Card plan`) | – | date, machine, prodOrder, partyCable, lotNo, planQty, sizeCore, feedStatus |
| S7 | KGP Finished Goods Drum Stock & Alternative | `1AwxIYC73AGS2hLL0MEuXAdt2vhE7IWZEu5ELDTp-XBE` | `Drum Stock` (header row 1) | A Drum code · B Drum size (as per contract) · G Current stock (fill) · N Flange stock KHARAGPUR (nos) · O Flange stock POLY PARK (nos) |
| S8 | Armouring 5 – SFG Dashboard Data | `1V5YkE3ukRRib_1hlUU3xDTZuskJaYCXMPPcbqIeKPPI` | `Drum length` (header row 1) | B Drum size · D Order refs (last 3 digits of P7 order) · E Metres per drum · F Note on card ⚠ → table RaccoonDrum |
| C3 | Previous Card 3 issue | DB `FgDrumNeed` of the previous `CardIssue` | – | prodOrder, toAssemble, readyBy, late |

⚠ `Drum length` has no rows yet for orders 209, 234, 277, 279, 280, 294, 295, 296, 299, 300, and has no column F. Do not load these values from any file or code: until the plant adds the rows, these orders come out as "Size not known" (3.3).

Card 1 requirement: `CardJob` keeps **every simulated day (d = 0 … 69)**, not only d ≤ 14. Card 3 needs outer-sheath dates up to D0 + 18.

---

## 2. Schema (Prisma) – reuses the existing tables

- `RaccoonDrum` (Card 1 guide v3) is **extended** to hold the drum of every order, not only Raccoon: one new field `note`.
- `FgDrumNeed` is the table of Card 3 guide v1 (= S8 tab "FG drum need"), unchanged.
- `CardIssue` (Card 1) gets three new fields.
- `DrumSize` is the only new table: no drum-stock table existed before.

```prisma
model RaccoonDrum {               // Card 1 table – now one row per production order (cable and Raccoon)
  prodOrder  String @id
  drumSize   String               // S8 Drum length B, normalised (3.1)
  drumKm     Float                // S8 Drum length E ÷ 1000
  note       String?              // new – S8 Drum length F
}

model DrumSize {                  // new – S7 Drum Stock
  size       String @id           // B, normalised (3.1)
  drumCode   String?              // A
  stock      Int                  // G
  flangeKgp  Int?                 // N (null if not a number)
  flangePp   Int?                 // O (null if not a number)
}

model FgDrumNeed {                // as in Card 3 guide v1 (S8 tab "FG drum need")
  id          Int      @id @default(autoincrement())
  cardIssueId Int
  usedOn      String              // "Outer sheath, 22 Nov" | "Skip 8, 21 Nov"
  usedDate    DateTime @db.Date
  readyBy     DateTime @db.Date
  late        Boolean
  size        String              // RaccoonDrum.drumSize or "Size not known"
  needed      Int
  fromStock   Int
  toAssemble  Int
  prodOrder   String
  partyCable  String
  lotNo       String?
  note        String              // card remark (4.1 step 3)
  issue       CardIssue @relation(fields:[cardIssueId], references:[id])
}

// CardIssue (Card 1) – three new fields:
//   prevIssueId Int?    – the issue this one replaces
//   issueNote   String  – the text the issuer writes for this version
//   review      Boolean – true until the issue is confirmed (prints the review mark)
```

**Row order of FgDrumNeed** (used everywhere below): readyBy, then usedDate, then size, then prodOrder.

---

## 3. How to fill each field

### 3.1 Drum size text (S7 B and S8 B)
`" X "` → `"×"` · `"+ EXTRA SEGMENT"` → `"+ extra segment"` · `" - RDSO"` → `" RDSO"` · repeated spaces → one space.
Example: `84 X 35 X 38 X 3 + EXTRA SEGMENT` → `84×35×38×3 + extra segment`.

### 3.2 DrumSize
| Field | Value |
|---|---|
| size | S7 B (3.1); skip rows with B blank or B = TOTAL |
| drumCode | S7 A |
| stock | S7 G as a whole number; blank → 0 |
| flangeKgp | S7 N as a number; text (e.g. "(shared)") → null |
| flangePp | S7 O as a number; text → null |

### 3.3 RaccoonDrum
For each S8 `Drum length` row, and for each 3-digit ref in D: prodOrder = `P726Y-00` + ref, drumSize = B (3.1), drumKm = E ÷ 1000, note = F (or "").
An order not in RaccoonDrum → size `"Size not known"`, drumKm 0.5.

### 3.4 FgDrumNeed – every field is produced in 4.1.

---

## 4. Logic to build the card

### 4.1 Drum need (fills FgDrumNeed)
1. **Select plan rows** (C1, same issue):
   - cable: machine = Extruder 51 or Extruder 52 and sizeCore = `OUTER sheath`;
   - raccoon: feedStatus = `drum` (any machine – Skip 8 and Skip 10).
2. **Per order**, take its selected rows in date order. L = RaccoonDrum.drumKm.
   ```
   cum = cum + planQty
   cable:   total = ceil(cum / L) on the order's LAST outer-sheath day in the plan
            total = round(cum / L), halves up, on every other day
   raccoon: total = ceil(cum / L) every day
   needed = total − drums already counted for this order        (skip the day if needed ≤ 0)
   ```
3. **Fields:**
   | Field | Value |
   |---|---|
   | readyBy | cable: date − 4 days · raccoon: date − 1 day |
   | late | readyBy < D0 |
   | usedOn | cable: `Outer sheath, d Mon` · raccoon: `<machine>, d Mon` |
   | size | RaccoonDrum.drumSize or `Size not known` |
   | note | raccoon: `Bare conductor – wound straight on this drum` · size not known: `Plant to give the drum size` · else RaccoonDrum.note |
   | prodOrder, partyCable, lotNo | from the plan row |
4. Keep only rows with readyBy < D0 + 15.
5. **Stock first:** take the rows in the row order of section 2. Going down the list: `fromStock = min(stock left of that size, needed)`, `stock left −= fromStock`, `toAssemble = needed − fromStock`. "Size not known" has no stock.
6. Save the rows.

### 4.2 Values used on the card (all from FgDrumNeed of this issue + DrumSize)
| Name | Rule |
|---|---|
| NEEDED, INSTOCK, TOMAKE | Σ needed, Σ fromStock, Σ toAssemble |
| FLANGES | 2 × TOMAKE |
| LATE_N, LATE_A | Σ needed, Σ toAssemble of rows with late = true |
| day n, day a (each date D0 … D0+14) | Σ needed, Σ toAssemble of rows with readyBy = date and late = false |
| SIZES | the sizes in order of first appearance in the row order |
| per size: need, stock, make, flNeed, flKgp | Σ needed, Σ fromStock, Σ toAssemble, 2 × make, DrumSize.flangeKgp (null → 0; "Size not known" → "–") |
| PREV_TOMAKE | Σ toAssemble of the previous issue |

### 4.3 Building the card, part by part, top to bottom
Element names and classes are those of the template.

1. **Version box** `.ver`: CardIssue version, e.g. `VERSION 21-Nov-26 / Rev 4`.
2. **Facts table** `table.facts`, 8 rows in this order:
   Card period = `Drums to be ready from <D0 d Mon> to <D0+14 d Mon> <year>` · Follows = `Machine Production Cards <Card 1 version>` · Cable drums = `Ready 4 days before the outer sheath date` · ACSR Raccoon drums = `On the machine the day before it runs` · Drums needed = **NEEDED** · In stock = **INSTOCK** · To be made = **TOMAKE** `(needs FLANGES flanges)` · How to make them = `See the Drum Assembly Card`.
3. **Calendar** `table.cal`: rows Mon–Sun, from the Monday of D0's week to the Sunday of (D0+14)'s week. Cell date text: day number, or `1 Dec` on the 1st of a month. For each date:
   | Condition | Cell class | Big number `.cq` | Small text `.cs` |
   |---|---|---|---|
   | date < D0 or > D0+14 | `out` | none | none |
   | n = 0 | `idle` | none | `no drums` |
   | a = 0 | `work` | n | `all in stock` |
   | a > 0 | `shortd` | n | `<a> to make` |
   Under the legend, in `.sec`: `Already late (needed before <D0 d Mon>): LATE_N drums, LATE_A of them still to be made`.
4. **How-to box** `.how`: fixed text of the template.
5. **Change box** `.how` (only if prevIssueId is set): `<b><this version short> replaces <previous version short>:</b> <CardIssue.issueNote> Drums to assemble up to <D0+14 d Mon>: TOMAKE (<previous version short>: PREV_TOMAKE). The table compares with <previous version short>.` Short version = `21-Nov Rev 4`.
6. **Compare table** `table.t`, columns Order · Drum size · `<previous> – to assemble` · `<this> – to assemble`:
   - one row per prodOrder that has FgDrumNeed rows in this issue **or** the previous issue, sorted by prodOrder;
   - Order = `partyCable (last 3 digits)`; Drum size = RaccoonDrum.drumSize cut before ` +` (or `Size not known`);
   - each issue's cell, from that issue's FgDrumNeed rows of the order: `none` if Σ toAssemble = 0; else `<Σ toAssemble> drums`, then `, <first>–<last> readyBy` of the non-late rows with toAssemble > 0 (one date if both are equal), then ` (<Σ toAssemble of late rows> late)` if that is > 0.
7. **Needs action** `<h3>Needs action</h3>` + `table.t` (Drum size · Problem · What to do). Rows in this order:
   - a) for each size in SIZES with LATE rows to make (Σ toAssemble of late rows of that size = m > 0): `m drums should already be ready (needed before <D0 d Mon>) and are not in stock` · `Drum team to assemble these first`;
   - b) for each known size in SIZES with flNeed > flKgp: `make drums to be made need flNeed flanges. Kharagpur has only flKgp` · What to do, first that applies:
     size not in DrumSize → `Plant to give stock and flanges of <size>` · flangeKgp null → `Confirm <size> flanges` · first number 84 → `Buy 84″ flanges, or decide another drum size` · 70 → `Buy 2 flanges, or use a complete 70″ drum from the yard` · flangePp > 0 → `Shift <first number>″ flanges from Poly Park (<flangePp> there)` · else `Arrange flanges`;
   - c) if "Size not known" has rows: `<need> drums for <k> orders have no drum size: <prodOrder party, …>` (orders sorted, party = first word of partyCable) · `Plant to give the drum size for each order`.
   Drum size cell bold; `Size not known` and every Problem cell in `.sec`.
8. **Size by size** (inside `.keep`, so the table is not split): one row per size in SIZES: size · need · stock · make (class `badc` if > 0) · flNeed · flKgp (class `sec` if flKgp < flNeed). Last row `tr.totr`: Total · NEEDED · INSTOCK · TOMAKE · FLANGES · blank.
9. **Date by date** `table.t`: one row per FgDrumNeed row in the row order.
   - Ready by: shown only on the first row of each readyBy group, and that row gets class `dstart`; text `Late – needed now` (`.sec`) for the late group, else `d Mon`.
   - Drum size (`Size not known` in `.sec`) · needed · fromStock · toAssemble (`.sec` if > 0) · partyCable with `prodOrder · lotNo` below (`.sm`) · usedOn · note (`.sec` if it is `Plant to give the drum size`).
10. **PDF**: A4 landscape, backgrounds printed. Footer on every page: `KGP Finished Goods Drum Requirement Card · <version> · page x of y`. If CardIssue.review is true, a diagonal mark `FOR REVIEW PURPOSE ONLY` on every page.

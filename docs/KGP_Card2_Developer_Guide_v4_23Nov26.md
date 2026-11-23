# KGP Card 2 – Labour Allocation Card – Developer Guide v4 (23-Nov-26)

Replaces v1–v3.
Rule: read only the sources in section 1. Nothing is typed into code. A missing value shows on the card as "to confirm".
Template: `Labour_Allocation_Card_New_Layout.html` (approved layout, 18-Nov-26). Use only its `<head>` (fonts and CSS); the body is built by section 4.

---

## 1. Sources

| Ref | Source | ID / place | Tab (header row) | Columns read (by heading) |
|---|---|---|---|---|
| C1 | Card 1 plan of the same issue | DB `CardJob` (= S8 tab `Card plan`) | – | date, machine, planQty |
| S4 | KHG Machines to Run Daily | `1EiRA3GUfM0aI7Mp1IpPDqnK41L3PBWN-nvje7AK3dWg` | `Machines` (row 6) | A Machine · B ERP code · E Shifts per day · F Men per shift · **Fill order** ⚠ |
| S5 | Roster – the newest Google Sheet whose title contains `KGP-ROS` (search Drive by title every run; never fix the ID) | today `1H3lPNyhw3hazXA76GKVp9GwVCKgOq8MqvsLjroVADdw` (KGP-ROS-01 Rev 6) | `MACHINE ROSTER (machine name)` (row 1) | A Machine type · B Team (operator) · C Role · D Emp code · E Name · F Main machine · one column per date (`Sat 21`, `Sun 22`, …) |
| S6 | Skill sheet | `1PpDwZ5vXyLGDsovbSlOiH3HxCYyQMy2XD5P6tQAfDYU` | `Highlighted (Excel data)` (row 1) | B Emp code · F Machine (ERP cost code) · G Skill level |
| S10 | KGP Punch Blocked List | `1ztbcLWLKGBE8WLpVP7RB8ZVJBHdOjRoOqyPPFWRmIik` | `Punch Blocked` (row 3) | B Code |

⚠ Values the issued card needs that are not yet in a sheet:
- **Fill order** (the order in which machines get men). It is not in S4. The issued card used this order: Laying 5, Laying 7, Extruder 52, Armouring 5, Sioplas 4, Sioplas 3, Boiler 7, Extruder 22, Extruder 35, Extruder 51, MS-11, MS-14, MS-18, Skip 10, Skip (12+7)-1, Skip 8, Skip (12+7)-2, Skip 11, Buncher 4, WD14, WD17. Deepak to approve a "Fill order" column in S4 holding these numbers 1–21.
- **Men per shift**: S4 F is blank for WD14, Skip (12+7)-1, Buncher 4, Extruder 35 and some new machines. The issued card used WD14 2, WD17 1, every Skip and Buncher 4 2, MS-14 3, MS-11 4, MS-18 2, Laying 5 2, Laying 7 2, Armouring 5 3, Extruder 22 4, Extruder 35 3, Extruder 51 3, Extruder 52 4, Sioplas 4 7, Sioplas 3 7, Boiler 7 3. Deepak to fill S4 F.
- **Home machine and skilled helpers**: S6 F holds wrong ERP codes for some men (e.g. EX057, LA005). The plant has to correct S6.

---

## 2. Schema (Prisma) – reuses the existing tables

No new table. `MachineMen` is the Card 1 table as extended in Card 2 guide v3; `RosterPerson`, `LabourAllocation` and `SpareMen` are the tables already given in guide v3 and the 19-Nov build spec. v4 adds only two fields to `MachineMen` (marked **new**); `daysRun` is no longer used for the fill order.

```prisma
model MachineMen {                 // Card 1 table, extended in Card 2 v3
  machine    String @id
  s4Name     String                // S4 A
  erpCode    String?               // S4 B
  menNeeded  Int?                  // S4 F (null = not set)
  dayOnly    Boolean               // S4 E == 1
  daysRun    Int?                  // S4 M – kept, not used
  type       String                // 3.1
  rosterCode String                // 3.1
  fillOrder  Int?                  // new – S4 "Fill order" (⚠ section 1)
  cardSeq    Int                   // new – 3.1, order of machines on the card
}

model RosterPerson {               // as in v3
  id            Int     @id @default(autoincrement())
  syncRunId     Int
  empCode       String
  name          String
  sectionName   String
  section       String?
  team          String
  role          String
  mainCode      String
  homeMachine   String?
  skilledHelper Boolean
  leftOut       Boolean
  shifts        Json
  @@unique([syncRunId, empCode])
}

// as in v3 / 19-Nov build spec (S8 tabs "Labour allocation" and "Spare men")
model LabourAllocation { id Int @id @default(autoincrement()) cardIssueId Int date DateTime shift String machine String operator String? note String helpers String menNeeded Int menGiven Int }
model SpareMen         { id Int @id @default(autoincrement()) cardIssueId Int date DateTime shift String men String }
```

Field contents used by this guide:
- `LabourAllocation.helpers` = helper names in the order chosen (4.1 step 7), joined by ", ".
- `SpareMen.men` = names A–Z joined by ", "; a man whose role is Operator carries " (op)" after his name.

---

## 3. How to fill each field

### 3.1 MachineMen
One row per machine in the table below.

| cardSeq | machine | type | rosterCode | | cardSeq | machine | type | rosterCode |
|---|---|---|---|---|---|---|---|---|
| 1 | WD14 | WD | WD14 | | 12 | Laying 5 | LAY | LAY5 |
| 2 | WD17 | WD | WD17 | | 13 | Laying 7 | LAY | LAY7 |
| 3 | Skip (12+7)-1 | SKIP | SK12+7-1 | | 14 | Armouring 5 | ARM | ARM5 |
| 4 | Skip (12+7)-2 | SKIP | SK12-7 | | 15 | Extruder 22 | EXT | EX22 |
| 5 | Skip 8 | SKIP | SK8 | | 16 | Extruder 35 | EXT | EX35 |
| 6 | Skip 10 | SKIP | SK10 | | 17 | Extruder 51 | EXT | EX51 |
| 7 | Skip 11 | SKIP | SK11 | | 18 | Extruder 52 | EXT | EX52 |
| 8 | Buncher 4 | SKIP | BUN4 | | 19 | Sioplas 4 | SIO | SIO4 |
| 9 | MS-14 | MST | MS14 | | 20 | Sioplas 3 | SIO | SIO3 |
| 10 | MS-11 | MST | MS11 | | 21 | Boiler 7 | BLR | BLR7 |
| 11 | MS-18 | MST | MS18 | | | | | |

s4Name = the S4 A name of the machine (Card 1 machine table). erpCode, dayOnly, menNeeded and fillOrder come from that S4 row. WD14 and WD17 are dayOnly.

### 3.2 RosterPerson – section
Section from S5 A: Wire Drawing → WD · Skip → SKIP · Multi Strand → MST · Laying → LAY · Armouring → ARM · Extruder → EXT · Sioplas → SIO · Boiler / Curing → BLR. Any other value → null (not on the card).

### 3.3 RosterPerson – other fields
| Field | Value |
|---|---|
| empCode, name, sectionName, team, role, mainCode | S5 D, E, A, B, C, F. Read rows with Name filled; when an emp code is on two rows, the last row wins |
| homeMachine | the S4 row whose B (ERP code) = S6 F of the same emp code: its card machine if it is in MachineMen, else its S4 A name (null if no row matches) |
| skilledHelper | S5 C = `Helper` and S6 G = `Skilled` |
| leftOut | emp code is in S10 B |
| shifts | for each card date, the S5 cell of that date: first letter D → `D`, N → `N`, anything else (OFF, blank) → `OFF` |

### 3.4 Period and machine working days
- D0 = Card 1 D0. Last date = the earlier of D0 + 13 and the last date column of the S5 file. (21-Nov issue: 21–30 Nov, 10 days.)
- A machine works on a date when the Card plan has planQty > 0 for it on that date.
- WD14 works on every date on which any of Skip (12+7)-1, Skip (12+7)-2, Skip 10, Buncher 4, MS-14, MS-11, Skip 11 or MS-18 works.
- WD17 works on the dates Skip 8 works.

---

## 4. Logic to build the card

### 4.1 Placing men (fills LabourAllocation and SpareMen)
For each date in the period, Day shift first, then Night shift:

1. **avail** = RosterPerson rows with section not null, leftOut false and shifts[date] = this shift.
2. Take the machines in **fillOrder**, each machine **once**. Skip a machine if it does not work on the date, if it is dayOnly and this is the Night shift, or if menNeeded is null (then add the Needs action line "Men per shift not set" – 4.2).
3. **Operator score** of each man in avail (g = machine type, rc = rosterCode):

   | Base (first that applies) | Score |
   |---|---|
   | homeMachine = this machine | 10 |
   | role = Operator and section = g | 10 |
   | skilledHelper and section = g | 6 |
   | role = Operator and g is a second skill of his section (MST→SKIP, SKIP→MST, SIO→EXT, EXT→SIO, LAY→ARM, BLR→SIO) | 3 |
   | otherwise | cannot be operator |

   Then add: +6 if homeMachine = this machine · +4 if mainCode = rc · +5 if he was the operator of this machine in this shift on its previous working date · −8 if neither homeMachine nor mainCode is this machine, and a machine whose rosterCode is his homeMachine or mainCode works in this shift and has no operator yet.
4. **Operator** = highest score above 0; ties by name A–Z. None → operator null.
5. Remove the operator from avail.
6. **note** (first that applies): homeMachine = this machine → "" · section ≠ g and not skilledHelper → `<sectionName> operator – to confirm` · skilledHelper → `skilled helper acting as operator – to confirm` · neither homeMachine nor mainCode is rc → `his usual machine: <rosterCode of homeMachine, or its S4 name if it is not a card machine; if homeMachine is null, mainCode>` · otherwise "".
7. **Helpers**: men in avail who are not (role Operator and not skilledHelper), ranked: 0 same team as the operator (team ≠ "pool") · 1 mainCode = rc · 2 section = g and team = "pool" · 3 section = g · 5 g is a second skill of his section · 7 team = "pool" · 8 others. Sort by rank, then name A–Z; take menNeeded − (1 if operator else 0). Remove them from avail.
8. Save LabourAllocation: operator, note, helpers (in that order, joined by ", "), menNeeded, menGiven = (1 if operator) + number of helpers.
9. After the last machine of the shift, save one SpareMen row for the date and shift: men = every man still in avail, A–Z, " (op)" after those whose role is Operator.

### 4.2 Values used on the card
| Name | Rule |
|---|---|
| ROWS | LabourAllocation rows of the issue, sorted by date, shift (D before N), cardSeq |
| FULL(row) | operator not null and menGiven ≥ menNeeded |
| Needs action lines | for each row of ROWS, in this order: (1) operator null → `No experienced operator for this machine` · `Plant to name an operator`; (2) menGiven < menNeeded → `<n> man short` · `Plant to give <n> more man` (n = menNeeded − menGiven); (3) note contains "to confirm" → `<operator> (<sectionName> operator) is not the usual operator of this machine` or, for a skilled helper, `<operator> (skilled helper acting as operator) is not the usual operator of this machine` · `Plant to confirm he can run it`. Plus one line per machine with menNeeded null: `Men per shift not set` · `Deepak to fill KHG Machines to Run Daily` |
| day n of m | Σ menGiven of m Σ menNeeded of all rows of that date (both shifts) |
| day colour | `work` if every row of that date is FULL, else `shortd` |

### 4.3 Building the card, part by part
Element names and classes are those of the template.

1. **Version box** `.ver`: CardIssue version.
2. **Facts table** `table.facts`:
   | Label | Value |
   |---|---|
   | Card period | `<D0 day> to <last day> <Mon YYYY> (<days> days)` |
   | Follows | `Machine Production Cards <Card 1 version> (roster <S5 file version, e.g. KGP-ROS-01 Rev 6> ends <last S5 date d Mon>)` |
   | Shifts and weekly offs | `Taken from the roster, not changed here` |
   | Machine-shifts to fill | **count of ROWS** |
   | With an operator | **count with operator** `of <count of ROWS>` |
   | With the full team | **count FULL** `of <count of ROWS>` |
   | Lines needing action | **count of Needs action lines** `– see the table below` |
3. **Calendar** `table.cal`: Mon–Sun rows from the Monday of D0's week to the Sunday of the last date's week. Cell `.cd` = day number. Dates outside the period: class `out`, nothing else. Dates in the period: class = day colour, `.cq` = `<n><span class=of> of <m></span>`.
4. **How-to box** `.how`: fixed text of the template.
5. **Needs action** `table.t`: one row per line of 4.2, in that order. Date `Ddd d Mon` (`.dt`) · Shift `Day`/`Night` · Machine (bold) · Problem (`.sec`) · What to do.
6. **One page per date** `div.dayp` (page break before each), in date order:
   - `.grp` "KGP Labour Allocation Card · who is on which machine"; `h2` = `<Weekday> <d> <Month>`.
   - Table: one row per machine that has a LabourAllocation row on that date, in cardSeq order. For each shift (Day, then Night):
     - no row for that shift → one cell, colspan 3, class `nr`: `not running in this shift`;
     - Men cell `c`: `<menGiven> of <menNeeded>`; add class `badc` if the row is not FULL;
     - Operator cell: operator name in bold. Under it: if note contains "to confirm" → `div.sec` `to confirm – <the note without " – to confirm">`; else if note is not "" → `div.sm` with the note. Operator null → cell class `sec` with `No experienced operator – plant to name`;
     - Helpers cell: `helpers` as saved; empty → `–`.
   - If some MachineMen machines have no row that date: `.how` box `No job on the production card today: <those machines in cardSeq order, joined by ", ">. The labour of these machines can be utilized for some other purposes.`
   - `h3` "Men without a machine today – can be utilized for some other purposes", table Shift · Men · Operators · Helpers: one row Day, one row Night. From the SpareMen row of that date and shift: Men = number of names in `men`; Operators = the names marked " (op)" (shown without the mark); Helpers = the other names; both A–Z joined by ", "; none → `–`.
7. **PDF**: A4 landscape, backgrounds printed. Footer on every page: `KGP Labour Allocation Card · <version> · page x of y`. If CardIssue.review is true, the diagonal mark `FOR REVIEW PURPOSE ONLY` on every page.
8. **Wording**: never "free", "freed" or "idle" for men; use "can be utilized for some other purposes".

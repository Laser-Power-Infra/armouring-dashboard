# KGP Card 4 – Drum Assembly Card – Developer Guide v1 (23-Nov-26)

Rule: read only the sources in section 1. Nothing is typed into code. A missing value shows on the card as "Size not known" or "to confirm".
Template: `Drum_Requirement_Card_New_Layout.html` (the Card 3 template; Card 4 uses the same fonts, CSS and classes). Use only its `<head>`; the body is built by section 4.

---

## 1. Sources

| Ref | Source | ID / place | Tab | Fields read |
|---|---|---|---|---|
| C3 | Card 3 drum need of the same issue | DB `FgDrumNeed` (= S8 tab `FG drum need`) | – | all fields |
| S7 | KGP Finished Goods Drum Stock & Alternative | `1AwxIYC73AGS2hLL0MEuXAdt2vhE7IWZEu5ELDTp-XBE` | `Drum Stock` (header row 1) | through table `DrumSize` (Card 3 guide v3): flangeKgp (N), flangePp (O) |
| C3 | Card 3 compare table of the same issue | DB `FgDrumNeed` of this issue and of `CardIssue.prevIssueId` | – | as in Card 3 guide v3, 4.3 step 6 |

Card 4 has no source sheet of its own. It is built after Card 3, in the same issue.

---

## 2. Schema (Prisma) – reuses the existing tables

- `FgDrumNeed`, `DrumSize`, `RaccoonDrum` and `CardIssue`: as in Card 3 guide v3, unchanged.
- `DrumAssembly` = the S8 tab "Drum assembly" already defined in the 19-Nov build spec (columns Version · Assemble by · Drum size · Drums to make · Flanges needed · Flanges from · Production order · Party · cable · Lot · Drum used on). It is written as a table with the same columns, plus the link to its FgDrumNeed row and the held-up flag.

```prisma
model DrumAssembly {              // = S8 tab "Drum assembly"
  id            Int      @id @default(autoincrement())
  cardIssueId   Int                // Version
  fgDrumNeedId  Int                // the FgDrumNeed row it comes from
  assembleBy    DateTime @db.Date  // Assemble by
  late          Boolean
  drumSize      String             // Drum size
  drumsToMake   Int                // Drums to make
  flangesNeeded Int                // Flanges needed
  flangesFrom   String             // Flanges from
  heldUp        Boolean
  prodOrder     String             // Production order
  partyCable    String             // Party · cable
  lotNo         String?            // Lot
  usedOn        String             // Drum used on
  issue         CardIssue  @relation(fields:[cardIssueId], references:[id])
  need          FgDrumNeed @relation(fields:[fgDrumNeedId], references:[id])
}
```

---

## 3. How to fill each field

| Field | Value |
|---|---|
| cardIssueId, fgDrumNeedId | the issue; the FgDrumNeed row |
| assembleBy | FgDrumNeed.readyBy, or D0 if FgDrumNeed.late |
| late | FgDrumNeed.late |
| drumSize, prodOrder, partyCable, lotNo, usedOn | the same fields of FgDrumNeed |
| drumsToMake | FgDrumNeed.toAssemble |
| flangesNeeded | 2 × drumsToMake |
| flangesFrom, heldUp | 4.1 |

A DrumAssembly row is made only for FgDrumNeed rows with toAssemble > 0.

---

## 4. Logic to build the card

### 4.1 Flange check (fills flangesFrom and heldUp)
1. Take the FgDrumNeed rows with toAssemble > 0, in the FgDrumNeed row order (readyBy, usedDate, size, prodOrder). Then sort them by assembleBy; rows with the same assembleBy keep that order. The late rows come first, because their assembleBy is D0.
2. flangesLeft[size] = DrumSize.flangeKgp for every size where flangeKgp is a number.
3. Going down the rows, the first case that applies:

| Case | heldUp | flangesFrom |
|---|---|---|
| drumSize = `Size not known` | true | `Size not known` |
| drumSize not in DrumSize | true | `Not in the Drum Stock sheet` |
| DrumSize.flangeKgp is null | true | `To confirm` |
| flangesLeft ≥ flangesNeeded | false | `Kharagpur stock` |
| first number of the size = 84 | true | `No flanges – to be bought` |
| first number = 70 | true | `No flanges – buy 2, or use a complete 70″ drum` |
| first number = 36 | true | `Poly Park (only <flangeKgp> at Kharagpur)` |
| flangePp > 0 | true | `Shift from Poly Park (<flangePp> there)` |
| otherwise | true | `Not enough at Kharagpur` |

4. After each row of a size that has a number in flangesLeft: flangesLeft = max(0, flangesLeft − flangesNeeded). This applies whether the row is held up or not.
5. Save the DrumAssembly rows.

### 4.2 Values used on the card
| Name | Rule |
|---|---|
| TOMAKE | Σ drumsToMake |
| FLANGES | 2 × TOMAKE |
| HELD | Σ drumsToMake of rows with heldUp |
| NOW | TOMAKE − HELD |
| LATE | Σ drumsToMake of rows with late |
| day n, day b (each date D0 … D0+14) | Σ drumsToMake and Σ drumsToMake of heldUp rows, of the rows with that assembleBy |
| HELD_SIZES | the sizes of the heldUp rows, in order of their first heldUp row |
| per held size: drums | Σ drumsToMake of its heldUp rows |

### 4.3 Building the card, part by part, top to bottom
Element names and classes are those of the template.

1. **Version box** `.ver`: CardIssue version.
2. **Facts table** `table.facts`, 9 rows in this order:
   - Card period = `Drums to be made from <D0 d Mon> to <D0+14 d Mon> <year>`
   - Follows = `Finished Goods Drum Requirement Card, same version`
   - For = `The drum assembly team`
   - Drums to be made = **TOMAKE** `(needs FLANGES flanges)`
   - Can be made now = **NOW**
   - Held up = **HELD** `– see the table below` (`.sec`)
   - Already late = **LATE** `– make these first, listed under <D0 d Mon>` (`.sec`)
   - Not listed here = `Drums already in stock`
   - Every day = `Write the number made in the “Done” column`
3. **Calendar** `table.cal`, title `Drums to be made, day by day`. Rows run Mon–Sun, from the Monday of D0's week to the Sunday of (D0+14)'s week. Cell date text = day number, or `1 Dec` on the 1st of a month.

   | Condition | Cell class | Big number `.cq` | Small text `.cs` |
   |---|---|---|---|
   | date < D0 or > D0+14 | `out` | none | none |
   | n = 0 | `idle` | none | `none` |
   | b = 0 | `work` | n | `all ok` |
   | b > 0 | `shortd` | n | `<b> held up` |

   Legend: `Big number = drums to be made by that date`; then swatches `work` "All can be made", `shortd` "Some held up (no flanges or size not known)", `idle` "Nothing to make" and `out` "Outside this card".
4. **How-to box** `.how`: `How to read this card: this page shows the totals and what is held up. The next pages list, day by day, which drums to make. “Make by” is the date the drum must be ready. Words in this colour need attention.`
5. **Change box and compare table**: exactly as Card 3 guide v3, 4.3 steps 5 and 6. They use the same issue, so the text and rows are the same as on Card 3.
6. **Cannot be made yet**: `<h3>Cannot be made yet</h3>` and `table.t` with columns Drum size · Drums · Problem · What to do. There is one row per size in HELD_SIZES. Drum size is bold (`Size not known` in `.sec`), Drums is a number, and Problem is in `.sec`.

   | Case (first that applies) | Problem | What to do |
   |---|---|---|
   | Size not known | `Drum size not given for the order` | `Plant to give the drum size for each order` |
   | size not in DrumSize | `<size> is not in the Drum Stock sheet` | `Plant to give stock and flanges` |
   | flangeKgp null | `<size> flanges to confirm` | `Confirm flanges` |
   | first number 84 | `No 84″ flanges at Kharagpur` | `Buy 84″ flanges, or decide another drum size` |
   | first number 70 | `No 70″ flanges at Kharagpur` | `Buy 2 flanges, or use a complete 70″ drum from the yard` |
   | first number 36 | `Only <flangeKgp> flanges at Kharagpur` | `Shift flanges from Poly Park (<flangePp> there)` |
   | other | `Kharagpur <n>″ flanges (<flangeKgp>) not enough for <first word of partyCable of every DrumAssembly row of this size, without repeats, in row order, joined by ", " and " and " before the last>` | `Shift <n>″ flanges from Poly Park (<flangePp> there)`, or `Arrange flanges` if flangePp is 0 or null |

7. **Day by day**: `<h3>Day by day: which drums to make</h3>` and `table.t` with columns Make by · Drum size · Drums to make · Flanges needed · Flanges from · For which order (`order number and lot below`) · Drum is used on · Done (`write number made`). There is one row per DrumAssembly row, in the order of 4.1 step 1.
   - Make by: shown only on the first row of each assembleBy date, and that row gets class `dstart`. The text is `d Mon` (`.dt`), with `.sm` `<Σ drumsToMake of that date> drums` under it.
   - Drum size: `Size not known` in `.sec`. If late, add `Late – make first` in `.sec` under the size.
   - Drums to make and Flanges needed: numbers.
   - Flanges from: in `.sec` if heldUp.
   - For which order: partyCable, with `prodOrder · lotNo` (`.sm`) under it.
   - Drum is used on: usedOn.
   - Done: blank.
   - The last row is `tr.totr` with `Total`, TOMAKE and FLANGES.
8. **PDF**: A4 landscape, backgrounds printed. The footer on every page is `KGP Drum Assembly Card · <version> · page x of y`. If CardIssue.review is true, the diagonal mark `FOR REVIEW PURPOSE ONLY` goes on every page.

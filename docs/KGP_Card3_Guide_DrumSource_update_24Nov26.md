# KGP Card 3 – Finished Goods Drum Requirement Card – drum size source update (24-Nov-26)

Drum size and metres per drum now come only from the **RAW MATERIALS REQUIREMENT** sheet (MD's rule). The S8 tab `Drum length` is no longer used.
The parts below replace the matching parts of **Card 3 Developer Guide v4**. Each part says where (section), what (old → new) and how. Nothing else changes.

Join keys: Card plan `prodOrder` → S8 `Order lines` A · Order lines Q (Contract no) + N (FG item code) → RM B + E · RM AR (Drum code) → S7 A.

---


### 1. Sources – replace the S8 row and the ⚠ line under the table

| Ref | Source | ID / place | Tab (header row) | Columns read (by heading) |
|---|---|---|---|---|
| S8 | Armouring 5 – SFG Dashboard Data | `1V5YkE3ukRRib_1hlUU3xDTZuskJaYCXMPPcbqIeKPPI` | `Order lines` (row 1) | A Production order · N FG item code · Q Contract no |
| RM | Samrat_VINAY-DHIRAJ-RAW MATERIAL REQUIREMENT | `1LYLR9h7LiWtqsFYS0eeBvrm-li-6XLUWm56R3KYMfSw` | `RAW MATERIALS REQUIREMENT` (row 2; data from row 3) | B Contract No · E Item Code · AO Packing Leanth (metres per drum) · AR Drum Code · AS DRUM NAME |

S7 stays, but is used **only** for stock and flanges, matched by drum code (A). S7 B (drum size text) is not used for orders.

Delete the ⚠ line about `Drum length` missing orders 209 … 300.

### 2. Schema – replace RaccoonDrum and DrumSize; add one field to FgDrumNeed

```prisma
model RaccoonDrum {               // Card 1 table – one row per production order (cable and Raccoon)
  prodOrder  String @id
  contractNo String               // new – S8 Order lines Q
  drumCode   String               // new – RM AR
  drumSize   String               // RM AS, normalised (3.1)
  drumKm     Float                // RM AO ÷ 1000
}

model DrumSize {                  // S7 Drum Stock – stock and flanges only
  drumCode   String @id           // A
  stockSize  String?              // B, shown only in "Not in Drum Stock" messages
  stock      Int                  // G
  flangeKgp  Int?                 // N (null if not a number)
  flangePp   Int?                 // O (null if not a number)
}

// FgDrumNeed – one new field:
//   drumCode  String   – RaccoonDrum.drumCode
```

The `note` field of RaccoonDrum (v4) is removed: RM has no note column.

### 3.1 Drum size text – replace the first line
RM AS text: remove a leading `DRUM - ` or `DRUM ` (keep `STEEL DRUM - …` as it is), then: `" X "` → `"×"` · `"+ EXTRA SEGMENT"` / `"+ Extra Segment"` → `"+ extra segment"` · `" - RDSO"` → `" RDSO"` · repeated spaces → one space.
Example: `DRUM - 48 X 20 X 28 X 2.25 - RDSO` → `48×20×28×2.25 RDSO`.

### 3.2 DrumSize – replace the table
| Field | Value |
|---|---|
| drumCode | S7 A; skip rows with A blank or B = TOTAL |
| stockSize | S7 B as written |
| stock | S7 G as a whole number; blank → 0 |
| flangeKgp | S7 N as a number; text (e.g. "(shared)") → null |
| flangePp | S7 O as a number; text → null |

### 3.3 RaccoonDrum – replace the whole section
For each production order in the Card plan:
1. contractNo = S8 `Order lines` Q, item = Order lines N, from any row of that production order.
2. Find the RM row with B = contractNo **and** E = item.
3. If found and AR is filled: drumCode = AR, drumSize = AS (3.1), drumKm = AO ÷ 1000.
4. If the contract is blank, no RM row is found, or AR / AO is blank: **no RaccoonDrum row**. The order is "drum size missing" (4.1).

### 4.1 Drum need – changes
- Step 2, add before the formula: **An order with no RaccoonDrum row gets no FgDrumNeed rows** (its drums are not counted). Keep it in a list MISSING (prodOrder, partyCable) for 4.3 step 7 c.
- Step 3, rows `size` and `note`:
  | Field | Value |
  |---|---|
  | size | RaccoonDrum.drumSize |
  | drumCode | RaccoonDrum.drumCode |
  | note | raccoon: `Bare conductor – wound straight on this drum` · else blank |
- Step 5: `stock left` is kept **per drumCode** (DrumSize.stock of that code; a code not in DrumSize has stock 0).

### 4.2 Values – changes
- SIZES = the drumCodes in order of first appearance in the row order; each is shown with its RaccoonDrum.drumSize.
- per size: flKgp = DrumSize.flangeKgp of that drumCode (null or code not in DrumSize → 0).

### 4.3 Building the card – changes
- Step 6 (Compare table), Drum size = RaccoonDrum.drumSize cut before ` +`; an order in MISSING shows `Drum size not in RM Requirement sheet – Samrat to fill` (in `.sec`) and `none` in both cells.
- Step 7 b, first "What to do" case: drumCode not in DrumSize → `<drumSize> (<drumCode>) is not in the Drum Stock sheet – plant to give stock and flanges`.
- Step 7 c, replace: if MISSING is not empty: Drum size = `Drum size not in RM Requirement sheet – Samrat to fill` · Problem = `<k> orders: <prodOrder party, …>` (sorted, party = first word of partyCable) · What to do = `Samrat to fill the drum code for these contracts in the RAW MATERIALS REQUIREMENT sheet`.
- Steps 8 and 9: delete every `Size not known` rule (such orders have no rows).

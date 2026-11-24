# KGP Card 1 – Machine Production Cards – drum size source update (24-Nov-26)

Drum size and metres per drum (ACSR Raccoon on Skip 8) now come only from the **RAW MATERIALS REQUIREMENT** sheet (MD's rule), not from `card1_rules.json` / tab `Card 1 rules`.
The parts below replace the matching parts of **Card 1 Developer Guide v3 (21-Nov-26)**. Each part says where (section), what (old → new) and how. Nothing else changes.

Join keys: S8 `Order lines` A (Production order) → Q (Contract no) + N (FG item code) → RM B + E → RM AR (Drum code), AS (Drum name), AO (metres per drum).

---

### Section 1 (Source of truth – sheets) – add one row to the table

| Ref | Sheet | Spreadsheet ID | Tab | Header row | Data from | Filled by | Refresh |
|---|---|---|---|---|---|---|---|
| RM | Samrat_VINAY-DHIRAJ-RAW MATERIAL REQUIREMENT | `1LYLR9h7LiWtqsFYS0eeBvrm-li-6XLUWm56R3KYMfSw` | RAW MATERIALS REQUIREMENT | 2 | 3 | Samrat / Rohit (contracts) | as contracts come |

RM columns read: B Contract No · E Item Code · AO Packing Leanth (metres per drum) · AR Drum Code · AS DRUM NAME.

### Section 2.3 (S8 `Order lines`) – add two rows to the column table

| Col | Header | Used for |
|---|---|---|
| N | FG item code | key → RM E |
| Q | Contract no | key → RM B (added to the hourly pull on 24-Nov-26) |

### Section 3.1 (Schema) – two changes

1. `OrderLine` – add two fields:
   ```prisma
   fgItemCode String?   // S8 Order lines N
   contractNo String?   // S8 Order lines Q
   ```
2. `RaccoonDrum` – replace the line `model RaccoonDrum { prodOrder String @id  drumSize String  drumKm Float }` with:
   ```prisma
   model RaccoonDrum {               // one row per production order (cable and Raccoon); also used by Cards 3 and 4
     prodOrder  String @id
     contractNo String               // S8 Order lines Q
     drumCode   String               // RM AR
     drumSize   String               // RM AS, normalised (see below)
     drumKm     Float                // RM AO ÷ 1000
   }
   ```

### Section 3.2 (Sync rules) – three changes

1. Row `OrderLine`: range `'Order lines'!A2:P` → `'Order lines'!A2:Q`.
2. Row `ConductorRoute, MachineFirst, HtSequence, PlanLimit, RaccoonDrum`: remove `RaccoonDrum` from this row, and delete the `raccoon_drum` block from `card1_rules.json`.
3. Add a row:

   | Table | Range | Skip row if | Values |
   |---|---|---|---|
   | RaccoonDrum | RM `'RAW MATERIALS REQUIREMENT'!A3:AS` | B empty | see below |

   **How to fill RaccoonDrum** – for each production order in OrderLine:
   1. contractNo = Order lines Q, item = Order lines N (any row of that production order).
   2. Find the RM row with B = contractNo **and** E = item.
   3. If found and AR and AO are filled: drumCode = AR, drumKm = AO ÷ 1000, drumSize = AS with a leading `DRUM - ` or `DRUM ` removed (keep `STEEL DRUM - …`), then `" X "` → `"×"`, `"+ EXTRA SEGMENT"` → `"+ extra segment"`, `" - RDSO"` → `" RDSO"`, repeated spaces → one space.
   4. Otherwise (contract blank, no RM row, AR or AO blank): no RaccoonDrum row.

### Section 4.3 (Day simulation), step 2 (ACSR Raccoon on Skip 8) – replace the drum part

Old: `drums = ceil(q / 2.5)` … "Drums: needs n drums of <drum size> (2,500 m) from the yard that day – run only if assembled the day before" (drum size from rule `raccoon_drum`; ⚠ should come from S7 – open point 4).

New:
- `q = min(balance, timeLeft × 40)` – unchanged.
- If the order has a RaccoonDrum row: `drums = ceil(q / RaccoonDrum.drumKm)`; status `drum`; text `Drums: needs <drums> drums of <drumSize> (<drumKm × 1000> m) from the yard that day – run only if assembled the day before`.
- If it has none: status `drum`; text `Drums: Drum size not in RM Requirement sheet – Samrat to fill`; no drum count.

Note: with RM today, Laser 263 is contract S426Y-00036 → 4,000 m per drum (not 2,500); Nucon 299 / 300 are S426Y-00221 → 2,500 m.

### Section 7 (Open points) – delete point 4
"Raccoon FG drum size per order should come from S7 …" is closed by this update.

# KGP Card 4 – Drum Assembly Card – drum size source update (24-Nov-26)

Drum size and metres per drum now come only from the **RAW MATERIALS REQUIREMENT** sheet (MD's rule). The S8 tab `Drum length` is no longer used.
The parts below replace the matching parts of **Card 4 Developer Guide v1**. Each part says where (section), what (old → new) and how. Nothing else changes.

Join keys: Card plan `prodOrder` → S8 `Order lines` A · Order lines Q (Contract no) + N (FG item code) → RM B + E · RM AR (Drum code) → S7 A.

---


### 1. Sources – S7 row, last column
`through table DrumSize (Card 3 guide, 24-Nov update), matched by FgDrumNeed.drumCode: flangeKgp (N), flangePp (O)`

### 3 / 4. Flange check – changes
- flangesLeft is kept **per drumCode**: flangesLeft[code] = DrumSize.flangeKgp for every code where flangeKgp is a number.
- Case table: delete the row `drumSize = Size not known`. Row `drumSize not in DrumSize` becomes `drumCode not in DrumSize` (held up, Problem `Not in the Drum Stock sheet`).
- "Cannot be made yet" table: delete the `Size not known` row; row `size not in DrumSize` becomes `drumCode not in DrumSize` · `<drumSize> (<drumCode>) is not in the Drum Stock sheet` · `Plant to give stock and flanges`.
- Date-by-date: delete the rule `Size not known in .sec`.
- Calendar legend `shortd`: `Some held up (no flanges)`.

Orders with no drum size never reach Card 4: they have no FgDrumNeed rows and are listed only on Card 3 (Needs action c).

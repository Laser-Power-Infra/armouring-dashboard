# Armouring 5 Dashboard: what it shows and what data is missing

Date: 19-Nov-26. Based on `Armouring_5_Dashboard_Flow_and_Rules.md` (Rev 3) and the Google Sheet "Armouring 5 – SFG Dashboard Data".

> **Update, 19-Nov-26 15:59.** The sheet changed layout after this note was written. It is now the data sheet for the four KGP cards (see `docs/KGP_4_Cards_Build_Spec.md`).
>
> - **Added:** Material per item (empty so far), C&R Lots, C&R Orders, Roster, Skill, Men per shift, Drum stock, RM stock, Machine routing, Cores per cable, and the five card tabs (Card plan, Labour allocation, Spare men, FG drum need, Drum assembly).
> - **Removed:** Armouring pending, Arm5 Grid entries, Arm5 daily output, KGP stage output, ERP labour AR005, ERP stock, Dead stock. The sheet's README says: "Bobbins, ERP labour and stock are not in this sheet for now" and "Grid is no longer used: production done comes from the SFG dashboard only".
> - **Effect on this note:** cores per cable and machine routing now have a source. Production entries, men posted and everything for the bobbins block have none in this sheet. Sections 3 to 6 below describe the old layout and must be redone when the dashboard work starts.

## 1. What the dashboard is for

It is read in the Kharagpur morning meeting to decide what Armouring machine 5 does today. It answers four questions, in this order:

1. Is there cable ready for the machine?
2. Did the men produce?
3. Are the bobbins ready?
4. How much work is left?

## 2. What the dashboard shows

| # | Block | What it shows |
|---|---|---|
| – | Header | Date of the last entry, men and km on the latest day, days of work left, days of cable ready |
| 1 | Cable ready for armouring | Orders with inner sheath done and armouring not done, in km and days |
| 2 | Waiting for inner sheath | km laid but not yet sheathed |
| 3 | Waiting for laying | Cores insulated but not yet laid, as cable km |
| 4 | Waiting for insulation | Conductor made but not yet insulated |
| 5 | Waiting for outer sheath | km armoured but not yet finished |
| 6 | Output by step | km per shift day for insulation, laying, inner sheath and Armouring 5, last 10 days |
| 7 | Men vs production | Men and km on day and night shift, km per man, average km per working day |
| 8 | Bobbins | Bobbins still to wind per lot, and the bobbin pool by state |
| 9 | Work left | Kharagpur orders with armouring pending, km and days; part not in any plan; part not approved |
| – | Latest entries | Production entries of the last 7 shift days |

## 3. Data each block needs, and whether we have it

"The sheet" below means the Google Sheet "Armouring 5 – SFG Dashboard Data".

| Block | Data needed | In the sheet? |
|---|---|---|
| 1 to 5, 9 | Order lines: order, step, customer, cable, ordered km, done km, approved | Yes (tab "Order lines") |
| 3 | Cores per cable, to turn core km into cable km | **No.** Can be worked out as insulation km ÷ cable km |
| 9 | Planned jobs for Armouring 5, to mark an order "in plan" | **No.** Production Planning sheet |
| Header, 6, 7, Latest entries | Each drum made on Armouring 5: time, order, cable, drum, km, who entered | Yes (tab "Arm5 Grid entries"), but only up to 16-Nov-26 |
| 6 | Each drum made on the insulation, laying and inner sheath machines | **No.** Only daily totals (tab "KGP stage output") |
| 6 | Which machine belongs to which step | **No.** Machine Routing sheet |
| 7 | Men posted on AR005 by date and shift | Partly: counts for 16, 17 and 18 Nov only |
| 8 | Lots: bobbins needed, bobbins wound, approved, completed | **No.** Production Planning sheet |
| 8 | Daily bobbin count by state, and bobbins owned (145 from 10-Nov-26) | **No.** Bobbin Status sheet |

Stock and dead stock are in the sheet but no block uses them.

## 4. What is missing

### 4.1 Sheets we have not been given

| Sheet | Needed for | Effect while missing |
|---|---|---|
| Spooling Production Log – Production Planning | Planned jobs and lots | Block 8 is empty. Block 9 shows every order as "not planned" |
| Spooling Production Log – Bobbin Status | Bobbin pool and bobbins owned | Block 8 shows no pool |
| KGP Machine Routing | Machine for each step | Block 6 shows Armouring 5 only |

The rules guide says the links are in the handover file. We do not have that file.

### 4.2 Data that has no source yet

| Item | Problem |
|---|---|
| Production entries after 16-Nov-26 | Grid entries for Kharagpur have stopped. The new source is not confirmed (rules guide, open point 1). Until then the header and blocks 6 and 7 show old data |
| Entries for insulation, laying and inner sheath | Block 6 needs each drum made on these machines. The sheet has daily totals only |
| Cores per cable | Not given anywhere. We will work it out from the order quantities unless a source is named |
| Men posted | Only three dates, and counts only. Enough for block 7, but late by 1–2 days |

### 4.3 Points where the sheet and the rules do not agree

| Point | Detail | Answer needed |
|---|---|---|
| Duplicate drum rule | The rule says the same drum entered twice must be flagged. Drums are reused: 46 of 71 entries repeat a drum number | What makes an entry a duplicate? Suggested: same drum, same order and same km on one shift day |
| Shift day | Three night entries starting between 23:05 and 23:47 carry the next day's date. The rule puts them on the same date | Which is right? |
| Pending orders | Tab "Armouring pending" has 23 orders (170.5 km). Tab "Order lines" gives 19 (156.5 km). Orders P726Y-00302 to 00305 are missing from "Order lines" | Refresh "Order lines" with the other tabs |

## 5. What can be shown today with the sheet alone

- Blocks 1 to 5 and block 9 (without "in plan").
- Block 7 and the latest entries, up to 16-Nov-26.
- Block 6 for Armouring 5 only.
- Block 8 empty.

## 6. What we need to complete the dashboard

1. Links to the Production Planning, Bobbin Status and Machine Routing sheets, shared with the dashboard's service account.
2. The confirmed source of production entries after 16-Nov-26.
3. Production entries for the insulation, laying and inner sheath machines.
4. Answers to the three points in section 4.3.

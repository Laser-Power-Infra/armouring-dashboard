# KGP 4 cards in the dashboard – design

Date: 19-Nov-26. Rule book: `docs/KGP_4_Cards_Build_Spec.md` (called "the build spec" below). Look: `templates/*.html`.

## Intent

The plant gets four cards (machine production, labour allocation, drum requirement, drum assembly). Today they are PDFs. The dashboard gets one tab per card, showing the current issue in the approved layout, printable to A4 landscape. The data comes from the Google Sheet `1V5YkE3ukRRib_1hlUU3xDTZuskJaYCXMPPcbqIeKPPI`, which is the source of truth.

## What the sheet holds today (read 19-Nov-26 15:59)

| Tab | Rows | Use |
|---|---|---|
| Card plan | 271 | Card 1 |
| Labour allocation | 282 | Card 2 |
| Spare men | 28 | Card 2 |
| FG drum need | 42 | Card 3 |
| Drum assembly | 36 | Card 4 |
| Drum stock | 10 sizes | Flanges at Kharagpur and Poly Park (Cards 3, 4) |

All five card tabs carry version `17-Nov R2 plan`, day 0 = 17-Nov-26. They are the same data as the four templates, so the templates' figures are the expected results.

Input tabs (Order lines, C&R Lots, C&R Orders, Roster, Skill, Men per shift, RM stock, Machine routing, Cores per cable) are not needed to show the cards. `Material per item` is empty.

## Goals

- Four tabs, one per card, each matching its template: same sections, same wording, same colours, same figures.
- Every figure is worked out from the tabs by the build spec's rules (sections 2.3, 4, 6, 7.5, 8, 9), not typed in.
- Prints to A4 landscape like the template.
- Data is stored in our database, one table per card (the labour card has a second for spare men). A load command copies the tabs in.
- Every issue is kept with its version: issue date, revision number, day 0, when it was generated and when it was loaded. The pages show the latest issue and offer the older ones.

## Non-goals

- Making the plan. Steps 1 to 3 of the build spec (simulation, labour filling, drum counting) stay with the card issue that writes the tabs. The app only shows what is in the tabs.
- Writing to the sheet. It is read only.
- Scheduled sync. The owner handles it; the load command is the thing to call.
- Changes to the Armouring 5 dashboard. That comes after.

## Anti-goals

- A card that shows a different number from the issued card.
- Restyling the cards to the dashboard's look. The card look was approved on 18-Nov-26 and is fixed (build spec 2.2).

## Approaches

1. **Show the issued tabs (chosen).** Read the five output tabs and Drum stock, store them, render the cards. Small, exact, and matches the sheet's README: "Claude makes the cards and this sheet is the dashboard's only data source".
2. **Rebuild the plan in the app** from the input tabs. Not possible today (`Material per item` is empty, drum size per order and several rates live in scripts, build spec section 11) and it would produce a second, different plan.
3. **Embed the issued HTML or PDF.** No rules, no data in our database, and nothing for the dashboard to reuse later.

## Design

- **Tables** (new migration): `card_issues` (one row per issue), then `card_plan` (Card 1), `card_labour` and `card_spare_men` (Card 2), `card_drum_need` (Card 3), `card_drum_assembly` (Card 4), `card_drum_stock` (flange stock as it was at that issue). Every data row points at its issue. A load adds an issue; loading the same version again replaces only that issue.
- **Reading the sheet:** by heading, never by column letter (build spec section 1), with the existing `lib/sheets` client and `mapRows`.
- **Rules:** pure functions in `lib/cards/`, one file per card, tested against the templates' figures.
- **Fixed facts per machine** (order, group, makes, runs, speed, feed, note, men per shift, bottleneck): one table in `lib/cards/machines.ts`, copied from the template and build spec 3.3 and 5.1. The build spec keeps these in scripts for now (section 11).
- **Pages:** `/cards/production`, `/cards/labour`, `/cards/drum-requirement`, `/cards/drum-assembly`, under one layout with the tab bar and a Print button. The dashboard's top bar gets a "Cards" link.
- **Look:** the template's stylesheet, scoped to the card pages. Roboto 400/700. The app bar is hidden in print.

## Calls made (correct me)

| Call | Why | If wrong |
|---|---|---|
| Card pages are public (owner, 19-Nov-26) | No sign-in for now | The labour card names every man on an open page |
| Revision number is read from the sheet's version text (`17-Nov R2 plan` = 17-Nov-26 / Rev 2); when the text has none, the next number for that date | The owner wants every issue stored with its version | A wrong Rev on the card until the sheet writes it plainly |
| Wording follows the build spec where the tab differs (for example "No flanges – to be bought", not the tab's "BUY – no 84″ flange…") | Build spec: "If a rule here and a card differ, the card is wrong" | Show the tab text as it is |
| Men per shift comes from the fixed list in build spec 5.1 | The `Men per shift` tab has blanks and other machine names | Map the tab's names |
| Loader is a command, run once now | The owner handles sync | Nothing to undo |

## Left to the builder

Exact markup per card (copy the template), file-internal structure, and test fixtures.

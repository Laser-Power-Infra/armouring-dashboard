# Frontend redesign: design system and server-driven tables

Date: 2026-11-19. Status: approved by the user 2026-11-19.
Product facts live in `PRODUCT.md`. Business rules live in `Armouring_5_Dashboard_Flow_and_Rules.md` ("rules doc").

"Decided" = the user said it. "My call" = chosen by the author; correct it at review.

## 1. Intent

Redesign the whole frontend (dashboard, login, signup) so it feels like an Apple product: simple, calm, obvious. Build a small design system first, then rebuild the screens from it. Every list becomes a real data table whose paging, sorting, searching and filtering run on the server.

Readers: the Kharagpur morning meeting, on a projector or TV with one person driving, and on personal laptops. Phone is secondary but must still work.

## 2. Goals, non-goals, anti-goals

Goals

- One design system: tokens plus a small set of components, used by every screen.
- Light mode only. One typeface. One primary and one secondary colour. Few rounded corners.
- All 8 lists are server-paged tables with sort, search (700 ms debounce) and a filter dropdown on each column, options fetched from the server.
- No figure on screen changes value because of this work.

Non-goals

- Dark mode. New product features (production cards, alerts). Column hiding or reordering, CSV export, saved views, table state in the URL. Row virtualisation.
- New runtime dependencies. No table library, no component kit, no animation library.

Anti-goals (a failure even if it works)

- A screen that needs explaining in the meeting. Controls that crowd out the four headline answers.
- A browser that ever receives a full list.
- Colour used as decoration, or a second font.

## 3. Decisions already made by the user

- Apple-like experience, simplicity first. Skills to follow: `apple-design`, `impeccable`, and the system rules of `design-taste-frontend`.
- Design system first, then screens.
- Light mode only for now.
- One professional font, typography per impeccable.
- One primary colour, one secondary colour. This replaces the "different colour for each block" line in rules doc §7.4. Blocks are told apart by title, icon and position. Red, amber and green stay for status only.
- Rounded corners not overused.
- Every list is server-side paged. Sorting and searching are server-side. Search debounce is at least 700 ms. Each column has a filter dropdown whose options come from the server.
- Paging for the order lists is computed in Postgres, not in the app server.
- Read on projector/TV and laptop.

## 4. Approaches considered

Where list paging is computed (6 of the 8 lists are per-order sums derived from `order_lines`, not stored rows):

| | Approach | Trade-off |
|---|---|---|
| A | Compute the list in the app server with the existing `calc.ts`, then filter, sort and slice there | Smallest change; database still sends every Kharagpur order line to the server on each request |
| **B** | **Move the waiting/pending rules into Postgres views; page with `LIMIT/OFFSET`** | **Scales to any size; rules leave tested TypeScript, so every number must be re-proved** |
| C | Loader writes a precomputed table at refresh time | Most moving parts; a second copy of the data that can go stale |

The user picked **B**.

How the browser talks to the server:

| | Approach | Trade-off |
|---|---|---|
| **1** | **One client table component plus one route handler per concern (`rows`, `facets`)** | **Only the touched table refetches; no dependency** |
| 2 | Table state in URL search params, server components re-render | 8 tables on one page: every keystroke would re-run every block |
| 3 | Server actions | Meant for mutations; no request cancelling |

My call: **1**.

## 5. Visual direction

The direction is pinned by the user ("user experience like apple and simplicity", light, one font, two colours, restrained corners), so no concept roll is run. The surface is an Operate surface: the reader came to get an answer, so familiar controls and scanability beat expression.

### 5.1 Colour (my call on the exact values)

Strategy: restrained. Neutrals carry the screen; colour appears only where it does a job.

| Role | Value | Used for |
|---|---|---|
| Primary | Blue `#0066cc` | Primary button, links, current selection, focus ring, active filter, main data series |
| Secondary | Indigo `#5856d6` | Second data series (night shift), "machine has no work" state (rules doc §7.4 wants its own colour), secondary emphasis |
| Ground | `#f5f5f7` | Page background |
| Surface | `#ffffff` | Panels, tables, popovers |
| Ink | `#1d1d1f`, `#6e6e73`, `#86868b` | Text: main, secondary, hint |
| Line | `#d2d2d7`, `#e8e8ed` | Control borders, row dividers |
| Critical / Warning / Good | `#d70015` / `#b25000` / `#248a3d` with pale grounds | Status only, always with a text label |

Each colour gets a small fixed set of steps (text-safe, solid, tint) defined once as tokens. Charts use primary, secondary and their tints; a series is always labelled directly, never by colour alone. The bobbin pool bar uses primary tints for usable states and the status colours for problem states (badly wound, workshop, broken), because those are problems.

Removed: the 10 `--b-*` block colours, the 6 `--s*` categorical colours, `--idle`, and all dark-mode tokens.

The user rejected teal and graphite on 2026-11-19 and left the pick to the author. Indigo is Apple's own system indigo and is already this project's night-shift colour, so day (blue) and night (indigo) keep their meaning. Orange and green were ruled out because they would be confused with the warning and good status colours. Note: `design-taste-frontend` bans violet; indigo sits next to it, and is used here only for data and state, never as a ground or gradient. It is one token (`--secondary`), so changing it later is a one-line edit.

### 5.2 Type (my call)

One family: **Inter** (already loaded through `next/font`, self-hosted, variable weight), on every device. The current stack shows SF Pro on Apple devices and Inter elsewhere; dropping the SF-first stack makes the projector PC, laptops and phones render the same. No second family.

Fixed rem scale (ratio about 1.2), named by role:

| Role | Size / line height | Weight | Tracking |
|---|---|---|---|
| Caption (as-of, column heads) | 12 / 16 | 500 | +0.01em |
| Label, table cell | 14 / 20 | 400, 500 | 0 |
| Body | 16 / 24 | 400 | 0 |
| Block title | 20 / 26 | 600 | -0.01em |
| Page title | 24 / 30 | 600 | -0.015em |
| Figure | 34 / 38 | 600 | -0.02em |
| Headline figure | 48 / 52 | 600 | -0.025em |

Numbers in tables, figures and charts use tabular figures. Headings use `text-wrap: balance`. Sizes are in rem so browser zoom and text-size settings work.

### 5.3 Shape, space, depth, motion (my call)

- Radius: two values only. 6px for controls and badges, 10px for panels and popovers. Tables, rows and bars are square. No pills.
- Space: a 4px base scale (4, 8, 12, 16, 24, 32, 48). One rhythm on the whole screen; more space above a block title than below it.
- Depth: panels are flat white on the ground with a hairline, no shadow. Only popovers get a shadow. The sticky top bar is translucent with blur, and falls back to solid white under reduced transparency.
- Motion: CSS only, 150 to 200 ms, for state changes only (press, popover, loading). Buttons respond on pointer-down. Nothing animates on page load. Reduced-motion turns movement into a short fade.

### 5.4 Signature

The pipeline strip: the plant flow drawn left to right, with the km waiting in front of each step and the chosen armouring machine marked. It already exists as the Pipeline block; it becomes the one distinctive element, in primary and its tints.

## 6. Design system

Tokens live in `app/globals.css` (`:root` plus Tailwind 4 `@theme`). Components live in `components/ui/`. `components/dash/` keeps the dashboard-specific pieces, rebuilt from `ui`.

| Component | Notes |
|---|---|
| `Button` | primary, secondary, quiet. States: default, hover, pressed, focus, disabled, loading |
| `IconButton` | same states; always has an accessible name |
| `Input`, `SearchInput` | label always visible; search shows a pending mark the moment typing starts |
| `Select` | native `<select>` styled (machine picker, page size) |
| `Checkbox` | native, styled |
| `Popover` | native Popover API, anchored to its trigger, closes on Escape and outside click |
| `Badge` | critical, warning, good, neutral; text always present |
| `Panel` | replaces `Section`: title, optional icon, as-of label, body |
| `Stat` | replaces `Figure`: label, value, unit, optional note |
| `AsOf` | "data as of" time; stale state uses critical colour plus the word "stale" |
| `Skeleton`, `Empty`, `ErrorNote` | loading, no rows, failed request with a retry button |
| `DataTable`, `ColumnMenu`, `Pagination` | section 7 |
| `Bars`, `SplitBar` | existing charts, moved onto the new tokens |
| `Glyph` | existing icon set, one stroke weight |

Replaced and deleted: `inputClass`, `primaryButton`, `secondaryButton` strings in `components/auth-shell.tsx`, `Section`, `Figure`, `OrdersTable`.

A reference page at `/design-system` (admin only; the check sits in the page itself, because `proxy.ts` guards only `/admin`) shows every component in every state. It is how the system is checked by eye before any screen is rebuilt.

`DESIGN.md` is written at the end, from the finished build, by impeccable's documenter. That is impeccable's rule: a rulebook written before the build describes intentions, not the product.

## 7. Tables

### 7.1 The eight tables

Default order is biggest first (rules doc §7.4) unless noted.

| Table | Columns (filter type) | Default sort |
|---|---|---|
| Cable ready for armouring | Order (list), Customer (list), Cable (list), km (sort only) | km desc |
| Waiting for inner sheath | same | km desc |
| Waiting for laying | same | km desc |
| Waiting for insulation | same, unit core km | km desc |
| Waiting for outer sheath | same | km desc |
| Work left | Order, Customer, Cable (list), km (sort only), Approved (yes/no), In plan (yes/no) | km desc |
| Lots (bobbins) | Lot, Cable item, Armour type, Armour size (list), Needed, Wound, To wind (sort only), Approved (yes/no) | priority asc, then lot |
| Latest entries | Shift day, Shift, Order, Cable, Drum, Entered by (list), Time, Metres (sort only), Duplicate (yes/no) | entered time desc |

My call, and the one place this narrows the request: **number and time columns get sort only, no dropdown.** A dropdown of every distinct km value is a list of near-unique numbers; it filters nothing useful. Every text, yes/no and day column gets a dropdown. If numeric dropdowns are still wanted, the cheap honest form is server-computed ranges, added later.

### 7.2 Behaviour

- **Paging**: page sizes 10, 25, 50. Default 10. Footer shows "1–10 of 137" with previous/next. Server caps size at 50.
- **Sort**: click a column head to open its menu: sort ascending, sort descending, and (for list columns) the filter. One sort column at a time; the head shows an arrow.
- **Filter dropdown**: options are fetched from the server when the menu opens, with a count beside each. Options respect the search text and the other columns' filters, so a count is always what you would get. Long option lists have a search box inside the menu (same 700 ms debounce) and load 50 at a time. Multi-select with checkboxes. An active filter marks the column head in primary and adds a "Clear filters" button to the table toolbar.
- **Search**: one box per table, matching order, customer and cable (plus drum and entered-by on entries). The request fires 700 ms after typing stops. A pending mark appears on the first keystroke, so the wait never looks dead. Enter searches at once.
- **Requests**: a new request cancels the one before it. Old rows stay visible, dimmed, while the next page loads; row height is fixed, so nothing jumps. Any change to search, filter or sort returns to page 1.
- **First paint**: the server component renders page 1 into the HTML using the same query function. The client component takes over from there. No loading flash on arrival.
- **States**: first load skeleton, empty ("No orders match. Clear filters."), error with retry, and the existing per-block error boundary.
- **Keyboard**: column menus and pagination are reachable and operable by keyboard. Real `<table>` markup with `scope` on heads and `aria-sort`.
- **Narrow screens**: the table scrolls sideways inside its panel with the first column pinned.

- **Refresh**: the Refresh button and any new data load re-render the server parts. Each table is given the block's "data as of" time; when that time changes, the table refetches its current page with its search, filters and sort kept. A tile and its table therefore always show the same load.

The four upstream waiting lists (today: total, order count, first 4 rows, "Show N more") become ordinary tables like the rest, with a default page size of 5 so the screen stays short (my call). Their page 1 is server-rendered too.

Lots keep today's scope: open lots of the chosen machine.

Latest entries keep today's window (the last `latest_entries_shift_days` shift days, 7 by default) as a fixed condition in the query; the 200-row cap goes because paging replaces it. The table becomes flat, so the per-day km totals (duplicates excluded) move to a small day-by-day strip above the table, computed in SQL; no figure is lost (my call). The Order column can hold two order numbers for one entry: its filter matches an entry that contains the chosen order, and its dropdown counts entries per order.

### 7.3 Server

- `lib/tables/defs.ts`: one definition per table: its SQL source, columns, which are sortable, searchable or filterable, and the default sort. This whitelist is the only source of column and table names that reach SQL.
- `lib/tables/query.ts`: `fetchRows(def, params)` and `fetchFacet(def, column, params)`. Built with Prisma's tagged `Prisma.sql`; every value is a bound parameter; identifiers come only from the whitelist.
- `app/api/tables/[table]/route.ts` returns `{ rows, total }`. `app/api/tables/[table]/facets/route.ts` returns `{ options: [{ value, count }], hasMore }`.
- Params are validated with zod (already installed): `machine`, `page`, `size`, `sort`, `dir`, `q`, and `f.<column>` filters. Bad input is a 400, unknown table a 404.
- Access matches the page: the dashboard is readable without login today, so these endpoints are too. They expose nothing the page does not already show.

### 7.4 Database (one migration, views only)

- `order_summary`: one row per Kharagpur order with done and ordered km per stage and the insulated-cores cable km. It ports `summariseOrders` exactly as the code behaves today (sum of done and ordered km per stage over every line) and the `kgp_order_prefix` setting (no prefix set = all orders). Known gap, deliberately not fixed here: rules doc §5 block 4 says "a conductor used by two items is counted once", but today's code does not do that and the rules doc does not say how to spot a shared conductor. Fixing it would change a figure, so it is a separate task. One thing is made stricter (my call): today the customer and cable shown for an order come from whichever line the database returns first; the view picks the first non-empty value ordered by stage then `sfg_item`, so the result is the same every time.
- `order_waiting`: `(step, prod_order, customer, cable, km)` for the five waiting lists, rows above half a metre only (the existing `EPS`).
- `armouring_pending`: `(prod_order, customer, cable, km, approved, in_plan)` for Work left. `in_plan` keeps today's rule: match by cable name against open lots and open plan jobs.

Lots and production entries are queried from their own tables.

**One owner for each number.** The block totals, the header line and the pipeline strip read `SUM(km)` from the same views, so a tile can never disagree with its table. The JS versions (`waitingBetween`, `waitingForLaying`, `armouringPending`, `summariseOrders`) are deleted once parity is proved; shift-day, output and bobbin maths stay in `calc.ts`.

**Proof of parity** (this is the risk in approach B): before the JS versions are deleted, a test loads fixtures into a database and asserts that each view returns the same rows and km as the JS function, to 0.001 km. The existing fixtures (9 lines, 3 orders in `tests/calc/dashboard.test.ts`) are too thin, so they are widened first to cover (my call): a step where done is less than the next step (negative difference, must not appear), a difference under half a metre, missing customer or cable, an order with mixed approval, an order outside the prefix, and cables in and out of a plan. Then, once, the same comparison is run against the real loaded data in the development database and the result is reported before anything is deleted. Views are plain, not materialised; `order_lines` is small and reloaded on every refresh.

## 8. Screens

Order is fixed by the rules doc §5. A reader can stop at any point.

```
┌──────────────────────────────────────────────────────────────────┐
│ Armouring 5 ▾                       Data as of 07:28   Refresh   │  sticky bar
├──────────────────────────────────────────────────────────────────┤
│ Cable ready      Men and output    Bobbins to wind   Work left   │
│ 42.6 km          6 men · 3.1 km    18                212 km      │  the four answers
│ 4.2 days         latest day        running + next    21 days     │
├──────────────────────────────────────────────────────────────────┤
│ Conductor → Insulation → Laying → Inner sheath → [Armouring 5] → │  pipeline strip
├──────────────────────────────────────────────────────────────────┤
│ Cable ready for armouring                       as of 07:28      │
│ [Search orders…]                                 Clear filters   │
│ Order ▾     Customer ▾      Cable ▾                      km ▾    │
│ ──────────────────────────────────────────────────────────────── │
│ KGP-1042    Eastern Grid     3C x 240 sqmm               12.40    │
│ …                                                                │
│ 1–10 of 37                                     ‹ Previous  Next ›│
└──────────────────────────────────────────────────────────────────┘
  then: upstream waiting (collapsed) · output by step · men vs production
        · bobbins · work left · latest entries
```

- The header line is the four questions as four `Stat`s, at headline size so the room can read them.
- The jump links stay, restyled as a quiet in-page nav.
- Each block is a `Panel`: title, icon, as-of time, its figures, then its table or chart.
- Login and signup are rebuilt from the same `Input`, `Button` and `Panel`. No behaviour change.
- Wording rules from the rules doc stay: customer name shown, "can be utilized for some other purposes", never "free" or "idle".

## 9. Constraints

- Next.js 16 has breaking changes. Read the matching guide in `node_modules/next/dist/docs/` before writing any route handler, client component or layout code (`AGENTS.md`).
- Schema changes go through a migration file only. Never `prisma db push`.
- No new dependencies.
- Impeccable's process applies to the UI work: read `reference/craft-floor.md` immediately before any UI edit; record the direction contract in the surface brief (`seed: none (pinned)`); check the rendered screens at 1440 and 390 wide; run its detector; finish with its reviewer and documenter.

## 10. Testing

- Unit (vitest): param validation, the query builder (whitelist holds, values are bound, sort/filter/search/paging produce the expected SQL), and the debounce (fake timers: nothing before 700 ms, one request after, earlier request cancelled).
- Database: the parity test in 7.4, plus rows/total/facet counts on a seeded set.
- By eye: `/design-system` and the dashboard captured at desktop and phone width, against this document.

## 11. Left to the builder

- Exact tint steps for each colour, provided text contrast is at least 4.5:1.
- File split inside `components/ui/`.
- SQL shape of the views, provided the parity test passes.
- How the parity test gets a database (a Neon branch or a local Postgres through `TEST_DATABASE_URL`); it must be skipped with a clear message, not silently passed, when no database is configured.

## 12. Settled at review (2026-11-19)

The user approved the document with "your picks":

1. Secondary colour: not teal, not graphite; author's pick is indigo (5.1).
2. Font: Inter on every device.
3. Number and time columns: sort only.

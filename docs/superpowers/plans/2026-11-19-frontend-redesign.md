# Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the dashboard, login and signup on a small Apple-style design system, and turn all 8 lists into tables whose paging, sorting, search and column filters run in Postgres.

**Architecture:** Tokens in `app/globals.css`, primitives in `components/ui/`. Postgres views own the waiting/pending rules; one whitelisted query builder (`lib/tables/`) serves both the server-rendered first page and two route handlers (`rows`, `facets`). One client `DataTable` holds table state, debounces search by 700 ms and cancels stale requests.

**Tech Stack:** Next.js 16.4.6, React 19.3, Tailwind 4.3 (`@theme`), Prisma 7.10 on Postgres (Neon adapter), zod 4, vitest 5. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-19-frontend-redesign-design.md`. Product facts: `PRODUCT.md`. Business rules: `Armouring_5_Dashboard_Flow_and_Rules.md`.

## Global Constraints

- No new runtime or dev dependencies.
- Next.js 16 differs from older versions. Before writing a route handler, a client component, or layout code, read the matching guide under `node_modules/next/dist/docs/` (`AGENTS.md`). Existing pages export `instant`; keep that convention as the docs describe it.
- Schema changes through a migration file only. Never `prisma db push`.
- Light mode only. One family: Inter. Colours only from tokens; no hex values in components.
- Primary `#0066cc`, secondary `#5856d6`. Status colours only for status, always with a text label.
- Radius: 6px controls and badges, 10px panels and popovers; tables, rows, bars square. No pills.
- Search debounce is exactly `SEARCH_DEBOUNCE_MS = 700`. Page sizes `10, 25, 50` (upstream lists default `5`); server cap `50`.
- No figure on screen may change value. Wording rules from rules doc §7.4 stay ("can be utilized for some other purposes"; never "free" or "idle"; customer name shown).
- Impeccable: read `.claude/skills/impeccable/reference/craft-floor.md` immediately before every task that edits UI (Tasks 1, 2, 7, 9, 10). Never copy the direction contract into source.
- Commits: run the commit steps only if the user has authorised commits for the execution session. No Claude/model attribution in commits, PRs or files; never add or remove the user's co-author hook line. Work on a branch, not `main`.
- Some tools in this environment show function bodies as "body elided". To see a body, read the file again with an explicit `offset` and `limit`.

## Review Focus

1. Search text containing `%`, `_`, `'` or `\` is matched literally and never errors. (Task 4)
2. A blank customer or cable appears as a selectable "(blank)" filter option and filters correctly. (Task 4)
3. A sort, filter or table name not in the whitelist, a non-numeric page, or `size=1000` returns 400/404 and never reaches SQL. (Tasks 4, 5)
4. A slow response that arrives after a newer request is ignored; the newer rows stay. (Task 6)
5. After a data refresh shrinks a list, a table sitting on a page past the end steps back to the last page instead of showing an empty table. (Task 6)

---

## File Structure

| File | Responsibility |
|---|---|
| `app/globals.css` | Tokens (`:root`, `@theme`), base element styles |
| `app/layout.tsx` | Inter as the only family, light theme colour |
| `components/ui/button.tsx` | `Button`, `IconButton` |
| `components/ui/field.tsx` | `Input`, `SearchInput`, `Select`, `Checkbox`, `Field` |
| `components/ui/popover.tsx` | `Popover` (native Popover API) |
| `components/ui/panel.tsx` | `Panel`, `Stat`, `AsOf`, `Badge` |
| `components/ui/feedback.tsx` | `Skeleton`, `Empty`, `ErrorNote` |
| `components/ui/data-table.tsx` | `DataTable`, `ColumnMenu`, `Pagination` (client) |
| `components/dash/charts.tsx`, `glyph.tsx` | Existing; moved onto tokens |
| `app/design-system/page.tsx` | Every component in every state, admin only |
| `prisma/migrations/<ts>_order_views/migration.sql` | `order_summary`, `order_waiting`, `armouring_pending` views |
| `lib/tables/defs.ts` | The 8 table definitions (the SQL whitelist) |
| `lib/tables/params.ts` | zod parsing of request params |
| `lib/tables/query.ts` | `fetchRows`, `fetchFacet` and their SQL builders |
| `lib/tables/client.ts` | `debounce`, `createLatest`, `tableUrl` (pure, no React) |
| `app/api/tables/[table]/route.ts`, `.../facets/route.ts` | Route handlers |
| `lib/dashboard/data.ts`, `calc.ts` | Totals read from views; order-rule JS removed |
| `tests/fixtures/order-lines.ts` | Shared parity fixtures |

---

### Task 0: Branch, docs, direction contract

**Files:**
- Create: `.impeccable/surfaces/` brief via the impeccable CLI (not by hand)

- [ ] **Step 1: Branch.** `git switch -c redesign-design-system`
- [ ] **Step 2: Read the Next.js guides** in `node_modules/next/dist/docs/` for: route handlers (`route.ts`, dynamic segment params), client components (`"use client"`), `connection()`, and the `instant` export. Note anything that differs from this plan and follow the docs.
- [ ] **Step 3: Write the direction contract.** Put the text below in a scratch file and run `.claude/skills/impeccable/scripts/impeccable surface-brief write "app/dashboard/[machine]/page.tsx" <scratch-file> "app/(auth)/login/page.tsx" "app/(auth)/signup/page.tsx"`, then `surface-brief read` the same target and confirm all six blocks are present.

```markdown
Scope: dashboard, login, signup. Visitor mode: Operate.

## Direction contract

THESIS: The four meeting questions answered at headline size, in order, before any control is visible. Refuses the tile-wall dashboard where every block shouts in its own colour.
OWN-WORLD: Apple-style light interface. Ground #f5f5f7, white flat panels with a hairline, ink #1d1d1f. Blue #0066cc for action and selection, indigo #5856d6 for the second series and the no-work state, red/amber/green for status only. Inter, fixed role scale, tabular figures. Radius 6px controls, 10px panels, square tables.
STORY: The reader learns whether the machine has cable, whether the men produced, whether bobbins are ready and how much work is left; then opens a table to find the order behind a number.
FIRST VIEWPORT: Translucent sticky bar (machine select, data-as-of, Refresh). Below it one row of four headline figures at 48px with a one-line note each. Below that the pipeline strip, left to right, chosen machine marked in blue. Primary action: the machine select, top left.
FORM: Standard web product shell and controls; signature move is the pipeline strip. seed: none (pinned) — "focus in on user exeperience like apple and simplicity", "one primary colour one secondary colour", "dark mode is not required for now start with light mode", "rounded corner should not be overused".
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
```

- [ ] **Step 4: Commit.** `git add PRODUCT.md docs .impeccable && git commit -m "docs: product record, redesign spec and plan"`

---

### Task 1: Tokens and type

**Files:**
- Modify: `app/globals.css` (whole file), `app/layout.tsx`

**Interfaces:**
- Produces Tailwind utilities used by every later task:
  - Colours: `bg-ground`, `bg-surface`, `text-ink`, `text-ink-2`, `text-ink-3`, `border-line`, `border-line-2`, `primary`, `primary-tint`, `secondary`, `secondary-tint`, `critical`, `critical-bg`, `warning`, `warning-bg`, `good`, `good-bg`.
  - Type roles: `text-caption`, `text-label`, `text-body`, `text-title`, `text-page`, `text-figure`, `text-headline`.
  - Radius: `rounded-control` (6px), `rounded-panel` (10px).
  - Class `.num` (tabular figures) stays.

- [ ] **Step 1: Replace the tokens in `app/globals.css`.** Delete the dark-mode block, all `--b-*`, `--s1..6`, `--idle`, `--day`, `--night`, `--bar`, `--accent`, `--surface-2`. Define exactly:

| Token | Value |
|---|---|
| `--ground` | `#f5f5f7` |
| `--surface` | `#ffffff` |
| `--ink` / `--ink-2` / `--ink-3` | `#1d1d1f` / `#6e6e73` / `#75757a` |
| `--line` / `--line-2` | `#d2d2d7` / `#e8e8ed` |
| `--primary` / `--primary-tint` | `#0066cc` / `#e8f1fb` |
| `--secondary` / `--secondary-tint` | `#5856d6` / `#eeeefb` |
| `--critical` / `--critical-bg` | `#d70015` / `#ffe9eb` |
| `--warning` / `--warning-bg` | `#b25000` / `#fff2e2` |
| `--good` / `--good-bg` | `#248a3d` / `#e6f6ea` |

  Map each to `--color-*` in `@theme inline`. Add `--radius-control: 6px; --radius-panel: 10px;`. Add the type roles as Tailwind 4 text tokens with their companions (`--text-<role>`, `--text-<role>--line-height`, `--text-<role>--font-weight`, `--text-<role>--letter-spacing`):

| Role | Size | Line height | Weight | Tracking |
|---|---|---|---|---|
| caption | 0.75rem | 1rem | 500 | 0.01em |
| label | 0.875rem | 1.25rem | 400 | 0 |
| body | 1rem | 1.5rem | 400 | 0 |
| title | 1.25rem | 1.625rem | 600 | -0.01em |
| page | 1.5rem | 1.875rem | 600 | -0.015em |
| figure | 2.125rem | 2.375rem | 600 | -0.02em |
| headline | 3rem | 3.25rem | 600 | -0.025em |

  Set `--font-sans: var(--font-inter), system-ui, sans-serif`. `html { color-scheme: light; }`. `body` background `--ground`. Focus ring: `3px solid var(--primary)`, offset 2px, radius 6px. Headings get `text-wrap: balance`. Keep the `summary`, `.chev` and `[data-pile]` rules.

- [ ] **Step 2: `app/layout.tsx`.** Keep the `Inter` import and variable. `viewport.themeColor` becomes the single string `"#f5f5f7"`. Update the comment (Inter is the one family on every device).
- [ ] **Step 3: Verify.** Run `npm run build`. Expected: build succeeds. It will warn or fail on removed classes (`bg-surface-2`, `bg-accent`, `var(--b-*)`); list them with `Grep` for `surface-2|accent|--b-|--s[1-6]|--idle|--day|--night|--bar` and leave them: Tasks 2, 9 and 10 remove every use. If the build fails on them, add nothing back; proceed, and the build gate moves to Task 9.
- [ ] **Step 4: Commit.** `git commit -am "feat(ui): light-only tokens, type roles, two-colour palette"`

---

### Task 2: UI primitives and the reference page

**Files:**
- Create: `components/ui/button.tsx`, `field.tsx`, `popover.tsx`, `panel.tsx`, `feedback.tsx`, `app/design-system/page.tsx`
- Modify: `components/dash/charts.tsx`, `components/dash/glyph.tsx`

**Interfaces:**
- Consumes: Task 1 utilities.
- Produces (all props extend the matching native element's props unless noted):
  - `Button({ variant?: "primary" | "secondary" | "quiet"; loading?: boolean })`: default `secondary`. Heights 36px. Pressed state on `:active` (scale 0.97, 100 ms).
  - `IconButton({ label: string })`: `label` becomes `aria-label`; 36px square.
  - `Field({ label: string; error?: string; children })`, `Input`, `Select`, `Checkbox({ label: string })`.
  - `SearchInput({ value: string; onChange: (v: string) => void; pending?: boolean; label: string; onSubmit?: () => void })`: `type="search"`, visible magnifier glyph, `pending` shows a small progress mark, Enter calls `onSubmit`.
  - `Popover({ id: string; children })` + trigger attribute helper `popoverTrigger(id): { popoverTarget: string }`: native `popover="auto"`, positioned under its trigger with CSS anchor positioning and a `position: fixed` fallback computed on `toggle`.
  - `Panel({ id?: string; title: string; subtitle?: string; glyph?: GlyphName; asOf?: AsOf; children })`: replaces `Section`; glyph drawn in `text-ink-2`, no coloured tile.
  - `Stat({ label: string; value: string; unit?: string; note?: ReactNode; tone?: "critical" | "warning"; size?: "figure" | "headline" })`: replaces `Figure`.
  - `AsOf({ asOf: AsOf })`: text "Data as of …", "Out of date: …" (critical colour plus the words), "Not loaded yet". Square-cornered text, no pill.
  - `Badge({ tone: "critical" | "warning" | "good" | "neutral"; children })`.
  - `Skeleton({ rows?: number })`, `Empty({ children; action? })`, `ErrorNote({ message: string; onRetry?: () => void })`.
  - Charts: `Bars` and `SplitBar` keep their signatures; `color` props now take only `--primary`, `--primary-tint`, `--secondary`, `--secondary-tint`, `--critical`, `--warning`, `--good`, `--line`.

- [ ] **Step 1: Read `reference/craft-floor.md`** (impeccable).
- [ ] **Step 2: Build the primitives** in the files above, each with default, hover, focus, pressed and disabled states (plus loading for `Button`, error for `Field`). Motion 150 to 200 ms, CSS only; `@media (prefers-reduced-motion: reduce)` removes transforms.
- [ ] **Step 3: Retoken `charts.tsx` and `glyph.tsx`.** Replace every removed token. Day series `--primary`, night series `--secondary`.
- [ ] **Step 4: `app/design-system/page.tsx`.** Server component. Call `auth()` from `@/auth`; if the session's role is not `admin`, `notFound()`. Render one section per component showing every variant and state, the colour tokens as swatches with their names, and the seven type roles with a sample line each.
- [ ] **Step 5: Verify by eye.** `npm run dev`, sign in as an admin, open `/design-system`. Run `.claude/skills/impeccable/scripts/impeccable shot /design-system` and open the capture. Check: one font, no radius other than 6px and 10px, focus ring visible on every control with Tab, colours only from the palette.
- [ ] **Step 6: Detector.** `.claude/skills/impeccable/scripts/impeccable detect --json components/ui app/design-system`. Fix mechanical findings.
- [ ] **Step 7: Commit.** `git add components app/design-system && git commit -m "feat(ui): design-system primitives and reference page"`

---

### Task 3: Postgres views and proof of parity

**Files:**
- Create: `prisma/migrations/<timestamp>_order_views/migration.sql`, `tests/fixtures/order-lines.ts`, `tests/db/views.test.ts`
- Modify: `tests/calc/dashboard.test.ts` (import fixtures), `.env.example` (document `TEST_DATABASE_URL`)

**Interfaces:**
- Produces three views (plain, not materialised):
  - `order_summary(prod_order text, customer text, cable text, approved boolean, done_conductor, done_insulation, done_laying, done_inner_sheath, done_armouring, done_outer_sheath, ordered_armouring double precision, insulated_cable_km double precision)`
  - `order_waiting(step text, prod_order text, customer text, cable text, km double precision)` with `step` in `insulation | laying | inner | armouring | outer`
  - `armouring_pending(prod_order text, customer text, cable text, km double precision, approved boolean, in_plan boolean)`
- Produces `parityLines: OrderLineRow[]` from `tests/fixtures/order-lines.ts`.

- [ ] **Step 1: Read the rules being ported.** `lib/dashboard/calc.ts` lines 33 to 90 (`EPS`, `summariseOrders`, `waitingBetween`, `waitingForLaying`, `armouringPending`) and `lib/dashboard/data.ts` lines 50 to 70 and 190 to 213 (prefix filter, step table, `in_plan` rule). Use `offset`/`limit` to see the bodies.
- [ ] **Step 2: Write the fixtures.** `parityLines` = the 9 existing lines from `tests/calc/dashboard.test.ts` lines 40 to 49, plus one order for each case: a later stage with more done than the earlier one (difference negative, must not appear); a difference of `0.0004` km (under `EPS`, must not appear); `customer: null`; `cable: null`; two lines of one order with `approved: true` and `approved: false`; a `prodOrder` not starting with `P7`; a cable that is in an open lot and one that is not. Change `tests/calc/dashboard.test.ts` to build its orders from `parityLines`, updating its expected values to match the wider set.
- [ ] **Step 3: Run the JS tests.** `npm test -- tests/calc`. Expected: PASS. These results are the oracle.
- [ ] **Step 4: Write the failing database test** `tests/db/views.test.ts`:

```ts
const url = process.env.TEST_DATABASE_URL;
// Refuse to run against the app database: this test deletes rows.
if (url && url === process.env.DATABASE_URL) throw new Error("TEST_DATABASE_URL must not equal DATABASE_URL");
if (!url) console.warn("SKIPPED tests/db/views.test.ts: set TEST_DATABASE_URL to a throwaway Postgres to prove view parity");

describe.skipIf(!url)("views match calc.ts", () => {
  // beforeAll: own PrismaClient on `url`; delete all rows from order_lines, lots, plan_jobs;
  // upsert setting kgp_order_prefix = "P7"; insert parityLines; one open lot and one open
  // plan job for the "in plan" cable.
  const orders = summariseOrders(parityLines.filter((l) => l.prodOrder.startsWith("P7")));

  it.each([
    ["insulation", () => waitingBetween(orders, "CONDUCTOR", "INSULATION")],
    ["laying", () => waitingForLaying(orders)],
    ["inner", () => waitingBetween(orders, "LAYING", "INNER_SHEATH")],
    ["armouring", () => waitingBetween(orders, "INNER_SHEATH", "ARMOURING")],
    ["outer", () => waitingBetween(orders, "ARMOURING", "OUTER_SHEATH")],
  ])("order_waiting step %s", async (step, js) => {
    const sql = await db.$queryRaw`SELECT prod_order, km FROM order_waiting WHERE step = ${step} ORDER BY prod_order`;
    const want = js().map((r) => [r.prodOrder, r.km]).sort();
    expect(sql.map((r) => r.prod_order)).toEqual(want.map((w) => w[0]));
    sql.forEach((r, i) => expect(r.km).toBeCloseTo(want[i][1] as number, 3));
  });

  it("armouring_pending: rows, km, approved, in_plan", async () => { /* same shape, vs armouringPending(orders) + the in_plan rule */ });
  it("customer and cable are the first non-empty value by stage order then sfg_item", async () => { /* assert exact strings */ });
});
```

- [ ] **Step 5: Run it.** Create a throwaway database (a Neon branch or local Postgres), `DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy`, then `npm test -- tests/db`. Expected: FAIL, relation `order_waiting` does not exist.
- [ ] **Step 6: Write the migration.** `npx prisma migrate dev --create-only --name order_views`, then write the three `CREATE VIEW` statements. Rules:
  - Kharagpur filter: `prod_order LIKE prefix || '%'` where prefix is `settings.value #>> '{}'` for key `kgp_order_prefix`; if that setting is missing or not a string, all orders.
  - `order_summary` sums `done_qty` and `ordered_qty` per order and stage exactly as `summariseOrders` does, including its `insulatedCableKm` rule (smallest of core km done ÷ `cores_per_cable` over the order's core lines). Do not add the "conductor used by two items counted once" rule; today's code does not have it (spec 7.4).
  - `customer` and `cable`: first non-empty value ordered by stage position (`CONDUCTOR, INSULATION, LAYING, INNER_SHEATH, ARMOURING, OUTER_SHEATH`) then `sfg_item`; fall back to the same empty-value handling the JS uses.
  - `order_waiting` keeps only `km > 0.0005`.
  - `in_plan`: `lower(trim(cable))` equals `lower(trim(cable_item))` of any lot with `completed = false` or plan job with `mark_complete = false`.
- [ ] **Step 7: Run again.** Apply the migration to the test database, `npm test -- tests/db`. Expected: PASS.
- [ ] **Step 8: Compare on real data, once.** Against the development database, run a one-off script (in the scratchpad, not committed) that computes the five waiting lists and the pending list both ways and prints the count of differing rows and the largest km difference. Expected: 0 rows differ, largest difference under 0.001. Report the two numbers in the task hand-off. If they differ, stop and report; do not continue to Task 8.
- [ ] **Step 9: Commit.** `git add prisma tests .env.example && git commit -m "feat(db): order views with parity proof against calc.ts"`

---

### Task 4: Table definitions, params, query builder

**Files:**
- Create: `lib/tables/defs.ts`, `lib/tables/params.ts`, `lib/tables/query.ts`
- Test: `tests/tables/params.test.ts`, `tests/tables/query.test.ts`

**Interfaces:**
- Produces:

```ts
// defs.ts
export const TABLE_NAMES = ["cable-ready","wait-inner","wait-laying","wait-insulation","wait-outer","work-left","lots","entries"] as const;
export type TableName = (typeof TABLE_NAMES)[number];
export type ColumnKind = "text" | "bool" | "day" | "number" | "time";   // text, bool, day: filter dropdown. number, time: sort only.
export type ColumnDef = { key: string; label: string; expr: Prisma.Sql; kind: ColumnKind; search?: boolean; array?: boolean };
export type TableDef = {
  name: TableName; title: string; unit?: string;
  from: (machine: string, today: string) => Prisma.Sql;   // FROM … WHERE <fixed scope>
  columns: ColumnDef[];
  defaultSort: { key: string; dir: "asc" | "desc" }[];
  tiebreak: Prisma.Sql;            // appended to every ORDER BY so paging is stable
  defaultSize: 5 | 10;
};
export const TABLES: Record<TableName, TableDef>;
export type ClientColumn = { key: string; label: string; kind: ColumnKind };
export function clientColumns(def: TableDef): ClientColumn[];

// params.ts
export type TableParams = { machine: string; page: number; size: number; sort: string | null; dir: "asc" | "desc"; q: string; filters: Record<string, string[]> };
export const PAGE_SIZES = [5, 10, 25, 50] as const;
export function defaultParams(def: TableDef, machine: string): TableParams;
export function parseTableParams(def: TableDef, sp: URLSearchParams): TableParams;   // throws ZodError

// query.ts
export type Row = Record<string, string | number | boolean | null>;
export function buildWhere(def: TableDef, p: TableParams, exceptColumn?: string): Prisma.Sql;
export function buildOrderBy(def: TableDef, p: TableParams): Prisma.Sql;
export function fetchRows(def: TableDef, p: TableParams): Promise<{ rows: Row[]; total: number }>;
export function fetchFacet(def: TableDef, column: string, p: TableParams, oq: string, offset: number): Promise<{ options: { value: string; count: number }[]; hasMore: boolean }>;
export const BLANK = "";   // filter value meaning NULL or empty string; the UI labels it "(blank)"
```

- Table contents (spec 7.1). `from` scope in brackets:

| name | columns: key (kind) | default sort | size |
|---|---|---|---|
| `cable-ready` [`order_waiting` step `armouring`] | `prodOrder` (text, search), `customer` (text, search), `cable` (text, search), `km` (number) | km desc | 10 |
| `wait-inner` / `wait-laying` / `wait-insulation` / `wait-outer` [steps `inner` / `laying` / `insulation` / `outer`] | same; `wait-insulation` has `unit: "core km"` | km desc | 5 |
| `work-left` [`armouring_pending`] | `prodOrder`, `customer`, `cable` (text, search), `km` (number), `approved` (bool), `inPlan` (bool) | km desc | 10 |
| `lots` [`lots` where `machine_code = machine and completed = false`] | `lotNo`, `cableItem`, `armourType`, `armourSize` (text, search), `bobbinsNeeded`, `bobbinsWound`, `balance` = needed − wound (number), `approved` (bool) | priority asc nulls last, lotNo asc | 10 |
| `entries` [`production_entries` where `machine_code = machine and shift_day >= first of the last N shift days`] | `shiftDay` (day), `shift` (text), `enteredAt` (time), `prodOrders` (text, search, `array: true`), `cable` (text, search), `drumNo` (text, search), `qtyM` (number), `enteredBy` (text, search), `isDuplicate` (bool) | enteredAt desc | 10 |

  N for `entries` is the `latest_entries_shift_days` setting (default 7); `today` comes from `getToday()` in `lib/dashboard/data.ts`, and the first day from `lastShiftDays(today, n)[0]`.

- [ ] **Step 1: Write the failing param tests** (`tests/tables/params.test.ts`), with `def = TABLES["work-left"]`:

```ts
const parse = (qs: string) => parseTableParams(def, new URLSearchParams(qs));
it("defaults", () => expect(parse("machine=ARM5")).toEqual({ machine: "ARM5", page: 1, size: 10, sort: null, dir: "desc", q: "", filters: {} }));
it("repeated f.<col> params; values may contain commas", () =>
  expect(parse("machine=ARM5&f.cable=3C%20x%20240%2C%20AL&f.cable=4C").filters).toEqual({ cable: ["3C x 240, AL", "4C"] }));
it("blank filter value is kept", () => expect(parse("machine=ARM5&f.customer=").filters).toEqual({ customer: [""] }));
it.each(["size=1000", "size=7", "page=0", "page=abc", "sort=password", "dir=up", "f.km=1", "f.nope=x", "machine=", "q=" + "x".repeat(201)])(
  "rejects %s", (bad) => expect(() => parse("machine=ARM5&" + bad)).toThrow());
it("trims q", () => expect(parse("machine=ARM5&q=%20tata%20").q).toBe("tata"));
```

- [ ] **Step 2: Run.** `npm test -- tests/tables/params`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement `defs.ts` and `params.ts`.** Rules the tests pin: `size` must be one of `PAGE_SIZES`; `sort` must be a column key of the table; `f.<key>` allowed only for kinds `text`, `bool`, `day`; `machine` 1 to 20 chars of `[A-Za-z0-9_-]`; `q` at most 200 chars; `bool` filter values only `"true"` or `"false"`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Write the failing builder tests** (`tests/tables/query.test.ts`). `Prisma.Sql` exposes the statement text and its bound values (confirm the property names on the generated client's `Sql` class; `sql` and `values` in Prisma 7). Assert on those; no database needed.

```ts
const p = (over: Partial<TableParams>) => ({ ...defaultParams(TABLES["work-left"], "ARM5"), ...over });
it("search is bound, escaped and literal", () => {
  const w = buildWhere(def, p({ q: "50%_o'k\\" }));
  expect(w.values).toContain("%50\\%\\_o'k\\\\%");
  expect(w.sql).not.toContain("50%");            // never inlined
  expect(w.sql).toMatch(/ILIKE/);
});
it("search covers only search columns", () => expect(buildWhere(def, p({ q: "x" })).values).toHaveLength(3));
it("filter values are bound", () => {
  const w = buildWhere(def, p({ filters: { customer: ["A'; DROP TABLE users;--"] } }));
  expect(w.sql).not.toContain("DROP"); expect(w.values.flat()).toContain("A'; DROP TABLE users;--");
});
it("blank filter matches NULL and empty", () => expect(buildWhere(def, p({ filters: { customer: [""] } })).sql).toMatch(/IS NULL/));
it("exceptColumn drops that column's own filter", () =>
  expect(buildWhere(def, p({ filters: { customer: ["A"], cable: ["B"] } }), "customer").values.flat()).toEqual(["B"]));
it("array column filter uses containment", () =>
  expect(buildWhere(TABLES.entries, { ...defaultParams(TABLES.entries, "ARM5"), filters: { prodOrders: ["P7-1"] } }).sql).toMatch(/&&|= ANY/));
it("order by: default, chosen, always ends with the tiebreak", () => {
  expect(buildOrderBy(def, p({})).sql).toMatch(/km.*DESC/i);
  expect(buildOrderBy(def, p({ sort: "customer", dir: "asc" })).sql).toMatch(/customer.*ASC.*prod_order/is);
});
```

- [ ] **Step 6: Run.** Expected: FAIL.
- [ ] **Step 7: Implement `query.ts`.** Compose only `Prisma.sql` fragments; identifiers come only from `ColumnDef.expr` and `TableDef.from`; never `Prisma.raw` on request input. Search: `expr ILIKE ${pattern} ESCAPE '\'` joined with OR over `search` columns (array columns: `array_to_string(expr, ' ')`). `fetchRows`: one query for the page (`LIMIT size OFFSET (page-1)*size`), one `count(*)`. `fetchFacet`: `SELECT expr AS value, count(*) … WHERE buildWhere(def, p, column) [AND value ILIKE oq] GROUP BY 1 ORDER BY count DESC, 1 LIMIT 51 OFFSET offset`; return 50 and `hasMore`; NULL and empty collapse to `BLANK`; array columns `unnest`; `bool` values as `"true"`/`"false"`; `day` as `YYYY-MM-DD`. Convert `bigint` counts to `number`.
- [ ] **Step 8: Run all.** `npm test -- tests/tables`. Expected: PASS.
- [ ] **Step 9: Database check.** Add to `tests/db/views.test.ts` (same skip rule): with `parityLines` loaded, `fetchRows(TABLES["work-left"], …)` page 1 size 5 returns 5 or fewer rows, `total` equals `armouringPending(orders).length`, rows are km-descending; `fetchFacet(…, "customer", …)` returns a `BLANK` option for the null-customer order and its counts sum to `total`. Run `npm test -- tests/db`. Expected: PASS.
- [ ] **Step 10: Commit.** `git add lib/tables tests && git commit -m "feat(tables): whitelisted server-side paging, sort, search and facets"`

---

### Task 5: Route handlers

**Files:**
- Create: `app/api/tables/[table]/route.ts`, `app/api/tables/[table]/facets/route.ts`
- Test: `tests/tables/routes.test.ts`

**Interfaces:**
- Consumes: `TABLES`, `parseTableParams`, `fetchRows`, `fetchFacet` (Task 4).
- Produces:
  - `GET /api/tables/:table?machine&page&size&sort&dir&q&f.<col>` → `200 { rows: Row[], total: number }`
  - `GET /api/tables/:table/facets?column&oq&offset` plus the same params → `200 { options: { value: string, count: number }[], hasMore: boolean }`
  - `404 { error: "Unknown table" }`, `400 { error: "Bad request" }` (no zod detail in the body), `500 { error: "Could not load" }` with the error logged server-side.
  - Both export a pure `handle(table: string, sp: URLSearchParams, deps = { fetchRows | fetchFacet })` returning `Response`, so tests need no database or server.

- [ ] **Step 1: Write the failing tests** against `handle` with a stub `fetchRows`/`fetchFacet`:

```ts
it("unknown table is 404 and the query function is not called", …);
it.each(["size=1000", "sort=password", "page=abc"])("%s is 400 and the query function is not called", …);
it("valid request returns rows and total from the query function", …);
it("facets: column must be a filterable column of that table, else 400", …);   // column=km → 400
it("a thrown query error is 500 with no error text leaked", …);
```

- [ ] **Step 2: Run.** `npm test -- tests/tables/routes`. Expected: FAIL.
- [ ] **Step 3: Implement** both handlers per the Next 16 route-handler guide read in Task 0 (dynamic `params` shape as the guide gives it). Responses are not cached (`Cache-Control: no-store`). No auth check: the dashboard page is public and these return only what it shows.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Smoke test.** `npm run dev`, then `curl "http://localhost:3000/api/tables/work-left?machine=ARM5&size=5"`. Expected: JSON with at most 5 rows and a `total`. `curl -i ".../api/tables/work-left?machine=ARM5&sort=password"` → `400`.
- [ ] **Step 6: Commit.** `git add app/api tests && git commit -m "feat(api): table rows and facet endpoints"`

---

### Task 6: Client request logic (no React)

**Files:**
- Create: `lib/tables/client.ts`
- Test: `tests/tables/client.test.ts`

**Interfaces:**
- Produces:

```ts
export const SEARCH_DEBOUNCE_MS = 700;
export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms?: number): { call: (...a: A) => void; flush: () => void; cancel: () => void };
/** Runs one request at a time: starting a new one aborts the last; a superseded result is dropped. */
export function createLatest<T>(): { run: (job: (signal: AbortSignal) => Promise<T>) => Promise<T | undefined>; cancel: () => void };
export function tableUrl(table: string, p: TableParams, facet?: { column: string; oq: string; offset: number }): string;
/** Last valid page for a total; used to step back when a list shrinks. */
export function clampPage(page: number, size: number, total: number): number;
```

- [ ] **Step 1: Write the failing tests** (`vi.useFakeTimers()`):

```ts
it("nothing fires before 700 ms; one call after, with the last arguments", () => {
  const fn = vi.fn(); const d = debounce(fn);
  d.call("t"); d.call("ta"); d.call("tat"); vi.advanceTimersByTime(699); expect(fn).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1); expect(fn).toHaveBeenCalledExactlyOnceWith("tat");
});
it("flush fires at once; cancel fires nothing", …);
it("a slow first request resolving after a second is dropped and was aborted", async () => {
  const l = createLatest<string>(); let sig1!: AbortSignal;
  const first = l.run((s) => { sig1 = s; return new Promise((r) => setTimeout(() => r("old"), 500)); });
  const second = l.run(() => Promise.resolve("new"));
  vi.advanceTimersByTime(500);
  expect(await second).toBe("new"); expect(await first).toBeUndefined(); expect(sig1.aborted).toBe(true);
});
it("tableUrl repeats f.<col>, encodes commas, omits defaults-free empties", () =>
  expect(tableUrl("work-left", { machine: "ARM5", page: 2, size: 10, sort: "km", dir: "asc", q: "a b", filters: { cable: ["3C, AL", ""] } }))
    .toBe("/api/tables/work-left?machine=ARM5&page=2&size=10&sort=km&dir=asc&q=a+b&f.cable=3C%2C+AL&f.cable="));
it.each([[3, 10, 12, 2], [1, 10, 0, 1], [2, 10, 20, 2], [5, 10, 41, 5]])("clampPage(%i,%i,%i) = %i", …);
```

- [ ] **Step 2: Run.** `npm test -- tests/tables/client`. Expected: FAIL.
- [ ] **Step 3: Implement `lib/tables/client.ts`.** An `AbortError` from a superseded request resolves to `undefined`; any other error rejects.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add lib/tables/client.ts tests && git commit -m "feat(tables): 700ms debounce, latest-wins requests"`

---

### Task 7: `DataTable`

**Files:**
- Create: `components/ui/data-table.tsx`
- Modify: `app/design-system/page.tsx` (add a live table)

**Interfaces:**
- Consumes: Task 2 primitives; `ClientColumn`, `Row`, `TableParams`, `PAGE_SIZES`, `BLANK` (Task 4); `debounce`, `createLatest`, `tableUrl`, `clampPage`, `SEARCH_DEBOUNCE_MS` (Task 6).
- Produces:

```ts
"use client";
export function DataTable(props: {
  table: TableName; machine: string; title: string;          // title labels the search box and the <table> caption
  columns: ClientColumn[]; initial: { rows: Row[]; total: number };
  defaultSort: { key: string; dir: "asc" | "desc" }; defaultSize: 5 | 10;
  version: string;                                            // the block's data-as-of ISO time
  unit?: string;
}): JSX.Element;
```

- Cell formatting by column `kind`: `number` right-aligned, `.num`, via `km()`/`int()` from `@/lib/format` (integers for `bobbins*`, `balance`, `qtyM`); `time` via `time()`; `day` via `shortDay()`; `bool` as `Badge` "Yes"/"No" (`approved: false` → warning "Not approved"; `isDuplicate: true` → warning "Duplicate"); `text` blank → "–".

- [ ] **Step 1: Read `reference/craft-floor.md`.**
- [ ] **Step 2: Build the component.** Behaviour, all from spec 7.2:
  - State: `page, size, sort, dir, q, filters`, seeded from the defaults; `initial` is used only for the first render.
  - Search: `SearchInput` updates `q` text at once and sets `pending`; the fetch is `debounce(…, SEARCH_DEBOUNCE_MS)`; Enter calls `flush`.
  - Any change to `q`, `filters`, `sort`, `dir` or `size` sets `page = 1`.
  - Fetch through one `createLatest`; while loading, keep old rows at reduced opacity with `aria-busy`; rows have a fixed height so the panel does not jump.
  - When `version` changes (not on first mount), refetch with current state. If the response's `total` makes the page invalid, set `page = clampPage(…)` and refetch.
  - Column head: a button (`aria-haspopup`) opening a `Popover` with "Sort ascending", "Sort descending", and for `text | bool | day` columns the filter list. `<th scope="col" aria-sort>` reflects the sort; an active filter marks the head in `primary` with a count.
  - Filter list: fetched from the `facets` endpoint when the popover opens (and again when `q` or other filters change while open); each option is a `Checkbox` with its count; `BLANK` shows as "(blank)"; a search box inside appears when `hasMore` or more than 10 options, debounced the same 700 ms; "Show more" loads the next 50.
  - Toolbar: search left; "Clear filters" (quiet button) right, only when a filter or search is active.
  - Footer: "1–10 of 137", page-size `Select`, Previous / Next buttons (disabled at the ends).
  - States: `Empty` with "No rows match." and a Clear filters action when filtered; `ErrorNote` with Retry on a failed request (old rows stay).
  - Narrow screens: the table scrolls sideways in its own container; first column `position: sticky; left: 0`.
- [ ] **Step 3: Add a live example** to `/design-system`: `work-left` for the first machine, `initial` from `fetchRows`.
- [ ] **Step 4: Verify by hand** on `/design-system` with the network panel open. Each must hold:
  1. Typing "tata" quickly sends exactly one `rows` request, about 700 ms after the last key; the pending mark shows from the first key.
  2. Opening a column menu sends one `facets` request; its counts change after a search is applied.
  3. Choosing a filter returns to page 1 and the footer total drops.
  4. Next/Previous send `page=2`, `page=1`; no request carries more than `size` rows back.
  5. Tab reaches search, each column head, each menu item, the page-size select and both page buttons; Escape closes a menu and returns focus to its head.
  6. With the dev server stopped mid-session, a page change shows the error note and Retry works after restart.
- [ ] **Step 5: Capture and detect.** `impeccable shot /design-system`; `impeccable detect --json components/ui`. Fix mechanical findings.
- [ ] **Step 6: Commit.** `git add components/ui app/design-system && git commit -m "feat(ui): server-driven DataTable with column menus"`

---

### Task 8: Dashboard data reads the views

**Files:**
- Modify: `lib/dashboard/data.ts` (lines 50 to 70, 190 to 226), `lib/dashboard/calc.ts` (lines 7 to 90), `tests/calc/dashboard.test.ts`, `tests/db/views.test.ts`

**Interfaces:**
- Consumes: the three views (Task 3). Do not start unless Task 3 Step 8 reported zero differences.
- Produces (replacing today's shapes; `rows` arrays are gone):

```ts
getWaiting(): Promise<{ steps: { key: "insulation"|"laying"|"inner"|"armouring"|"outer"; before: Stage; unit: "core km"|"km"; km: number; count: number }[]; asOf: AsOf; hasData: boolean }>
getWorkLeft(machineCode): Promise<{ total: number; count: number; days: number | null; notInPlan: number; notApproved: number; avgKmPerDay: number | null; hasData: boolean; asOf: AsOf }>
getEntryDays(machineCode): Promise<{ days: { day: string; km: number; entries: number; duplicates: number }[]; hasData: boolean; asOf: AsOf }>   // replaces getLatestEntries; km excludes duplicates
getBobbins(machineCode)   // unchanged except `lots` is removed from the result
```

- [ ] **Step 1: Pin today's figures.** Before changing code, add to `tests/db/views.test.ts` (same skip rule) expectations computed from the JS oracle on `parityLines`: per step `sumKm(rows)` and `rows.length`; for work left `total`, `notInPlan`, `notApproved`, `count`. Write them as assertions on the new `getWaiting`/`getWorkLeft` shapes. Run `npm test -- tests/db`. Expected: FAIL (shapes not there yet).
- [ ] **Step 2: Rewrite the three functions** to aggregate in SQL: `SELECT step, sum(km), count(*) FROM order_waiting GROUP BY step` (steps with no rows return km 0, count 0, in today's step order); `SELECT sum(km), count(*), sum(km) FILTER (WHERE NOT in_plan), sum(km) FILTER (WHERE NOT approved) FROM armouring_pending`; entry days grouped by `shift_day` over the same window as the `entries` table. `hasData` for orders: `EXISTS` on `order_lines` under the prefix filter. Keep `asOf` logic and `React.cache` wrappers.
- [ ] **Step 3: Run.** `npm test -- tests/db`. Expected: PASS.
- [ ] **Step 4: Delete the JS owners.** Remove `summariseOrders`, `waitingBetween`, `waitingForLaying`, `armouringPending`, `OrderSummary`, `WaitingRow`, `biggestFirst`, `row`, `EPS` and `kgpOrders`; keep `sumKm` only if still used. Move the oracle copies the database test needs into `tests/fixtures/order-rules.ts` (test-only), and point `tests/db/views.test.ts` and the "waiting cable" block of `tests/calc/dashboard.test.ts` at it.
- [ ] **Step 5: Run everything.** `npm test`. Expected: PASS. `npx tsc --noEmit` will fail in `_blocks/*` where `rows`/`lots` were read; that is Task 9's work. Confirm the only errors are in `app/dashboard/[machine]/_blocks/`.
- [ ] **Step 6: Commit.** `git commit -am "refactor(data): totals read from order views; JS order rules become test oracle"`

---

### Task 9: Rebuild the dashboard

**Files:**
- Modify: `app/dashboard/[machine]/page.tsx`, `_blocks/summary.tsx`, `pipeline.tsx`, `waiting.tsx`, `output.tsx`, `bobbins.tsx`, `work.tsx`, `components/dash/top-bar-controls.tsx`, `components/dash/block-boundary.tsx`
- Delete: `components/dash/orders-table.tsx`, `components/dash/section.tsx`

**Interfaces:**
- Consumes: Task 2 primitives, `DataTable` (Task 7), `TABLES`, `clientColumns`, `defaultParams`, `fetchRows` (Task 4), data shapes (Task 8).
- Each block that owns a table renders, on the server:

```tsx
const def = TABLES["cable-ready"];
const initial = await fetchRows(def, defaultParams(def, machineCode));
<DataTable table={def.name} machine={machineCode} title={def.title} columns={clientColumns(def)} initial={initial}
  defaultSort={def.defaultSort[0]} defaultSize={def.defaultSize} version={asOf.at?.toISOString() ?? "never"} unit={def.unit} />
```

- [ ] **Step 1: Read `reference/craft-floor.md`.** Read each block's current body (use `offset`/`limit`) and list every figure, label, note and conditional message it shows. That list is the checklist for Step 8.
- [ ] **Step 2: Page shell and top bar** (`page.tsx`, `top-bar-controls.tsx`). Sticky translucent bar: `Select` machine picker left, data-as-of and `Button` Refresh right; `backdrop-filter: blur(20px) saturate(180%)` on `rgba(255,255,255,0.72)`, solid white under `prefers-reduced-transparency`. Jump links as quiet text links. Content max width 1200px, 24px gutters (16px on phones), 24px between panels.
- [ ] **Step 3: Header line** (`summary.tsx`). Four `Stat size="headline"` in one row (2×2 under 900px), in question order: cable ready (km, days), men and output (men, km, latest day), bobbins to wind, work left (km, days). Same values and notes as today.
- [ ] **Step 4: Pipeline strip** (`pipeline.tsx`). Left-to-right steps with km waiting before each; chosen machine in `primary`, slowest step in `critical` with the word "Slowest", a machine with no work in `secondary` with the rules-doc wording. Uses `getWaiting().steps[].km`.
- [ ] **Step 5: Waiting blocks** (`waiting.tsx`). `CableReady`: `Panel` + stats + `DataTable` `cable-ready`. `Upstream`: four `Panel`s in rules-doc order, each with its total and count from `getWaiting()` and a `DataTable` (`wait-inner`, `wait-laying`, `wait-insulation`, `wait-outer`).
- [ ] **Step 6: Output, bobbins, work** (`output.tsx`, `bobbins.tsx`, `work.tsx`). Output blocks: same charts on new tokens. Bobbins: stats, pool `SplitBar` (usable states in `primary`/`primary-tint`, `secondary`/`secondary-tint`; badly wound, workshop → `warning`; broken → `critical`; every segment labelled), `DataTable` `lots`. Work left: stats and plan/approval `SplitBar`, `DataTable` `work-left`. Latest entries: day strip from `getEntryDays()` (one cell per shift day: day, km, entries; duplicates noted), then `DataTable` `entries`.
- [ ] **Step 7: Loading and errors.** `Block` uses `Skeleton` inside a `Panel`-shaped shell; `BlockBoundary` renders `ErrorNote`. Delete `orders-table.tsx` and `section.tsx`; `Grep` confirms no imports remain.
- [ ] **Step 8: Verify.**
  - `npx tsc --noEmit && npm run lint && npm test && npm run build`. Expected: all pass.
  - `Grep` for `#[0-9a-fA-F]{3,6}` in `app` and `components` (excluding `globals.css`): no matches. `Grep` for `rounded-\[|rounded-full|rounded-xl|rounded-2xl`: no matches.
  - Figures: with the dev database, open `main` in one tab and the branch in another; every item on the Step 1 checklist shows the same value. Record any mismatch and stop.
  - Network panel on first load: no `/api/tables` request (first pages are in the HTML). Press Refresh: tiles and each table reload.
  - `.claude/skills/impeccable/scripts/impeccable first-viewport /dashboard/ARM5 --thesis <header-line selector> --action <machine select selector> --capture .impeccable/review`; open `desktop.png` and `mobile.png` and compare with spec section 8.
- [ ] **Step 9: Commit.** `git add -A app components && git commit -m "feat(dashboard): rebuild on the design system with server-driven tables"`

---

### Task 10: Login and signup

**Files:**
- Modify: `components/auth-shell.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`

**Interfaces:**
- Consumes: `Button`, `Field`, `Input`, `Panel`, `ErrorNote` (Task 2).
- Produces: `AuthShell({ title, subtitle, children })` unchanged in signature. `inputClass`, `primaryButton`, `secondaryButton`, `Field`, `FormError` exports are removed; callers use the `ui` components.

- [ ] **Step 1: Read `reference/craft-floor.md`.** Read both pages' bodies and note every field, button, link and error path.
- [ ] **Step 2: Rebuild** `AuthShell` as a centred 400px `Panel` on the ground colour, page title in `text-page`. Swap fields and buttons for the `ui` components. Form actions, names, validation and redirects stay exactly as they are.
- [ ] **Step 3: Verify.** `npx tsc --noEmit && npm run build`. By hand: sign up, sign out, sign in, wrong password shows the error under the form, Google button (if `googleEnabled`) still starts the flow. `impeccable shot /login`.
- [ ] **Step 4: Commit.** `git commit -am "feat(auth): login and signup on the design system"`

---

### Task 11: Finish review and DESIGN.md

**Files:**
- Create: `DESIGN.md`, `.impeccable/design.json` (written by the impeccable documenter, not by hand)

- [ ] **Step 1: Final captures.** Rerun the `first-viewport` command from Task 9 Step 8; also capture `/login` and `/design-system`. Open each file and confirm it shows what its name says (no blank regions, no half-loaded tables).
- [ ] **Step 2: Detector.** `.claude/skills/impeccable/scripts/impeccable detect --json app components`. Fix mechanical findings; keep the rest for the reviewer.
- [ ] **Step 3: Finish reviewer.** Spawn `impeccable-finish-reviewer` fresh (no conversation history) with: the user's original request, the confirmed answers (two colours, projector/TV plus laptop, Postgres paging, indigo secondary, Inter, sort-only numbers), the artifact paths, the screenshot paths, the direction contract from the surface brief, remaining detector findings, `reference/craft-floor.md`, and the line "code-led build; no image generation; no approved comp". Act on its disposition word as `reference/new-work.md` section 7 directs: `fix` → one batch, recapture, verdict; `ship` → continue.
- [ ] **Step 4: Documenter.** Spawn `impeccable-documenter` with the project root, artifact paths, direction contract, `PRODUCT.md`, `reference/document.md` and the write boundary (repo root). Confirm `DESIGN.md` and `.impeccable/design.json` exist and carry tokens, not prose alone.
- [ ] **Step 5: Final gate.** `npm test && npm run lint && npm run build`. Expected: all pass.
- [ ] **Step 6: Commit.** `git add DESIGN.md .impeccable && git commit -m "docs: DESIGN.md from the finished build"`
- [ ] **Step 7: Report** to the user: the reviewer's verdict at its real scope, the Task 3 Step 8 parity numbers, anything skipped, and how to open the result (`npm run dev`, `/dashboard/ARM5`, `/design-system`).

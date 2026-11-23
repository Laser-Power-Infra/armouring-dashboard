# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The Kharagpur plant team in the morning meeting (07:30 onwards). The dashboard is read on a projector or TV with one person driving, and on each person's own laptop or desktop. Phone use is secondary: the screen must still work on a phone (rules doc §7.4), but it is not the main reading setup.

Roles: `viewer` (default) and `admin`. The dashboard itself is readable without login.

## Product Purpose

Help the team decide what an armouring machine does today and what must be made ready for it. Armouring 5 is the slowest step in the plant, so every hour it waits is lost output.

It answers four questions, in this order:

1. Is there cable ready for the machine? (km waiting, days of work)
2. Did the men produce? (men posted, km made)
3. Are the bobbins ready? (bobbins still to wind for the running and next jobs)
4. How much work is left? (km still to armour, days)

A reader should be able to stop at any point and still have the most important facts.

## Operating Context

- Data is a loaded snapshot, refreshed before the meeting and at fixed times in the day. Sources: SFG dashboard (order lines, production entries, stock), ERP men posting, Google Sheets (plan, lots, bobbin logs).
- The machine is a choice on the screen; the same dashboard serves Armouring 1, 4, 5 and 6.
- Full rules: `Armouring_5_Dashboard_Flow_and_Rules.md`.

## Capabilities and Constraints

- Screen order follows the four questions: header line, cable ready, three upstream waiting lists, waiting for outer sheath, output by step, men vs production, bobbins, work left, latest entries (rules doc §5).
- Every block shows its "data as of" time.
- Show the customer's name, not only the order number.
- Biggest items first is the default order in every table.
- No Gantt charts. Tiles and a day-by-day board.
- A machine with no work: write that its men "can be utilized for some other purposes". Never "free" or "idle".
- The slowest machine is shown in red; a machine with no work is shown in a different colour. Status colour is always paired with a text label.
- Every table is paged, sorted, searched and filtered by the server; the browser never holds a full list. Paging for the order lists is computed in Postgres. Filter options for each column come from the server. Search waits at least 700 ms after typing stops.
- Stack: Next.js 16, React 19, Tailwind 4, Prisma 7 on Postgres (Neon), NextAuth. Schema changes go through migration files only.

## Brand Commitments

Decided by the user on 2026-11-19; these replace the "colourful screen, a different colour for each block" line in rules doc §7.4:

- One primary colour and one secondary colour. Blocks are told apart by title, icon and position, not by colour. Red, amber and green remain for status only.
- Apple-like user experience: simple, restrained.
- Light mode only for now.
- One professional typeface; no decorative or mixed fonts.
- Rounded corners used sparingly.

## Product Principles

1. Answer the four questions in order; the most important fact is always the most obvious thing on screen.
2. Readable from across a meeting room first, detailed at a desk second.
3. Numbers must match the rules doc exactly; presentation never changes a figure.
4. Colour carries meaning (status) or nothing.
5. Stale data is always visible as stale.

## Accessibility & Inclusion

Status is never shown by colour alone. Keyboard focus is always visible. Motion respects the reduced-motion setting.

---
version: 1
slug: "app-dashboard-machine-page-tsx"
primary_target: "app/dashboard/[machine]/page.tsx"
related_targets: ["app/(auth)/login/page.tsx","app/(auth)/signup/page.tsx"]
---

Scope: dashboard, login, signup. Visitor mode: Operate.

Audience and job: the Kharagpur morning meeting, on a projector or TV and on laptops, deciding what the armouring machine does today. Task: read the four answers, then find the order behind a number.

## Direction contract

THESIS: The four meeting questions answered at headline size, in order, before any control is visible. Refuses the tile-wall dashboard where every block shouts in its own colour.

OWN-WORLD: Apple-style light interface. Ground #f5f5f7, white flat panels with a hairline, ink #1d1d1f. Blue #0066cc for action and selection, indigo #5856d6 for the second series and the no-work state, red/amber/green for status only. Inter, fixed role scale, tabular figures. Radius 6px controls, 10px panels, square tables.

STORY: The reader learns whether the machine has cable, whether the men produced, whether bobbins are ready and how much work is left; then opens a table to find the order behind a number.

FIRST VIEWPORT: Translucent sticky bar across the full width (machine select, jump links, Refresh, account). Below it the machine name, then one row of four headline figures at 48px with a one-line note each. Below that the pipeline strip, left to right, chosen machine marked in blue. Each panel carries its own data-as-of time; the bar carries none. The page is full width: tables sit two across from 1440px and three across from 2200px (user feedback, 2026-11-19). Primary action: the machine select, top left.

FORM: Standard web product shell and controls; signature move is the pipeline strip. seed: none (pinned) — world pinned by the user: "focus in on user exeperience like apple and simplicity", "one primary colour one secondary colour", "dark mode is not required for now start with light mode", "rounded corner should not be overused"; first-surface experience pinned by the rules doc the user supplied (section 5): "The order on the screen follows the order of the four questions. A user should be able to stop reading at any point and still have the most important facts.", and by the user: "remove the left right padding for big screens and we can show tables in grid view. like 2 tables sideby side or 3 if its very large screen".

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

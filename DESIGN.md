---
name: Armouring Dashboard
description: The Kharagpur morning-meeting board. Four answers at headline size, then the tables behind them.
colors:
  primary: "#0066cc"
  primary-tint: "#e8f1fb"
  secondary: "#5856d6"
  secondary-tint: "#eeeefb"
  secondary-soft: "#908ee8"
  ground: "#f5f5f7"
  surface: "#ffffff"
  ink: "#1d1d1f"
  ink-2: "#6e6e73"
  ink-3: "#75757a"
  line: "#d2d2d7"
  line-2: "#e8e8ed"
  critical: "#d70015"
  critical-bg: "#ffe9eb"
  warning: "#b25000"
  warning-bg: "#fff2e2"
  good: "#248a3d"
  good-bg: "#e6f6ea"
typography:
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 600
    lineHeight: "3.25rem"
    letterSpacing: "-0.025em"
    fontFeature: "tnum"
  figure:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "2.125rem"
    fontWeight: 600
    lineHeight: "2.375rem"
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  page:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: "1.875rem"
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: "1.625rem"
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: "1.5rem"
    letterSpacing: "0em"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
    letterSpacing: "0em"
  caption:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: "1rem"
    letterSpacing: "0.01em"
rounded:
  none: "0px"
  control: "6px"
  panel: "10px"
spacing:
  gutter-phone: "16px"
  gutter: "24px"
  panel-gap: "24px"
  panel-pad-phone: "20px"
  panel-pad: "24px"
  control-height: "36px"
  menu-item-height: "32px"
  table-head-height: "36px"
  table-row-height: "44px"
  top-bar-height: "56px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "{spacing.control-height}"
  button-primary-hover:
    backgroundColor: "color-mix(in srgb, #0066cc 88%, black)"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "{spacing.control-height}"
  button-secondary-hover:
    backgroundColor: "{colors.ground}"
  button-quiet:
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "{spacing.control-height}"
  button-quiet-hover:
    backgroundColor: "{colors.primary-tint}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "{spacing.control-height}"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "{spacing.panel-pad}"
  popover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "6px"
    width: "256px"
  badge-critical:
    backgroundColor: "{colors.critical-bg}"
    textColor: "{colors.critical}"
    typography: "{typography.caption}"
    rounded: "{rounded.control}"
    padding: "2px 6px"
  badge-warning:
    backgroundColor: "{colors.warning-bg}"
    textColor: "{colors.warning}"
    typography: "{typography.caption}"
    rounded: "{rounded.control}"
    padding: "2px 6px"
  badge-good:
    backgroundColor: "{colors.good-bg}"
    textColor: "{colors.good}"
    typography: "{typography.caption}"
    rounded: "{rounded.control}"
    padding: "2px 6px"
  badge-neutral:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink-2}"
    typography: "{typography.caption}"
    rounded: "{rounded.control}"
    padding: "2px 6px"
  step-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "4px 10px"
  step-chip-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
  step-chip-slowest:
    backgroundColor: "{colors.critical}"
    textColor: "{colors.surface}"
  table-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "{spacing.table-row-height}"
  table-row-hover:
    backgroundColor: "{colors.ground}"
  tooltip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    typography: "{typography.caption}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
---

# Design System: Armouring Dashboard

## Overview

**Creative North Star: "The Morning Meeting Board"**

This is a board a plant team reads together at 07:30, on a projector or TV, and again alone at a desk. It answers four questions in a fixed order (is there cable, did the men produce, are the bobbins ready, how much work is left) at a size that can be read from across the room, before any table or control asks for attention. A reader can stop at any point and still hold the most important facts.

The look is an Apple-style light interface: a pale grey ground, flat white panels with a hairline edge, near-black text, and very little else. Blocks are told apart by their title, a small line icon and their position, not by colour. Colour is spent only where it means something: blue for action and selection, indigo for a machine with no work and, in a lighter step, for the second series in a chart, and red, amber and green for status, always next to a word.

Decisions the user made, recorded here as fixed: light mode only for now; one typeface, Inter, on every device; one primary colour and one secondary colour; rounded corners used sparingly; the page uses the full width of the screen. This replaces the older "a different colour for each block" look.

**Key Characteristics:**
- Four headline figures first, in the order of the four questions.
- Flat white panels on a grey ground; one soft shadow, used only for things that float.
- One blue, one indigo; red, amber and green only for status, always with a word.
- One typeface, seven fixed sizes, figures that line up in columns.
- Square tables and bars; small radius on controls, slightly larger on panels.
- Every block shows its own "Data as of" time.

## Colors

A near-neutral palette with two working colours and three status colours. Values live in the frontmatter and in `app/globals.css`.

### Primary
- **Action Blue** (`primary`): the primary button, text links, the quiet button, the chosen machine in the pipeline strip, the main data series in charts, an active sort or filter in a column header, the focus ring, the caret and native checkbox tick.
- **Blue Tint** (`primary-tint`): hover fill of the quiet button and the text selection colour. Other pipeline piles use the blue at 30% opacity, not this tint.

### Secondary
- **Night Indigo** (`secondary`): the colour of a machine with no work, both as a headline figure and as the sentence "No cable is ready".
- **Soft Indigo** (`secondary-soft`): the second series in a chart (night shift beside day shift, "filled" bobbins beside "loaded"). Lighter than the primary on purpose: the two series differ in lightness, not only in hue, so they stay apart on a washed-out projector or in grey. Charts only, never text.
- **Indigo Tint** (`secondary-tint`): defined as a token and shown on the reference page; not yet used on a product screen.

### Tertiary
Status colours. Each has a strong tone for text and solid marks and a pale background for badges and notes.
- **Critical Red** (`critical`, `critical-bg`): the slowest step, out-of-date data, a count that does not add up, a duplicate entry, a failed load, a field error.
- **Warning Amber** (`warning`, `warning-bg`): "Not approved", "planned, not approved", bad or badly wound bobbins, a caution note.
- **Good Green** (`good`, `good-bg`): a positive status badge. Present in the system; rarely needed, because a normal state is shown in plain grey text.

### Neutral
- **Ground** (`ground`): the page background, row hover, hover fill of secondary and icon buttons, the neutral badge.
- **Surface** (`surface`): panels, controls, menus, table cells, the top bar (at 75% opacity with a blur).
- **Ink** (`ink`): main text and figures; also the dark tooltip background.
- **Ink 2** (`ink-2`): labels, notes, units, column headers, icons, "Data as of" lines.
- **Ink 3** (`ink-3`): placeholder text, the empty-cell dash, the header caret, the control border on hover.
- **Line** (`line`): control borders, the rules above and below the headline row, the pipeline rail, chart baselines.
- **Line 2** (`line-2`): panel edges, table row rules, the top bar's bottom edge, skeleton bars, empty bar tracks.

### Named Rules
**The Two Colours Rule.** Blue and indigo are the only colours that are not status. A block never gets a colour of its own.

**The Status Has A Word Rule.** Red, amber and green never appear alone. A red chip says "Slowest step"; a red time says "Out of date:"; an amber badge says "Not approved". In charts, every coloured part is named in a legend.

**The Normal Is Grey Rule.** A normal state is written in plain grey text ("Approved", "In plan"). Only the exception gets a coloured badge, so the eye lands on what needs action.

**The Meaning Not Rank Rule.** A chart part takes its colour from what the state means (usable in blue and indigo, problem states in status colours, inactive in grey), never from its position in the list.

## Typography

**Display Font:** Inter (with system-ui, sans-serif)
**Body Font:** Inter (with system-ui, sans-serif)

**Character:** One family at every size, so the projector, the laptops and the phones all render the same page. Hierarchy comes from size and weight only: 600 for figures and titles, 400 for reading text, 500 for control labels.

### Hierarchy
- **Headline** (600, 3rem / 48px, line 3.25rem, tracking -0.025em): the four answers at the top of the dashboard. Nothing else uses it.
- **Figure** (600, 2.125rem / 34px, line 2.375rem, tracking -0.02em): the main number inside a panel.
- **Page** (600, 1.5rem / 24px, line 1.875rem, tracking -0.015em): the page title: the machine name, "Sign in", "Create an account".
- **Title** (600, 1.25rem / 20px, line 1.625rem, tracking -0.01em): a panel's title; also the daily totals in the latest-entries strip.
- **Body** (400, 1rem / 16px, line 1.5rem): text inside inputs, full sentences, the unit after a headline figure (at 500), sub-headings inside a panel (at 600).
- **Label** (400, 0.875rem / 14px, line 1.25rem): table cells, button text (at 500), field labels (at 500), notes under figures, menu items.
- **Caption** (500 by token, 0.75rem / 12px, line 1rem, tracking 0.01em): column headers, badges, "Data as of" lines, chart axis labels and footnotes. Most running captions are set at 400 in the build; badges and column headers keep 500.

### Named Rules
**The One Family Rule.** Inter only. No second typeface, no monospace for numbers, no decorative face.

**The Lined-Up Figures Rule.** Every number that can sit above or below another number uses tabular figures (the `num` class): table columns, tiles, times, row counts, chart labels.

**The Sentence Case Rule.** Titles, labels, column headers and buttons are written in sentence case at normal letter spacing. There are no all-caps labels above headings. Capitals appear only where the data itself is capitals (the account initial, shift codes).

## Layout

The page is full width. There is no centred maximum-width column: content runs from a 16px gutter on phones and a 24px gutter from 640px, on every screen size.

Vertical order is fixed and follows the four questions: sticky top bar, machine name with the shift day, the row of four headline answers, the pipeline strip, then the panels. Panels are 24px apart, both down the page and across it.

- **Headline row:** one column on phones, two from 640px, four from 1024px, with a hairline above and below. It sits directly on the page ground, not in a panel. Each answer is a link to its panel.
- **Tables side by side:** the waiting-list panels sit one per row below 1440px, two across from 1440px and three across from 2200px. The main "Cable ready" panel takes two cells so the grid has no hole.
- **Inside a panel:** each panel is a container and arranges its own content by the width it is given, not by the screen width. With room, figures sit in a narrow column (13rem) beside the table; without it, they stack above.
- **Top bar:** 56px tall, sticky, full width. Left: place name, machine select, jump links. Right: Refresh and the account. Below 768px the jump links move to their own scrolling row under the bar. The bar carries no time; each panel carries its own.
- **Phones:** the pipeline strip turns from six columns into six rows with horizontal bars; tables scroll sideways with their first column held in place; the search box takes the full width.
- **Auth pages:** one panel, 400px wide at most, centred on the ground.

Density is fixed heights: 36px controls, 36px table header, 44px table rows, 32px menu items. A table reserves the height of its page while a new page loads, so the layout does not jump.

**The Stop Anywhere Rule.** Order on screen follows the order of the four questions. Nothing may be placed above the headline row except the top bar and the machine name.

## Elevation & Depth

Flat. Depth comes from tone: white panels on a grey ground, separated by a hairline. Panels, tables, cards and buttons carry no shadow at rest or on hover.

### Shadow Vocabulary
- **Floating** (`box-shadow: 0 8px 28px rgb(0 0 0 / 0.14)`): only for things that sit above the page for a moment: the column menu, the account menu and the chart tooltip.

The sticky top bar is the one translucent surface: white at 75% with a strong blur and raised saturation, and a hairline under it. When the reader's system asks for reduced transparency it becomes solid white with no blur.

### Named Rules
**The Flat Panel Rule.** If it stays on the page, it has a hairline and no shadow. If it floats and goes away, it has the one shadow.

## Shapes

Corners are rounded sparingly, with two radii and nothing in between.

- **Controls and badges** (6px): buttons, inputs, selects, menu items, badges, pipeline step chips, inline notes, the tooltip.
- **Panels and menus** (10px): panels, the auth card, popover menus.
- **Square** (0px): tables and their rows, chart bars, split bars and their legend swatches, pipeline piles, skeleton bars, dividers.

There are no pills and no circles as containers. Borders are always 1px: the stronger line colour on controls, the lighter one on panels and between table rows. Icons are small line drawings (18px, 2px stroke, round ends) in the label grey, drawn inline with no icon library.

**The Square Data Rule.** Anything that draws data (a row, a bar, a pile, a swatch) has square corners. Only things a person presses or reads as a container are rounded.

## Components

### Buttons
Quiet and exact; the press is felt at once.
- **Shape:** gently rounded (6px), 36px tall, 14px side padding, label size at weight 500.
- **Primary:** Action Blue with white text. Hover darkens the blue by mixing in 12% black. One per view at most (Sign in, Create account).
- **Secondary (default):** white with a 1px line border and ink text. Hover turns the fill to ground and the border darker. Used for Previous, Next, Sign in, Try again.
- **Quiet:** blue text with no border or fill. Hover fills with the blue tint. Used for Refresh and Clear filters.
- **Icon button:** 36px square, grey icon, ground fill on hover; always has a spoken label and a tooltip title.
- **Press / Loading / Disabled:** scales to 97% on press (150ms ease-out; none with reduced motion). Loading shows a small spinner before the label and blocks the button. Disabled is 50% opacity.
- **Focus:** a 3px blue outline with a 2px gap, on every focusable element.

### Badges
- **Style:** pale status background with the matching strong text, 6px radius, caption size, 2px by 6px padding, never wraps.
- **Tones:** critical, warning, good, neutral (ground fill, grey text). A neutral yes/no value in a table is shown as plain grey text with no badge.

### Panels
- **Corner Style:** softly rounded (10px).
- **Background:** white on the grey ground.
- **Shadow Strategy:** none. See Elevation.
- **Border:** 1px in the lighter line colour.
- **Internal Padding:** 20px on phones, 24px from 640px.
- **Header:** optional line icon, the title at title size, a one-line subtitle in grey, and the "Data as of" time at the right (it drops under the title on phones). Out-of-date data reads "Out of date:" in red.
- **States:** while loading, a panel shows square pulsing skeleton bars; an empty panel says what will fill it; a failed panel shows a red note with Try again. One failed block never blanks the page.

### Stat
A labelled figure: grey label above, the number in tabular figures, a grey unit after it, an optional one-line note below. Two sizes: headline (the four answers) and figure (inside panels). The number can turn red, amber, or indigo (no work).

### Inputs / Fields
- **Style:** white, 1px line border, 6px radius, 36px tall, 16px text so phones do not zoom on focus. The select shows a small chevron at the right and uses label size at weight 500.
- **Label:** always visible above the control, label size at weight 500, in grey.
- **Hover / Focus:** border darkens on hover; focus shows the blue outline.
- **Error / Disabled:** an invalid field gets a red border and a red message under it that names the problem. Disabled is 50% opacity.
- **Search:** a magnifier inside the left edge; a spinner inside the right edge from the first keystroke, so a delayed search never looks dead.
- **Checkbox:** the native checkbox at 16px, tinted blue, with its label beside it in a row at least 32px tall.

### Navigation
- **Top bar:** see Layout. Jump links are 32px tall, grey label text, 6px radius; hover gives ground fill and ink text. There is no "current" state; they only scroll the page.
- **Machine select:** the primary action of the dashboard, top left. Changing it loads the same page for another machine.
- **Account:** a 36px square button with the user's initial opens a menu with name, email, role and Sign out (in red).

### Data Table
The signature working component. The browser holds one page; everything else is asked of the server.
- **Shape:** square. Every cell is ruled on all four sides with a hairline (the user asked for cell borders, 2026-11-19), and the header row is shaded with the page ground; no zebra stripes. Borders are separate, not collapsed, so the pinned first column keeps its lines while the table scrolls sideways. Header row 36px, body rows 44px, cell padding 12px.
- **Header:** each column name is a button in caption size, grey, with a small caret. It turns blue when that column is filtered and shows the number of chosen values in brackets; an arrow shows the sort direction.
- **Cells:** label size. The first column is weight 500 and stays in place when the table scrolls sideways. Numbers are right-aligned in tabular figures. An empty value is a grey dash. Long text is cut with an ellipsis at 22rem. Rows get the ground colour on hover.
- **Server rules (decided):** every table is paged, sorted, searched and filtered on the server. Search waits 700 ms after typing stops (Enter sends at once). Filter choices for a column are fetched from the server, with their counts. Number and time columns sort only; text, yes/no and day columns can also be filtered. The default order is biggest first.
- **Toolbar and footer:** search box at the top left (288px wide, full width on phones) with Clear filters beside it when a filter is on. Below the table: "1-10 of 51" at the left; rows per page (5, 10, 25, 50), Previous and Next at the right, shown only when there is more than one smallest page.
- **Loading:** the rows fade to 50% and a small spinner appears by the count; the old page stays visible until the new one arrives.

### Column Menu (Popover)
- **Style:** white, 1px line border, 10px radius, the floating shadow, 256px wide, 6px padding. It opens under its header, or above when there is more room there, and never grows past the screen; a long list scrolls inside it.
- **Content:** Sort ascending and Sort descending (the active one in blue); then, for columns that can be filtered, a find box and a checkbox list of values with counts, Show more, and Clear this filter. "(blank)" is always the first choice, with 0 beside it when no row is blank.
- **Behaviour:** closes on Escape or an outside click and returns focus to the header. It is placed on the page, not pinned to the screen, so it scrolls away with the table it belongs to.

### Pipeline Strip
The signature picture: the plant line from left to right, with the cable waiting in front of each step shown as a square pile above the step's name.
- **Piles:** all on one km scale. The chosen machine's pile is solid blue; the others are the same blue at 30%. A step measured in a different unit shows its number and the words "not to scale" with no pile.
- **Step chips:** 6px radius on a hairline rail. Default: white with a line border. Chosen machine: solid blue, white text. Slowest step: solid red, white text, with the words "Slowest step" under it.
- **Phones:** the strip becomes a list; each pile turns into a horizontal bar.

### Charts
- **Bars:** plain square bars, a 2px white gap between stacked parts, a dashed top gridline with its value, a solid baseline, axis labels in caption grey. Blue is the main series, indigo the second; the slowest step's bars are red, with a "Slowest" badge on its heading.
- **Tooltip:** dark (ink) with white caption text, 6px radius, the floating shadow; shown on hover and on keyboard focus.
- **Table view:** every chart has a "Show as table" disclosure under it with the same numbers.
- **Split bar:** one 12px square bar divided into parts, with a legend that names every part and gives its number.

## Do's and Don'ts

### Do:
- **Do** keep the order: top bar, machine name, four headline answers, pipeline strip, panels.
- **Do** use Action Blue for action, selection and the first data series, and Night Indigo for the second series and the no-work state.
- **Do** put a word beside every red, amber or green mark, and name every chart colour in a legend.
- **Do** show a normal state as plain grey text and keep badges for exceptions.
- **Do** use the `num` class on every figure that sits in a column or a tile.
- **Do** use 6px on controls and badges, 10px on panels and menus, and square corners on tables, bars and swatches.
- **Do** give every panel its own "Data as of" time, and say "Out of date:" in words when it is stale.
- **Do** build every table with the shared data table: server paging, sorting, search and filters, 700 ms search delay, filter choices from the server.
- **Do** let a panel arrange itself by its own width, so it works one, two or three across.
- **Do** honour reduced motion and reduced transparency, and keep the 3px blue focus outline visible.

### Don't:
- **Don't** give a block its own colour. Blocks are told apart by title, icon and position.
- **Don't** add a dark theme for now; the product is light mode only.
- **Don't** add a second typeface or a monospace face for numbers.
- **Don't** use red, amber or green for decoration or for a data series that is not a status.
- **Don't** put a shadow on a panel, a table or a button. The one shadow belongs to menus and tooltips.
- **Don't** round tables, bars, piles or legend swatches, and do not use pill shapes.
- **Don't** wrap the page in a centred maximum-width column.
- **Don't** add filters to number or time columns; they sort only.
- **Don't** load a full list into the browser to sort, search or filter it there.
- **Don't** write that a machine is "free" or "idle"; its men "can be utilized for some other purposes".
- **Don't** draw a Gantt chart.

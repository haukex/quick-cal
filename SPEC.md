# Quick Calendar Project Specification

## 1. Purpose

A “Quick Calendar” web application: A user chooses the date format and the first day of the week,
pastes or enters a list of “selected” dates, and sees a calendar with every full month from the
earliest selected date through the latest selected date. Selected dates, duplicate dates, occupied
weeks, gaps between occupied weeks, and occupied months are highlighted and made visually obvious.

## 2. Technology and project setup

- The application is a frontend-only, single-page web app, and must work as a static site without a
  backend, persistence, accounts, or network requests at runtime.
- Use strict TypeScript and the supplied `tsconfig.json` and `eslint.config.js`.
- Use Parcel 2 (or later) as the development server and production bundler.
- The project is an ESM package (`"type": "module"`).
- Use native browser DOM APIs; do not add a UI framework.
- Use the `date-fns` library for all date operations such as parsing, formatting, date validation,
  date arithmetic, interval generation, comparisons, and ISO week numbers.
- Target Node.js 24 or later.
- `package.json` should contain `run` targets for linting, testing, building, type checking
  with `tsc --noEmit`, cleaning build output, and running the Parcel development server.
- Ignore `node_modules/`, `.parcel-cache/`, and `dist/` in Git.

## 3. Source organization

- Source code should be placed in `src/` (HTML, CSS, and TypeScript) and tests in `src/test/`.
- Keep parsing and calendar calculations independent of the DOM so they can be tested directly.

## 4. Page structure and copy

The body contains:

1. A page header.
2. A collapsible input panel (initially open).
3. A live calendar output region.

The input panel’s body contains:

1. A settings row containing:
   - A text input within which the user can enter the date format such as, for example,
     `dd.MM.yy`, `MM/dd/yy`, or `yyyy-MM-dd`, the latter being the default.
   - Two radio buttons for selecting the first day of the week as either Monday (the default)
     or Sunday.
2. A nested collapsible help panel whose body contains a cheat sheet for date-fns’s date format
   patterns, mentioning how to specify single- and two-digit days and months, two- and four-digit
   years, and that the pattern is case-sensitive.
3. A textarea within which the user can enter a list of dates, one per line.
4. An initially hidden validation / error message container.

## 5. Date-format and input parsing rules

### 5.1 Format handling

- Pass the user’s format directly to date-fns `parse`; use date-fns token semantics exactly, which
  are case-sensitive.
- An empty or whitespace-only format is invalid and reports a corresponding error.
- Validate a nonempty format before parsing the user’s lines by:
  1. Formatting a stable sample date with the supplied format.
  2. Parsing that result with the same format and the reference date described below.
  3. Requiring the result to be valid.
- Catch exceptions from both formatting and parsing and expose their message.

### 5.2 Two-digit years

All `yy` years map to the most recent matching year that is not later than the current calendar
year. Accomplish this using date-fns behavior rather than rewriting the parsed year, using today’s
date minus 49 years as the reference date.

For a current year of 2026, examples are:
- `26` → 2026
- `27` → 1927
- `00` → 2000
- `99` → 1999

The current year is allowed even when the parsed month/day is later than today; the rule is based
on year, not whether the complete date is in the past.

### 5.3 Lines and errors

- Split textarea input on LF or CRLF.
- Trim surrounding whitespace from each line.
- Ignore blank lines.
- Parse every non-blank line with date-fns `parse` and reject invalid `Date` results.
- Store valid dates as `Date` values and count occurrences under canonical `yyyy-MM-dd` keys.
- Dates may be unsorted and repeated.
- An invalid line records its one-based line number, trimmed value, and corresponding error message.
- If any format or line error exists, suppress the entire calendar rather than rendering the valid
  subset. Display a corresponding message instead of the calendar.
- Display errors in the validation container. Line errors should reference the origin line number
  and text.

## 6. Update timing

Do not rebuild the calendar on every ordinary textarea keystroke. This prevents a previously valid
calendar from disappearing while the user is still typing an incomplete date. Therefore, for the
textarea’s `input` event, rebuild only for `InputEvent.inputType` values such as:
- `insertLineBreak`
- `insertParagraph`
- `insertFromPaste`
- `insertFromDrop`
- `deleteByCut`
- `historyUndo`
- `historyRedo`

Also rebuild immediately:
- On every `change` event from the textarea, the date-format field, and radio buttons.
- Once during initial page setup.

## 7. Typed calendar model

Design pure functions and readonly TypeScript models as appropriate.

Export a `MAX_MONTHS` constant with value `600`.

## 8. Calendar generation

- If there are no valid dates, return no months and no range error.
- Find the earliest and latest parsed dates independently of input order.
- Generate every full month from the earliest date’s month through the latest date’s month,
  inclusive.
- Calculate the inclusive month count with date-fns. If it exceeds `MAX_MONTHS`, return no months
  and generate a corresponding error message.
- Months’ visible titles are `MMMM yyyy`.
- Day labels use `EEEE, MMMM d, yyyy`. Occurrence counts come from the canonical key map.

### 8.1 ISO week numbers

- Week numbers always use ISO 8601 numbering.
- For Monday-first rows, calculate the ISO week from the row’s Thursday (start + 3 days).
- For Sunday-first rows, calculate it from the row’s Thursday (start + 4 days). This deliberately
  assigns one ISO number to a Sunday–Saturday visual row that crosses an ISO-week boundary.

### 8.2 Week classification

A week is classified by the number of distinct calendar days in the seven-day row whose occurrence
count is greater than zero. Repetition of one date does not increase this count. Count the whole
seven-day interval, including selected dates represented by blank spillover cells in an adjacent
month table. Classify each week as follows, in this precedence order:

1. Exactly one selected day.
2. More than one selected day.
3. No selected days, and the week start is strictly after the first selected week’s start and
   strictly before the last selected week’s start, i.e. a gap.
4. Otherwise, the week is outside the range of dates and remains neutral.

## 9. Calendar rendering and highlighting

Render months as semantic table elements with 5 to 7 rows (the first row being the header) and
eight columns (the first column being the row headers).
- Use the month title as the table’s caption.
- Use a table header with one week-number column `Wk` (visually upper-cased by CSS) and seven
  weekday columns abbreviated as one letter (e.g. `WK  M  T  W  T  F  S  S`).
- Use a row header for each week number.
- Table borders should be visible and collapsed-border.

Apply highlights as follows:

- Month contains one or more selected dates: Month caption green
- Day is selected once (occurs once in the list of dates): Day number highlighted bold green
- Day selected more than once (occurs two or more times in the list of dates): Day number
  highlighted bold yellow
- Week has exactly one distinct selected day, even when that day is a yellow duplicate:
  Week number highlighted bold green
- Week has multiple distinct selected days: Week number highlighted bold yellow
- Empty week strictly between first/last selected weeks: Week number highlighted bold red
- Other week: Dim neutral week number

## 10. Tooltips and ARIA

Use native `title` attributes for desktop tooltips plus explicit ARIA labels.

### 10.1 Column headers

- The `Wk` header has both `title` and `aria-label` equal to `ISO 8601 week number`.
- Each weekday header has both `title` and `aria-label` equal to its full English weekday name.

### 10.2 Day cells

For every in-month day:

- Its ARIA label starts with the long English date, e.g. `Thursday, June 18, 2026`.
- An unselected day has no suffix.
- A date selected once adds `, selected once`.
- A date selected multiple times adds `, selected N times`.

Tooltip text:

- Unselected: `YYYY-MM-DD`
- Selected once: `YYYY-MM-DD — appears 1 time in the list`
- Selected multiple times: `YYYY-MM-DD — appears N times in the list`

### 10.3 Week row headers

Tooltip text:

- Neutral/outside-range week: `WK N`
- Single selected day: `WK N — 1 selected day`
- Multiple selected days: `WK N — X selected days`
- Gap: `WK N — 0 selected days`

ARIA labels:

- Neutral/outside-range week: `Week N`
- Single selected day: `Week N, one selected day`
- Multiple selected days: `Week N, X selected days`
- Gap: `Week N, no selected days`

## 11. Styling and responsiveness

Fonts, colors, and overall design are your discretion, with the following requirements:

- All visible copy and generated month/weekday names are English.
- The design should be responsive to the display width, all the way down to mobile displays.
  For example, render the months as wrapping flexbox or grid for the most compact display.
- Use `color-scheme: light dark;` and `@media (prefers-color-scheme: dark)` to support dark mode;
  a manual theme toggle is not necessary.
- Month tables should be compact.
- Follow best practices for accessibility.

Important production-build notice: Parcel’s HTML optimizer may remove attributes, for example
`type="text"` on inputs because this is the default. Therefore, be careful when designing CSS
selectors, for example using explicit classes or IDs instead of `input[type="text"]`.

## 12. Tests

Use Node’s built-in `node:test` and `node:assert/strict` from `.mjs` files.
Inject a fixed local reference date for deterministic two-digit-year tests.

Minimum example test set; additional tests at your discretion:

- Parse and canonicalize ISO, European, and US formats; ignore blank lines.
- Confirm the `yy` mapping `26 → 2026`, `27 → 1927`, `00 → 2000`, and `99 → 1999`.
- Count duplicate leap-day input twice.
- Accept a valid leap day and report an impossible leap day with its correct line number/value.
- Confirm that invalid formats such as `YYYY-MM-DD` produces a format error and no dates.
- Generate an inclusive January-through-March range and mark only January/March as selected months.
- Verify ISO week 53 across 31 December 2020 / 1 January 2021.
- Verify that a Sunday-first row beginning 27 December 2020 uses ISO week 53 based on Thursday.
- Verify duplicate occurrences on one date don’t cause the week to be classified as “more than one
  day”.
- With selected dates on 10 and 24 January 2024, verify week classifications “none”, “one”, “gap”,
  “one”, “none” and counts `[0, 1, 0, 1, 0]`.
- Accept exactly `MAX_MONTHS` inclusive months and reject `MAX_MONTHS + 1`.

When a test produces an expected warning (such as date-fns’s warning about `YYYY-MM-DD`),
immediately before that test, output a message explaining that the following warning is expected.

The complete quality gate is when the linting checks, tests, and build steps pass.

## 13. Deployment

The Parcel production build must use relative public URLs so the static output works under a GitHub
Pages project subpath.

## 14. Acceptance criteria

- Unsorted and duplicate date lists parse according to the selected date-fns format.
- Incomplete typing does not clear a previously rendered calendar on every keypress.
- Any committed invalid input blocks the whole calendar and reports actionable errors.
- The exact inclusive month range renders responsively in both week-start modes.
- Day, week, gap, and month states use the specified colors and occurrence/distinct-day semantics.
- ISO week labels remain correct at year boundaries and in Sunday-first rows.
- All specified tooltips and ARIA labels are present.
- Light/dark appearance follows the operating-system preference.
- All linting checks, tests, and build steps pass.

<!-- spell: ignore flexbox -->
# Raid Roster Template Guide

Use this guide when adding or updating a raid-specific roster page from `templates/raid-roster-template.html`.

## Roster page architecture

A roster page is an assignment editor. It should collect the shared assignments that boss sheets consume, but it should not become a boss navigation page or a boss guide page.

Every roster page should use the standard top chrome:

- Top left: `Home` linking to `index.html`
- Top right: `Guide` linking to that raid's `guidePage` or first boss sheet
- Top right: `Copy Public Raid Guide Link` copying the same public guide entry point used by `Guide`
- Top right: `Clear all`

Roster pages must not include:

- a `Print` button
- individual boss sheet buttons such as `Hydross sheet`, `Lurker sheet`, `Copy Maulgar`, or `Copy Gruul`
- boss-specific tabs or boss navigation lists

Boss navigation belongs on boss sheet pages. Keep roster pages focused on assignment entry and let boss sheet pages provide boss-specific navigation, guide content, copy buttons, and print behavior.

## Public guide link behavior

`Copy Public Raid Guide Link` is part of the standard roster chrome and must follow the same public guide URL rule as the `Guide` button.

- Session-backed rosters preserve only `session=SESSION_ID` in `Guide` and copy URLs when the current roster URL has a session.
- Session-backed rosters must never include `key=EDIT_KEY`, an `edit key`, or any other private edit key in public guide links.
- Local-only rosters use `guidePage` / `GUIDE_PAGE` without session or key parameters.
- Do not add roster-assignment public sharing for local-only raids unless the existing session system already supports that raid cleanly.

The template demonstrates this with:

```js
const GUIDE_PAGE = 'GUIDE_PAGE';
const SESSION_BACKED = false;
```

Set `SESSION_BACKED` to `true` only for raids with real session-backed roster support. Otherwise leave it `false` so local-only rosters open and copy plain `GUIDE_PAGE` URLs.

## 1) Add or update raid metadata

When a change intentionally adds or updates a raid, update the raid config at:

- `raids/<raid-id>/raid.json`

Required metadata:

```json
{
  "id": "raid-id",
  "name": "Raid Name",
  "firstBossId": "first-boss-id",
  "rosterPage": "raid-roster.html",
  "guidePage": "first-boss.html",
  "bosses": []
}
```

Rules:

- `rosterPage` points to the raid-specific roster page.
- `guidePage` points to the first boss sheet or raid guide page.
- Do not change existing boss ids, boss names, boss icons, boss page paths, boss fragments, marker assets, or raid schemas unless that metadata is actually part of the requested change.

## 2) Create a raid-specific roster page

Copy:

- `templates/raid-roster-template.html`

To a raid-specific root page, for example:

- `<raid-id>-roster.html`

Replace placeholders:

- `RAID_ID`
- `RAID_NAME`
- `GUIDE_PAGE`
- `SESSION_BACKED`

The roster page should set:

```html
<body data-raid-id="RAID_ID">
<script>
window.RaidConfig = { raidId: 'RAID_ID' };
</script>
```

This keeps local roster storage scoped to the raid id.

## 3) Use shared Core roster and boss-specific sections

Modern roster pages may have both:

- a shared `Core roster` section for assignments reused across multiple boss sheets
- one or more boss-specific sections for mechanics that only a particular boss sheet needs

Keep field names generic during template work, then replace them in a real roster with stable keys that match boss sheet bindings:

- `data-bind="..."` for single values
- `data-bind-group="..."` for grouped values
- `data-target-bind="..."` for target/tank display values

Do not add fields for another raid's bosses, and do not copy another raid's exact field names unless the boss sheets intentionally share those bindings.

## 4) Model fields with FIELD_META-style metadata

Use a single FIELD_META-style assignment metadata list to define each field's behavior. The template demonstrates these metadata properties:

- `block`: the Core roster or boss-specific block where the field renders
- `type`: `single` or `list`
- `key`: the stable storage / boss-sheet binding key
- `label`: the visible row label
- `sheetLabel`: optional shorter boss-sheet/spreadsheet label when the sheet has less space
- `rows`: the default number of rows for list fields
- `placeholder`: input placeholder text
- `suppressNumbering`: optional; keeps every list row on the same label
- `targetMarker`: optional; displays a marker between an input and its target text
- `targetText`: optional; displays the target role/name text for Misdirect-style rows

Prefer metadata-driven rendering over hand-copying many nearly identical rows. This makes it easier to audit labels, row counts, list behavior, and target marker behavior.

## 5) Choose list fields vs single fields deliberately

Use list fields only when the roster editor needs `+` / `−` controls or a variable number of people. Kicker fields should be list fields when a raid needs multiple kickers so added rows can be adjusted without code changes.

Use single fields when a role should be fixed and should not gain extra rows. Examples include one fixed utility role, one fixed debuff handler, or one fixed target display value.

List fields should use numbering unless `suppressNumbering` is explicitly intended. The standard repeated-row style is an unnumbered first row followed by numbered added rows, such as `Kicker`, `Kicker 2`, and `Kicker 3`.

Use `suppressNumbering` for list fields where every row should keep the same label. A common example is a Misdirect-style assignment where each row should say `MD` rather than `MD 1`, `MD 2`, and so on.


## 6) Use clean roster labels as the standard style

This is the standard style going forward for raid roster pages:

- Keep top-level block headings for major categories such as `TANKS`, `HEALERS`, `MISDIRECT`, and `UTILITY`.
- Put the individual assignment meaning on the row label itself, such as `Main tank`, `MT healer`, `MD`, `Kick`, or the specific boss mechanic.
- Do not add a mini heading if the row label immediately underneath already explains the same assignment.
- Do not create a redundant mini heading just to hold `+` / `−` list controls.
- Place adjustable list controls in a small control row immediately above the field/group they modify. Align that row to the right edge of the text field they modify so the `+` / `−` buttons clearly belong to the rows below.
- The `−` button is the rightmost control; its right edge should line up with the input field's right edge.
- Do not left-align `+` / `−` controls and do not place them to the right of an input row; keep field rows clean and aligned beneath the controls.
- Do not place controls above unrelated marker or target text. For Misdirect-style rows, align controls over the hunter/input field rather than over the marker/target label, and use the input plus target marker/text to identify the assignment; avoid labels such as `Main Tank Misdirect` directly above a row that already points to the main tank target.
- In cramped Utility blocks, use shorter visible labels when the section heading already provides context. For example, descriptive debuff field keys such as `core_curse_of_elements` and `core_curse_of_recklessness` may display as `Elements` and `Recklessness`. When debuff options are used, include a Tongues roster option; roster pages should use a clear full label, while boss sheets and spreadsheets may shorten that same binding to `Tongues`. Keep the field keys, data bindings, schema keys, save/load keys, and boss-sheet references descriptive and unchanged.
- For tank and healer lists, avoid headings such as `Off Tank(s)` or `Main Tank Healer(s)` directly above rows labeled with the same tank/healer assignment.

Before adding a new subgroup/list header, compare it to the next visible row. If the next row already carries the assignment meaning, remove the mini heading and keep the controls in an unlabeled/minimally labeled top-right control row above the fields instead.

## 7) Avoid roster layout spacing and truncation problems

Core roster blocks may need block-specific widths. Do not assume every block can share the same label column, minimum block width, or target text width. Styling fixes scoped to one raid-specific roster page, such as `roster.html`, do not automatically fix another page such as `ssc-roster.html`; audit and update the roster page that owns the colliding layout.

Use block-specific classes or variables for the Core roster, such as:

```css
.roster-block--core-melee { --block-min: 300px; --label-width: 96px; }
.roster-block--core-ranged { --block-min: 340px; --label-width: 104px; }
.roster-block--core-support { --block-min: 360px; --label-width: 80px; --target-min-width: 128px; }
.roster-block--core-utility { --block-min: 280px; --label-width: 96px; }
```

Misdirect-style rows must reserve enough horizontal space for the full sequence:

```text
input → marker → target role
```

Spacing rules:

- Core roster blocks should visually align their first visible input rows across the section without relying on repeated mini headings.
- If a Core roster block truly needs spacer alignment, add the standard spacer/alignment class or flag (for example `roster-group-has-spacer`, `roster-block--align-direct-rows`, or a template block option such as `alignDirectRows`) rather than adding a duplicate label.
- Do not hand-tune individual rows with one-off margins to force alignment; keep row alignment as a reusable block-level template behavior.
- Avoid oversized label columns for short labels like `MD`; give that width back to the input and target text.
- Misdirect target rows need reserved horizontal space for the input, marker, and full target role text; top-right slot controls should sit above the target rows and must not overlap or visually run into the Utility block.
- Do not rely on ellipsis or truncation for required assignment target text.
- Reserve a real `targetText` width when the target role is required for the assignment to be readable.
- Keep `targetMarker` compact and fixed-width so it does not compete with the input.
- Test the widest realistic target role names before considering the layout finished.

## 8) Keep roster page background and readable surfaces consistent

Roster pages should use the shared dark gray outer page background (`#242424`) behind the roster form/card area. Keep the roster form/card surface a slightly lighter gray (for example `#2F2F2F`) than the outer page background so the form stands out without returning to a bright card.

Use white or near-white text for main roster content, light gray section headings/group labels, and softer light gray muted/helper text so every roster label remains readable on the gray card surface. Text inputs should use a lighter gray surface than the roster form/card (for example `#4A4A4A`) with white/light input text and readable placeholder text. Top chrome menu/action buttons, including Home, Guide, Copy Public Raid Guide Link, and similar roster actions, should use the same lighter gray surface as roster text inputs. The Clear all button is destructive and should use the red `btn-danger` style with readable light text and a darker red hover state. Slot `+` / `−` controls should use the same surface or a close related gray, with readable symbols and visible hover/focus/border states.

For styling-only or naming updates, do not change routing, schema, route behavior, top chrome behavior, public guide link behavior, clear button IDs/JavaScript hooks, session handling, roster storage, JavaScript/roster behavior, raid metadata, or roster storage/schema behavior.

## 8) Keep top roster chrome consistent

The roster page top chrome should follow this structure:

```html
<div class="roster-top-actions screen-only">
  <a class="btn" href="index.html">Home</a>
  <div class="roster-actions">
    <a class="btn btn-primary" id="public-guide-link" href="GUIDE_PAGE">Guide</a>
    <button class="btn" id="copy-public-guide-link" type="button">Copy Public Raid Guide Link</button>
    <button class="btn btn-danger" id="clear-roster" type="button">Clear all</button>
  </div>
</div>
```

The `Guide` button should point to the raid metadata `guidePage` or first boss sheet. For session-backed rosters, set `SESSION_BACKED` only when that raid has real session support, then update the `Guide` href from the current roster URL so it preserves only `session=SESSION_ID` and never includes `key=EDIT_KEY` or any other private edit key. The copy button should copy the same public guide entry point by deriving its absolute URL from the same helper/path rule used by the `Guide` href.

Do not add individual boss buttons to the roster page. Boss navigation belongs on boss sheet pages.

## 9) Validate

For template and documentation-only changes, run:

```bash
git diff --name-only
git diff --stat
git diff --check
rg -n "SESSION_BACKED|GUIDE_PAGE|Core roster|boss-specific|suppressNumbering|targetMarker|targetText|Misdirect|Copy Public Raid Guide Link|edit key|Print|Hydross|Lurker|Gruul" templates/raid-roster-template.html docs/raid-roster-template-guide.md
```

Expected results:

- only the intended template/docs files are changed
- the template documents the reusable roster architecture
- the guide warns against spacing/truncation problems for required assignment target text
- no active roster pages, boss pages, JavaScript files, CSS files, raid schemas, fragments, or assets are changed

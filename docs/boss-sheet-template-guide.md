# Boss Sheet Template Guide

Use this guide to create new boss sheets without touching shared page chrome or runtime wiring.

## 1) Copy the template into the raid folder

Copy:

- `templates/boss-sheet-template.html`

To:

- `raids/<raid-id>/bosses/<boss-id>.html`

Example:

```bash
cp templates/boss-sheet-template.html raids/gruuls-lair/bosses/high-king-maulgar.html
```

## 2) Keep the boss file content-only

Boss fragments must remain content-only. Your boss file must contain exactly one root node:

- `<div class="sheet"> ... </div>`

Do **not** add any of the following to boss files:

- `<!DOCTYPE html>`
- `<html>`, `<head>`, `<body>`
- `<script>`
- `<style>`
- page nav/header controls
- roster editor controls
- loader containers

Styling comes from `css/boss-sheet.css`; boss files should only provide sheet content.


## 2a) Keep boss shell nav clean

When creating or updating a boss shell page (the top-level HTML page that loads a boss fragment), keep the top navigation bar minimal:

- Put the `Home` button on the left side of the `page-nav` bar. Keep its route unchanged, usually `index.html`.
- Put the `Roster` button and the `data-boss-tabs` boss tab container together on the right side.
- Do not include descriptive sheet-status text such as `sheet · reads saved roster assignments` in the nav bar.
- Do not move or rename `data-boss-tabs`; shared navigation code depends on that container.

Boss content fragments still must not include page nav/header controls.

## 3) Replace placeholders

Update all placeholders in the copied file:

- `RAID_NAME`
- `BOSS_NAME`
- phase titles (`PHASE_1_TITLE`, `PHASE_2_TITLE`, etc.)
- setup assignment columns and lines
- mechanic names/descriptions
- icon URLs (`ICON_URL_*`)
- sidebar image cards (use clean placeholder cards until real assets exist)
- wipe causes (`WIPE_CAUSE_*`)

## 4) Preserve reusable class structure

Keep the class structure used by `css/boss-sheet.css` so layout remains consistent (header, setup block, phase blocks, role columns, sidebar cards, footer). Boss sheets normally include `main-layout`, `sheet-content`, the right-side `image-sidebar`, image placeholder cards, a wipe causes `reminder-card`, and `sheet-footer`. Codex should not omit the sidebar when creating new boss foundations from the template.

## 5) Use roster binding attributes for dynamic values

Use these attributes for roster-driven values:

- `data-bind="..."` for single-slot values
- `data-bind-group="..."` for grouped values
- `data-target-bind="..."` for tank/target parenthetical displays
- `data-default="..."` for fallback text

When adding new assignment slots, keep a stable naming convention for binding keys.


## 6) Setup markup rules (important)

When writing boss setup fragments, output final player-visible markup only (no prose specs):

- The top assignment block should use `setup-block`, `setup-grid setup-grid-5`, `setup-col`, `setup-col-label`, `setup-line`, and `line-text`.
- Prefer `setup-col-label` for column headings. Do not use `setup-heading` in new template examples unless a backward-compatible exception requires it.
- Add `setup-col-tanks` to the Tanks setup column so tank assignment targets can be styled distinctly.
- Do not add top assignment/setup prose above the setup grid.
- Assignment sections should begin directly with setup columns.
- Fight instructions belong in phase blocks, reminder cards, or image captions, not in a `setup-label` sentence above assignments.
- Top setup assignment rows use arrow formatting (`→`), not colon formatting.
- The top assignment block should include these standard columns in this order:
  - `Tanks`
  - `Healers`
  - `Misdirects`
  - `Utility`
  - `Kicks` only if the boss uses kicks
- Treat `Utility` as the standard top-row utility assignment column aligned with `Tanks`, `Healers`, and `Misdirects`.
- Utility rows should use the visible labels:
  - `Elements`
  - `Recklessness`
  - `Tongues`
- Utility binding keys may remain raid-specific when existing roster bindings already support those names.
- The top assignment block should not include:
  - `Notes`
  - `Interrupts / Utility`
- Notes belong in normal lower content/mechanics areas when needed.
- Use the optional `Kicks` column only for boss kick assignments.
- Normal kick rows should use: `Kick 1 → Kicker`.
- Marker/channeler-style kick rows should use: `Marker Icon Marker Icon Channeler → Kicker`.
- Keep marker/channeler kick wording generic so it can be adapted per boss.
- Do **not** write marker names as visible text when a marker icon is expected (for example, avoid visible strings like `Skull marker`).
- Do **not** paste prose instructions like `Skull marker — Tank` directly into HTML output.
- Use concrete icon markup for raid markers, e.g. `<span class="role-icon-inline raid-marker-inline"><img ... alt="Skull"></span>`.
- Use raid marker icons from `assets/shared/markers/*` (for example `assets/shared/markers/skull.svg`, `moon.svg`, `cross.svg`, `square.svg`, and `diamond.svg`).
- Use `data-target-bind` for target references instead of adding a second visible `data-bind` for the same target value.
- Assigned player names should use `.role` when assigning a person directly and `.assignment-target` when showing a contextual target from another assignment.
- Visual intent for setup names:
  - Assigned player names are emphasized.
  - Contextual target names stay softer/gray unless they are inside the Tanks column.
  - Unassigned placeholders remain muted/italic.

Standard row patterns:

- Tank rows: `Marker Icon Role Label → Tank Name`.
  - Put the assigned tank name inside `class="assignment-target"` with `data-target-bind`, such as `data-target-bind="main-tank"`.
- Healer rows: `Healer Assignment → Target Tank (Role Label)`.
  - Use `data-bind` for the healer assignment.
  - Use `class="assignment-target"` with `data-target-bind` for the contextual tank target.
  - Use `class="role-label"` for the smaller gray assignment label, such as `(Main Tank)` or `(Off Tank)`.
  - Remove repeated healer spell icons from tank-healer rows.
  - Keep raid healers underneath tank healer rows when applicable, using `data-bind-group="raid-healers"`.
  - The Raid Healers row may keep the raid-healing icon, and should use `Raid → Raid healers` arrow formatting.
- Misdirect rows: `Hunter → Marker Icon Boss/Add → Target Tank`.
  - Use `data-bind-group` for hunter assignment groups and `data-target-bind` for target tank names.
  - Do not use a leading Hunter Misdirection spell icon in the top setup assignment section.

Do **not** use `assets/icons` paths for raid markers or placeholder icons.
Do **not** inline SVG blobs (for example `data:image/svg`).
Do **not** reference nonexistent image files.

## 7) Sidebar image placeholders and wipe reminders

Every boss sheet should include the right-side `image-sidebar` inside `main-layout`, next to `sheet-content`, unless there is a documented exception. Codex should not omit this sidebar when creating new boss foundations from the template.

Draft boss fragments should use clean `image-card` placeholder cards until real positioning assets exist. Do not reference nonexistent image files; broken placeholder paths produce browser broken-image icons and make draft sheets look unfinished.

- Placeholder cards can use boss-specific labels/captions, or this generic visible copy:
  - `Positioning image placeholder`
  - `Replace this with the real positioning asset when available.`
- When a real asset exists, use the standard static-asset path with the shared positioning image class:

  ```html
  <img class="positioning-img" src="assets/<raid-asset-folder>/bosses/<boss-id>/<image-name>.webp" alt="Useful alt text">
  ```

- `positioning-img` enables the shared click-to-enlarge lightbox behavior; do not add inline `onclick` handlers.
- Every positioning image needs useful alt text that describes the diagram or screenshot.
- Every real `image-card` should include:
  - `image-card-label`
  - `img.positioning-img`
  - `image-card-caption`
- Use lowercase kebab-case filenames.
- Prefer `.webp` for compressed sheet images unless PNG transparency is required.
- Do not inline `data:image` or other base64 images.
- Do not store raid marker icons in boss image folders; raid markers belong in `assets/shared/markers/`.
- Every boss sheet should include a wipe causes `reminder-card` in the sidebar. Use `reminder-card-label` for the heading and `reminder-list` for player-facing wipe causes.

## 8) Register the boss in raid metadata

Add the new boss entry to the appropriate raid config:

- `raids/<raid-id>/raid.json`

Make sure id, label, and file path match your new boss file.

## 9) Add raid-specific images

Store boss diagrams/screenshots under the current generic static-asset convention:

- `assets/<raid-asset-folder>/bosses/<boss-id>/`

Reference those files from `image-card` sections with `img.positioning-img`, useful alt text, and lowercase kebab-case filenames. Keep the path generic to the raid asset folder; do not point boss fragments at nonexistent files.

## 10) Validate both render contexts

Test in both contexts:

1. Public sheet view (final player-facing boss page rendering)
2. Editor/preview view (assignment editing + bind propagation)

Confirm:

- bindings render correctly when roster values exist
- `data-default` text appears when values are missing
- phase columns align correctly
- real sidebar images load, or placeholder cards are used when assets are not available
- no nav/loader/script/style markup was added to the boss content file

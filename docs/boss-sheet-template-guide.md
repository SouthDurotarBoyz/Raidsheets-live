# Boss Sheet Template Guide

Use this guide to create new boss pages that match the current metadata-driven shell plus content-fragment architecture.

## 1) Create the two required files

New boss pages require two files:

- A top-level shell page copied from `templates/boss-shell-template.html`
- A content fragment copied from `templates/boss-sheet-template.html`

Example:

```bash
cp templates/boss-shell-template.html high-king-maulgar.html
cp templates/boss-sheet-template.html raids/gruuls-lair/bosses/high-king-maulgar.html
```

Keep public URLs immutable. If a boss page already has a public top-level filename, update that existing shell only when needed. Do not rename public pages or move existing public URLs.

## 2) Configure the boss shell page

The shell owns page identity, navigation, loading, scripts, and session wiring. Copy `templates/boss-shell-template.html` and replace these placeholders:

- `RAID_ID`, such as `tempest-keep`
- `RAID_STYLESHEET`, such as `css/boss-pages/tk.css`
- `BOSS_ID`, such as `alar`
- `BOSS_NAME`, such as `Al'ar`
- `ROSTER_PAGE`, such as `tk-roster.html`
- `BOSS_PARTIAL_PATH`, such as `raids/tempest-keep/bosses/alar.html`

The shell must keep the current boss architecture markup:

- `<body data-page-role="boss-view" data-raid-id="RAID_ID" data-boss-id="BOSS_ID">`
- Home link with `data-soft-reserve-anchor`
- Roster link with `data-roster-link`
- Boss tabs container with `data-boss-tabs`
- Raid-specific CSS file after `css/boss-sheet.css`
- Boss sheet container with `data-boss-sheet-container` and `data-boss-partial`
- Script stack in this order: `js/raid-nav.js`, `js/roster-storage.js`, `js/soft-reserve-link.js`, `js/session-client.js`, `js/roster-bindings.js`, `js/boss-sheet-loader.js`
- Inline init IIFE that imports roster data from the hash, loads the fragment, initializes roster bindings, and reloads on roster storage changes

Keep the top navigation bar minimal:

- Put the `Home` button on the left side of the `page-nav` bar. Keep its route unchanged, usually `index.html`.
- Put the `Roster` button and the `data-boss-tabs` boss tab container together on the right side.
- Do not include descriptive sheet-status text such as `sheet reads saved roster assignments` in the nav bar.
- Do not move or rename `data-boss-tabs`; shared navigation code depends on that container.

`raid-nav.js` resolves the roster route from `raid.json` `rosterPage` and targets `[data-roster-link]`. The shell should still include the `ROSTER_PAGE` fallback href so the link works before metadata enhancement.

Do not add page-specific boss content to the shell.

## 3) Keep the boss fragment content-only

Boss fragments must remain content-only. Your boss fragment must contain exactly one root node:

- `<div class="sheet"> ... </div>`

Do not add any of the following to boss fragments:

- `<!DOCTYPE html>`
- `<html>`, `<head>`, `<body>`
- `<script>`
- `<style>`
- Page nav/header controls
- Roster editor controls
- Loader containers

The shell, not the fragment, carries raid identity, page role, boss identity, nav, roster link, boss tabs, partial loading, scripts, and session wiring. Styling comes from `css/boss-sheet.css` plus the raid-specific shell stylesheet. Boss fragments should only provide sheet content.

## 4) Replace content placeholders

Update all placeholders in the copied fragment:

- `RAID_NAME`
- `BOSS_NAME`
- Phase titles, such as `PHASE_1_TITLE` and `PHASE_2_TITLE`
- Setup assignment columns and lines
- Mechanic names and descriptions
- Icon URLs, such as `ICON_URL_*`
- Sidebar image cards, using clean placeholder cards until real assets exist
- Wipe causes, such as `WIPE_CAUSE_*`
- Binding key placeholders, such as `<raid-prefix>-core-main-tank` and `<raid-prefix>-<boss-id>-raid-healers`

## 5) Preserve reusable class structure

Keep the class structure used by `css/boss-sheet.css` so layout remains consistent. Boss sheets normally include `boss-header`, `setup-block`, `main-layout`, `sheet-content`, the right-side `image-sidebar`, image placeholder cards, a wipe causes `reminder-card`, and `sheet-footer`. Codex should not omit the sidebar when creating new boss foundations from the template.

## 6) Use roster binding attributes and registered keys

Use these attributes for roster-driven values:

- `data-bind="..."` for single-slot values
- `data-bind-group="..."` for grouped values
- `data-target-bind="..."` for tank or target contextual displays
- `data-default="..."` for fallback text

Use this binding namespace convention:

- Raid-level reusable keys should use `<raid-prefix>-core-*`
- Boss-specific keys should use `<raid-prefix>-<boss-id>-*`

Examples:

- `tk-core-main-tank`
- `tk-core-raid-healers`
- `tk-alar-raid-healers`

Any new binding key used in a fragment must be registered in the raid roster architecture as appropriate:

- Add it to `roster-bindings.json` under `singleDefaults`, `groupDefs`, aliases, derived bindings, or labels as needed.
- Add it to `roster-schema.json` and the roster editor form when the key needs a user-editable roster slot.

Do not imply or assume that adding only `raid.json` is enough for roster-bound assignments. `raid.json` registers boss metadata and routes. Roster-bound assignments need binding config, schema, and editor support when editable.

## 7) Setup markup rules

When writing boss setup fragments, output final player-visible markup only:

- The top assignment block should use `setup-block`, `setup-grid setup-grid-5`, `setup-col`, `setup-col-label`, `setup-line`, and `line-text`.
- Prefer `setup-col-label` for column headings. Do not use `setup-heading` in new template examples unless a backward-compatible exception requires it.
- Add `setup-col-tanks` to the Tanks setup column so tank assignment targets can be styled distinctly.
- Do not add top assignment/setup prose above the setup grid.
- Assignment sections should begin directly with setup columns.
- Fight instructions belong in phase blocks, reminder cards, image captions, or a short `setup-note` only when a live sheet already uses that pattern.
- Top setup assignment rows use arrow formatting (`→`), not colon formatting.
- The top assignment block should include these standard columns in this order: `Tanks`, `Healers`, `Misdirects`, `Utility`, then `Kicks` only if the boss uses kicks.
- Treat `Utility` as the standard top-row utility assignment column aligned with `Tanks`, `Healers`, and `Misdirects`.
- Utility rows should use the visible labels `Elements`, `Recklessness`, and `Tongues`.
- Utility binding keys must be namespaced and registered, such as `<raid-prefix>-core-curse-of-elements`.
- The top assignment block should not include `Notes` or `Interrupts / Utility`.
- Notes belong in normal lower content and mechanics areas when needed.
- Use the optional `Kicks` column only for boss kick assignments.
- Normal kick rows should use `Kick 1 → Kicker`.
- Marker/channeler-style kick rows should use `Marker Icon Marker Icon Channeler → Kicker`.
- Keep marker/channeler kick wording generic so it can be adapted per boss.
- Do not write marker names as visible text when a marker icon is expected, for example avoid visible strings like `Skull marker`.
- Do not paste prose instructions like `Skull marker - Tank` directly into HTML output.
- Use concrete icon markup for raid markers, such as `<span class="role-icon-inline raid-marker-inline"><img ... alt="Skull"></span>`.
- Use raid marker icons from `assets/shared/markers/*`, for example `assets/shared/markers/skull.svg`, `moon.svg`, `cross.svg`, `square.svg`, and `diamond.svg`.
- Use `data-target-bind` for target references instead of adding a second visible `data-bind` for the same target value.
- Assigned player names should use `.role` when assigning a person directly and `.assignment-target` when showing a contextual target from another assignment.
- Assigned player names are emphasized, contextual target names stay softer unless they are inside the Tanks column, and unassigned placeholders remain muted/italic.

Standard row patterns:

- Tank rows: `Marker Icon Role Label → Tank Name`.
  - Put the assigned tank name inside `class="role unassigned"` with `data-bind`, such as `data-bind="RAID_PREFIX-core-main-tank"`.
- Healer rows: `Healer Assignment → Target Tank (Role Label)`.
  - Healer assignments that are roster list groups usually use `data-bind-group`, not `data-bind`.
  - Use live group keys such as `<raid-prefix>-core-mt-healers` and `<raid-prefix>-core-ot-healers` for tank healer groups.
  - Use `class="assignment-target"` with `data-target-bind` for the contextual tank target.
  - Use `class="role-label"` for the smaller gray assignment label, such as `(Main Tank)` or `(Off Tank)`.
  - Remove repeated healer spell icons from tank-healer rows.
  - Keep raid healers underneath tank healer rows when applicable, using `data-bind-group="RAID_PREFIX-core-raid-healers"` for reusable raid healers or `data-bind-group="RAID_PREFIX-BOSS_ID-raid-healers"` for boss-specific raid healers.
  - The Raid Healers row may keep the raid-healing icon and should use `Raid → Raid Healers` arrow formatting.
- Misdirect rows: `Hunter → Marker Icon Boss/Add Name → Target Tank`.
  - Use `data-bind-group` for hunter assignment groups and `data-target-bind` for target tank names.
  - Use the live core group keys `<raid-prefix>-core-mt-misdirect`, `<raid-prefix>-core-ot-misdirect`, `<raid-prefix>-core-ot-2-misdirect`, and `<raid-prefix>-core-ot-3-misdirect`.
  - Do not use a leading Hunter Misdirection spell icon in the top setup assignment section.
- Utility rows: `Elements → Warlock`, `Recklessness → Warlock`, and `Tongues → Warlock`.
  - Use namespaced `data-bind` keys such as `<raid-prefix>-core-curse-of-elements`, `<raid-prefix>-core-curse-of-recklessness`, and `<raid-prefix>-core-curse-of-tongues`, and register them before relying on roster data.
- Kick rows: `Kick 1 → Kicker` or `Marker Icon Marker Icon Channeler → Kicker`.
  - Use boss-specific namespaced `data-bind` keys, such as `<raid-prefix>-<boss-id>-kick-1`.

Do not use `assets/icons` paths for raid markers or placeholder icons. Do not inline SVG blobs, such as `data:image/svg`. Do not reference nonexistent image files.

## 8) Support assignment-only trash pages

An assignment-only trash page may intentionally contain only `boss-header`, `setup-block`, and `sheet-footer`. It may omit `main-layout`, phase blocks, sidebar images, and wipe cards. This is a documented exception to the normal boss sheet structure, not an incomplete boss page.

Assignment-only trash pages still require the normal boss shell, raid metadata, and roster binding architecture.

## 9) Use derived bindings for display-only rows

Use a `group-slot` derived binding for a marker-specific row backed by one editable roster list. Use `group-slot-modulo` to split one roster list into repeating display teams. Derived display keys should not be added to `roster-schema.json` unless they are directly editable.

For example, one editable `tk-trash-sheep` list can drive the derived display keys `tk-trash-square-sheep`, `tk-trash-moon-sheep`, `tk-trash-circle-sheep`, and `tk-trash-star-sheep`.

Roster-page local slot metadata, including minimum and maximum slot counts and per-slot marker labels, is acceptable when one editable list needs marker-specific UI rows. That metadata must not create separate schema fields for derived display rows.

When validating binding configuration, confirm that `singleDefaults` and `groupDefs` do not retain stale keys that are absent from the schema, aliases, derived bindings, and live fragments.

## 10) Sidebar image placeholders and wipe reminders

Every boss sheet should include the right-side `image-sidebar` inside `main-layout`, next to `sheet-content`, unless there is a documented exception. Codex should not omit this sidebar when creating new boss foundations from the template.

Draft boss fragments should use clean `image-card` placeholder cards until real positioning assets exist. Do not reference nonexistent image files. Broken placeholder paths produce browser broken-image icons and make draft sheets look unfinished.

- Placeholder cards can use boss-specific labels/captions, or this generic visible copy:
  - `Positioning image placeholder`
  - `Replace this with the real positioning asset when available.`
- When a real asset exists, use the standard static-asset path with the shared positioning image class:

  ```html
  <img class="positioning-img" src="assets/<raid-asset-folder>/bosses/<boss-id>/<image-name>.webp" alt="Useful alt text">
  ```

- `positioning-img` enables the shared click-to-enlarge lightbox behavior. Do not add inline `onclick` handlers.
- Every positioning image needs useful alt text that describes the diagram or screenshot.
- Every real `image-card` should include `image-card-label`, `img.positioning-img`, and `image-card-caption`.
- Use lowercase kebab-case filenames.
- Prefer `.webp` for compressed sheet images unless PNG transparency is required.
- Do not inline `data:image` or other base64 images.
- Do not store raid marker icons in boss image folders. Raid markers belong in `assets/shared/markers/`.
- Every boss sheet should include a wipe causes `reminder-card` in the sidebar. Use `reminder-card-label` for the heading and `reminder-list` for player-facing wipe causes.

## 11) Register raid metadata without changing public URLs

Add the new boss entry to the appropriate raid config when creating a new live boss:

- `raids/<raid-id>/raid.json`

Make sure id, label, and file path match your new boss fragment. This metadata is for boss navigation and fragment routing. It does not replace roster binding registration.

Keep public URLs immutable. Do not rename existing page filenames, change existing public routes, or move existing boss fragments unless a separate migration explicitly calls for it.

## 12) Add raid-specific images

Store boss diagrams/screenshots under the current generic static-asset convention:

- `assets/<raid-asset-folder>/bosses/<boss-id>/`

Reference those files from `image-card` sections with `img.positioning-img`, useful alt text, and lowercase kebab-case filenames. Keep the path generic to the raid asset folder. Do not point boss fragments at nonexistent files.

## 13) Validate both render contexts

Test in both contexts:

1. Public sheet view, which is the final player-facing boss page rendering
2. Editor/preview view, which covers assignment editing and bind propagation

Confirm:

- Bindings render correctly when roster values exist
- `data-default` text appears when values are missing
- Phase columns align correctly
- Real sidebar images load, or placeholder cards are used when assets are not available
- No nav, loader, script, or style markup was added to the boss content file

## New raid registration checklist

A new raid is not fully registered until all of the following exist:

- `raids/<raid-id>/raid.json`
- Root boss shell pages
- Boss fragments under `raids/<raid-id>/bosses/`
- A roster page
- `raids/<raid-id>/roster-schema.json`
- `raids/<raid-id>/roster-bindings.json`
- An `index.html` raid card
- A `worker/src/index.js` `RAID_CONFIGS` entry
- Worker tests updated for the new raid
- Cloudflare Workers Builds deployed from `main` after merge

The Worker rejects session creation for any `raidId` not present in `RAID_CONFIGS`. The Worker entry must include `rosterPage`, `defaultViewPage`, and `bossViewPages`; frontend `raid.json` is not enough for session-backed sharing. Do not add a Worker raid entry until the matching public pages exist.

## Naming decisions before generation

Choose names before generating boss pages because public URLs and binding keys should not be renamed casually after launch. For Hyjal, use:

- Raid id: `mount-hyjal`
- Binding prefix: `hyjal`
- Roster page: `hyjal-roster.html`
- Stylesheet: `css/boss-pages/hyjal.css`
- Asset folder: `assets/hyjal/`
- Raid folder: `raids/mount-hyjal/`

## Roster page source of truth

`templates/raid-roster-template.html` is local-only unless it is explicitly upgraded. For a new session-backed raid, copy the newest live session-backed roster page, currently `tk-roster.html` or `ssc-roster.html`, and adapt the raid id, schema path, guide page, `FIELD_META`, and `ROSTER_LAYOUT`.

Do not use `templates/raid-roster-template.html` for a raid that must support shared session links on day one. If the template is used, the PR must explicitly say the roster is local-only.

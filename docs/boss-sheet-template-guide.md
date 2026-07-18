# Boss Sheet Template Guide

Use the reusable fragments to create **new** raid sheets in the clean Mount Hyjal style. Template work must not modify live boss sheets; make live-sheet updates in a separate PR. The live files under `raids/mount-hyjal/bosses/` and `css/boss-pages/hyjal.css` are style and architecture references only, not files to edit for a template-only change.

## Boss pages

Copy `templates/boss-shell-template.html` for the public shell and `templates/boss-sheet-template.html` for its fragment. The shell owns identity, navigation, loading, roster wiring, and its existing script stack. The fragment remains exactly one `<div class="sheet">` root and contains no document tags, navigation, loader, scripts, styles, roster controls, or inline event handlers.

The clean boss layout is:

1. `boss-header` with `boss-zone` and `boss-name`.
2. A compact `setup-block` with ordinary `setup-col` boxes.
3. `main-layout`, `sheet-content`, and a right-side `image-sidebar`.
4. Role-column `phase-block` cards and a `sheet-footer`.

Use `setup-grid setup-grid-4` for the normal four columns, or `setup-grid setup-grid-5` only when an encounter genuinely needs the optional Kicks column. Keep columns in this order: **Tanks**, **Healers**, **Misdirects**, **Utility**, then **Kicks** when required. Utility and Misdirects are normal setup boxes. Do not add prose-heavy notes, empty decorative boxes, or nested custom boxes for ordinary assignments. Kicks are optional, not a default requirement.

### Concise setup rows

Use `setup-col-label`, `setup-line`, `role-icon-inline`, `raid-marker-inline`, and `line-text`. A direct player assignment is `class="role unassigned"`; a contextual tank reference is `class="assignment-target"` with `data-target-bind`; use `role-label` for compact context such as `(MAIN TANK)`.

- Tanks use marker icons and direct keys: `RAID_PREFIX-core-main-tank`, `RAID_PREFIX-core-off-tank`, plus `RAID_PREFIX-core-off-tank-2` and `RAID_PREFIX-core-off-tank-3` only when needed. Do not repeat marker names as visible text when the icon already says it.
- Healers use group bindings such as `RAID_PREFIX-core-mt-healers`, `RAID_PREFIX-core-ot-healers`, and optional `RAID_PREFIX-core-ot-2-healers` / `RAID_PREFIX-core-ot-3-healers`, followed by the tank target with `data-target-bind`. Use `RAID_PREFIX-core-raid-healers` for reusable raid healing or `RAID_PREFIX-BOSS_ID-raid-healers` when it is boss specific. An editable boss-specific raid-healer field requires roster schema, roster bindings, and roster-editor support.
- Misdirects put the hunter group first, then a marker and target: `RAID_PREFIX-core-mt-misdirect`, `RAID_PREFIX-core-ot-misdirect`, and optional `RAID_PREFIX-core-ot-2-misdirect` / `RAID_PREFIX-core-ot-3-misdirect`. Do not casually rename these keys or create marker-specific roster fields when a generic assignment group works.
- Utility uses concise rows for `RAID_PREFIX-core-curse-of-elements`, `RAID_PREFIX-core-curse-of-recklessness`, and only when needed `RAID_PREFIX-core-curse-of-tongues`, `RAID_PREFIX-core-decurse`, and `RAID_PREFIX-core-magic-dispel`.
- If the boss needs interrupts, add Kicks with boss-specific `RAID_PREFIX-BOSS_ID-kick-1` and `RAID_PREFIX-BOSS_ID-kick-2` bindings. Use labels such as `Kick 1 → Kicker 1`; do not imply every boss needs them.

Every editable binding must be registered in the appropriate roster architecture. `data-bind` is for a single slot; `data-bind-group` is for a group; `data-target-bind` displays an existing target assignment and does not create a second editable slot. Keep `data-default` fallback text on bound values.

### Mechanics and sidebar

Use `header-row`, `role-pill role-tank`, `role-pill role-healer`, and `role-pill role-dps`, then `phase-block`, `phase-bar`, `col-grid`, and `col col-tank` / `col-healer` / `col-dps`. Cards use `mech`, optionally `critical`, with `icon`, `mech-body`, `mech-name`, and `mech-desc`.

Write short, action-oriented player copy. Tank cards cover position, swaps, and target control; healer cards cover tank coverage, raid damage, and dispels; DPS cards cover target priority, interrupts, movement, and adds. Use placeholders such as `BOSS_MECHANIC`, `TANK_MECHANIC`, `RAID_DAMAGE`, `ADD_PHASE`, `MOVEMENT_MECHANIC`, and `WIPE_CAUSE` while drafting rather than generic documentation prose.

Keep the `image-sidebar`, an `image-card` placeholder when there is no asset, and a `reminder-card` for wipe causes. Never insert a fake or broken image path. A real local image may use `assets/<raid-asset-folder>/bosses/<boss-id>/<image-name>.webp` only after the file exists, with useful alt text. Do not use base64 images or copied guide/PDF images.

## Trash pages

Use `templates/trash-sheet-template.html` when trash needs assignments plus a field guide. A trash page may have a wider setup block and camp panels, but it still uses normal `setup-col` boxes: `setup-col-tanks`, Healers, `setup-col-misdirect-wide`, Warlocks or Control, and `setup-col-utility`. Do not use nested assignment boxes.

The trash setup template models main/off tanks, healer groups, optional misdirects, warlock control and curses, and utility. Add `data-hide-empty-row="true"` **to the bound span** for genuinely optional extra tanks or misdirects. Do not use decorative empty boxes. Avoid fragile whole-column hiding unless it is carefully scoped and tested; if an entire column is optional, document its CSS approach and browser support before relying on it.

### Generic roster fields and derived display rows

Keep roster-editor labels generic when the job is generic: `Kicker 1`, `Kicker 2`, `Kicker 3`; `Banish 1`, `Banish 2`, `Banish 3`; and `Fear Ward 1`, `Fear Ward 2` when applicable. The sheet may use encounter-specific display labels, for example `Necromancer/Banshee kicks` or a marker icon followed by `Banish`. Do not leak display labels back into generic roster fields.

One editable `RAID_PREFIX-core-banish` list can drive marker-specific display rows:

- `RAID_PREFIX-trash-triangle-banish`
- `RAID_PREFIX-trash-diamond-banish`
- `RAID_PREFIX-trash-circle-banish`

Define those display keys in `roster-bindings.json` `derivedBindings` using `group-slot`. Keep the editable generic list in `roster-schema.json` and the roster UI. Do **not** add derived marker display keys to `roster-schema.json` unless a real editing need makes them directly editable. This prevents marker-specific roster clutter. Apply the same model to generic kick lists that a trash sheet labels specifically.

### No-JS camp selector and NPC cards

Use radio inputs and labels styled as `trash-camp-button` controls inside `trash-camp-selector`; the first camp is checked by default. Raid-specific CSS shows the matching `trash-camp-panel` and hides the other panel. Do not add JavaScript or inline handlers. Use generic `CAMP_A_NAME` and `CAMP_B_NAME` placeholders unless documenting a labeled Hyjal example. Camp-specific NPCs belong only in the relevant panel.

Structure the guide as `trash-guide` → `trash-camp-guide` → panels → `phase-bar` and `trash-mob-grid`. Each `trash-mob-card` is ordered by kill priority and receives a `trash-priority-N` class, with border/outline color descending from red toward green. Include `trash-mob-portrait`, optional real `trash-mob-img`, `trash-mob-body`, `trash-mob-name`, visible `trash-kill-priority` text such as `Kill target 1`, `trash-ability-list`, `trash-tag`, and integrated `trash-handling` notes. Card order and the label communicate priority; do not add a separate kill-priority block. Do not include spell IDs.

Use a styled portrait placeholder when a local file does not exist. When it does exist, use `assets/<raid-asset-folder>/trash/<mob-name>.webp` and useful alt text. Never use broken image paths, remote image fallbacks, base64, or copied guide/PDF images. Camp selector labels may use icons, but prefer local assets or CSS-backed spans; visible text must stand on its own if an icon fails, and do not overlay fallback letters unless intentional.

### Trash CSS ownership

Put trash styling in the raid-specific stylesheet, scoped to the page or trash classes. Define styles for `trash-guide`, `trash-camp-selector`, `trash-camp-button`, `trash-camp-panel`, `trash-mob-grid`, `trash-mob-card`, `trash-priority-N`, `trash-mob-portrait`, and `trash-mob-img`; include `setup-col-utility` wrapping if needed. Do not edit shared boss CSS unless a class is truly reusable across raids.

## Validation and protection

Template changes must not modify live boss sheets, raid metadata, roster schemas, bindings, shared scripts, CSS, or assets. Live changes belong in separate PRs. Before submitting a live implementation that adds bindings, run:

```bash
node scripts/validate-roster-bindings.mjs
```

Also run `git diff --check`, inspect the changed-file list, and test the fragment through its existing shell in both public and roster-editor contexts. Keep public URLs unchanged.

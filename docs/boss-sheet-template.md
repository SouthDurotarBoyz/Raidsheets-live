# Boss sheet template standard

This document defines the reusable boss-sheet template standard for future raid, boss, and trash sheets. The current visual and structural source pattern comes from the newer SSC sheet format, but the rules below are generic and should be reusable for Gruul, SSC, TK, and future raids.

Use this as a reference before creating or revising a sheet. Future new boss pages should use the shared shell and fragment pattern instead of hand-copying full standalone HTML sheets.

## Root wrapper page standard

Root boss pages are lightweight wrappers. They should load shared styles, identify the raid and boss through `body` data attributes, provide screen navigation, load the boss fragment, and initialize shared scripts.

Root boss pages should:

- Use the shared boss sheet stylesheet: `css/boss-sheet.css`.
- Use the raid-specific stylesheet, such as `css/boss-pages/ssc.css` or `css/boss-pages/tk.css`.
- Set these `body` attributes:
  - `data-page-role="boss-view"`
  - `data-raid-id="[raid-id]"`
  - `data-boss-id="[boss-id]"`
- Include a screen-only page nav with Home and boss tabs.
- Load the boss fragment with a container using:
  - `data-boss-sheet-container`
  - `data-boss-partial="raids/[raid-id]/bosses/[boss-id].html"`
- Include the shared scripts:
  - `js/raid-nav.js`
  - `js/roster-storage.js`
  - `js/soft-reserve-link.js`
  - `js/session-client.js`
  - `js/roster-bindings.js`
  - `js/boss-sheet-loader.js`
- Initialize roster bindings only after `BossSheetLoader.loadAll()` completes.

Do not use new root wrapper pages as a place for full strategy markup. Put sheet content in the raid boss fragment so the shell remains reusable.

## Boss fragment standard

Boss fragments contain the printable and screen-visible sheet content loaded by the root wrapper. They should be self-contained fragments, not full HTML documents.

Boss fragments should:

- Start with `<div class="sheet">`.
- Include `.boss-header` with `.boss-zone` and `.boss-name`.
- Include a top `.setup-block` for assignments and essential pre-pull setup.
- Include `.main-layout` as the primary layout wrapper.
- Include `.sheet-content` for strategy cards and phase content.
- Use `.header-row` with role pills when the sheet has tank, healer, and DPS phase columns.
- Use `.phase-block` sections to separate major phases or repeated sections.
- Use `.col-grid` with tank, healer, and DPS columns for boss strategy content when applicable.
- Use `.image-sidebar` only when there are meaningful positioning or reference images.
- End with `.sheet-footer`.

Fragments should stay focused on reusable sheet structure, assignment display, and concise raid actions. They should not duplicate the root wrapper, shared scripts, global stylesheets, or navigation shell.

## Setup block standard

Use the newer SSC setup-row format as the standard visual pattern, while keeping the content generic for the raid or boss being authored.

Setup columns should generally be:

- Tanks
- Healers
- Misdirects
- Utility / Curses / Kicks / CC only when needed by that sheet

Do not add extra setup columns unless the fight actually needs them. A sheet with fewer required assignments should stay compact.

Setup row format:

- Every setup row should be inside `.setup-line`.
- The icon should appear first as:

  ```html
  <span class="role-icon-inline">...</span>
  ```

- The text should appear inside:

  ```html
  <span class="line-text">...</span>
  ```

Direct assigned player format:

```html
<span class="role unassigned" data-bind="[single-key]" data-default="[Fallback]">[Fallback]</span>
```

Assigned group format:

```html
<span class="role unassigned" data-bind-group="[group-key]" data-default="[Fallback]">[Fallback]</span>
```

Contextual target format:

```html
<span class="assignment-target" data-target-bind="[single-or-derived-key]"></span>
```

Role label format:

```html
<span class="role-label">([ASSIGNMENT LABEL])</span>
```

Keep assignment rows readable in the rendered sheet. Prefer a stable row pattern over one-off markup for individual encounters.

## Healer row standard

Assigned tank and special healer rows must use this format:

```text
[healing icon] [healer group] → [assigned target player] (TARGET LABEL)
```

Rules:

- Tank and special healer rows should show a healing icon.
- Use the Greater Heal icon for tank-healer style rows: `https://wow.zamimg.com/images/wow/icons/large/spell_holy_greaterheal.jpg`.
- Use the Prayer of Healing icon for raid healer rows: `https://wow.zamimg.com/images/wow/icons/large/spell_holy_prayerofhealing.jpg`.
- Tank and special healer rows should bind the healer group with `data-bind-group`.
- Tank and special healer rows should point at the assigned target with `.assignment-target` and `data-target-bind`.
- Raid healer rows usually stay direct group assignments with no target binding.
- Do not convert contextual healer targets into direct `data-bind` role spans.

Generic example:

```html
<div class="setup-line">
  <span class="role-icon-inline"><img src="https://wow.zamimg.com/images/wow/icons/large/spell_holy_greaterheal.jpg" alt="Healing"></span>
  <span class="line-text">
    <span class="role unassigned" data-bind-group="core-mt-healers" data-default="MT Healers">MT Healers</span>
    →
    <span class="assignment-target" data-target-bind="core-main-tank"></span>
    <span class="role-label">(MAIN TANK)</span>
  </span>
</div>
<div class="setup-line">
  <span class="role-icon-inline"><img src="https://wow.zamimg.com/images/wow/icons/large/spell_holy_greaterheal.jpg" alt="Healing"></span>
  <span class="line-text">
    <span class="role unassigned" data-bind-group="core-ot-healers" data-default="OT Healers">OT Healers</span>
    →
    <span class="assignment-target" data-target-bind="core-off-tank"></span>
    <span class="role-label">(OFF TANK)</span>
  </span>
</div>
<div class="setup-line">
  <span class="role-icon-inline"><img src="https://wow.zamimg.com/images/wow/icons/large/spell_holy_prayerofhealing.jpg" alt="Raid healing"></span>
  <span class="line-text">
    <span class="role unassigned" data-bind-group="raid-healers" data-default="Raid Healers">Raid Healers</span>
  </span>
</div>
```

The first two rows show `core-mt-healers → core-main-tank (MAIN TANK)` and `core-ot-healers → core-off-tank (OFF TANK)`. The raid healer row remains a direct `raid-healers` group assignment because it does not need a contextual target.

## Misdirect row standard

Hunter misdirect rows must use this format:

```text
[Misdirection icon] Hunter group → [target icon / target label] → [assigned target player]
```

Rules:

- Every Hunter misdirect row should show the Misdirection icon before the Hunter group: `https://wow.zamimg.com/images/wow/icons/large/ability_hunter_misdirection.jpg`.
- Hunter names should bind with `data-bind-group`.
- The target player should use `.assignment-target` and `data-target-bind`.
- Do not change hunter group binding behavior just to change visual row order.
- If row order changes, preserve `data-bind-group` and `data-target-bind` unless the assignment itself is intentionally changing.

Generic example:

```html
<div class="setup-line">
  <span class="role-icon-inline"><img src="https://wow.zamimg.com/images/wow/icons/large/ability_hunter_misdirection.jpg" alt="Misdirection"></span>
  <span class="line-text">
    <span class="role unassigned" data-bind-group="core-main-tank-misdirects" data-default="Hunters">Hunters</span>
    → <span class="role-label">(MAIN TANK)</span> →
    <span class="assignment-target" data-target-bind="core-main-tank"></span>
  </span>
</div>
```

## Special team row standard

Special team rows cover encounter-specific jobs that are neither standard tank/healer assignments nor Hunter misdirects.

Rules:

- Special team rows should use icon → label → assigned group.
- Labels should be clean and readable.
- Avoid unnecessary numbering in visible labels unless the number is actually needed for raid calls.
- Binding keys may keep numbers or direction names even if visible labels are simplified.
- Example: `Pylon (NW) → player/group`, while the binding key can remain something like `raid-boss-pylon-1-nw`.

Generic example:

```html
<div class="setup-line">
  <span class="role-icon-inline">...</span>
  <span class="line-text">
    <span class="role-label">Pylon (NW)</span>
    →
    <span class="role unassigned" data-bind-group="raid-boss-pylon-1-nw" data-default="Assigned team">Assigned team</span>
  </span>
</div>
```

## Content card standard

Content cards should communicate what the raid does, not reproduce a full guide.

Rules:

- Cards should be short and action-focused.
- Prefer 1–2 sentence mechanic descriptions.
- Avoid long guide paragraphs.
- Use role-specific columns when the mechanic response differs for Tanks / Healers / DPS.
- Use the `critical` class on high-priority wipe-causing mechanics.
- Keep strategy text separate from assignment bindings.
- Do not place roster assignment logic inside strategy cards unless the card needs to display the assigned player.

Use `.phase-block` to group related cards, and use `.col-grid` when separate role instructions are clearer than a single shared card.

## Binding safety rules

Assignment bindings are part of the roster architecture and should be treated as stable interfaces.

Rules:

- Do not invent binding keys in boss fragments unless schema and roster form changes are part of the same scoped PR.
- Prefer existing raid core bindings when possible.
- Single-player assignments use `data-bind`.
- Multi-player/group assignments use `data-bind-group`.
- Displaying the assigned target uses `.assignment-target` with `data-target-bind`.
- Do not rename schema keys casually.
- Do not update `roster-bindings.json`, `roster-schema.json`, or roster HTML unless the task explicitly requires assignment architecture changes.
- Visual formatting PRs should not change binding architecture.

## PR workflow standard

Keep Codex and contributor work scoped and reviewable.

Rules:

- One scoped PR at a time.
- Allowed files and forbidden files must be explicit.
- Runtime changes and documentation/template changes should usually be separate PRs.
- Every prompt should include validation commands, expected changed files, do-not-commit conditions, and manual browser expectations.
- Prefer repo-grounded edits based on current `main`.
- Do not reuse old branches or stale PR assumptions.

## New sheet checklist

- [ ] Root wrapper uses shared shell pattern.
- [ ] Fragment uses `.sheet` / `.boss-header` / `.setup-block` / `.main-layout`.
- [ ] Setup rows use icon + `line-text`.
- [ ] Direct player assignments use `role unassigned` + `data-bind`.
- [ ] Group assignments use `role unassigned` + `data-bind-group`.
- [ ] Contextual targets use `assignment-target` + `data-target-bind`.
- [ ] Healer rows show healer group → target player (LABEL).
- [ ] Misdirect rows show MD icon before Hunter group.
- [ ] Raid healer rows stay direct group assignments unless a target is needed.
- [ ] Special team visible labels are clean; binding keys remain stable.
- [ ] Strategy cards are short, role-specific, and action-focused.
- [ ] No schema/binding/roster changes unless intentionally scoped.

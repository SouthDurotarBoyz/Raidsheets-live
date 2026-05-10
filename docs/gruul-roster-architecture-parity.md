# Gruul roster architecture parity

## SSC/TK architecture patterns now matched

- `roster.html` now uses the SSC/TK shell shape: a small static toolbar, a `.roster-form` with a `.roster-header`, a generated `#roster-sections` container, `window.RaidConfig`, shared `roster-storage.js`, and shared `roster-ui-helpers.js`.
- Rendering now follows the SSC/TK data-driven path: schema fields are loaded from `raids/gruuls-lair/roster-schema.json`, normalized into `{ groups, singles }`, and rendered through common helpers for sections, block columns, single rows, list rows, inline list controls, and copy-button feedback.
- Gruul-specific behavior is isolated in `GRUUL_ROSTER_CONFIG` plus narrowly named hooks (`offTankRowConfig`, target-resolution helpers, and `migrateOldState`) instead of being embedded as a fixed legacy HTML string.
- Add/remove behavior now mutates the normalized state and re-renders through the same generated roster path used by SSC/TK instead of updating a legacy hand-authored DOM fragment.
- Soft Reserve input binding uses shared `bindSoftReserveInput` and persists under the preserved `soft-reserve-url` key in `state.singles`.

## Gruul behaviors intentionally rebuilt

- Maulgar off-tank labels were rebuilt as a Gruul hook:
  - one `off-tanks` slot renders as the combined Blindeye/Olm tank,
  - two slots split into Blindeye Tank and Olm Tank,
  - three or more slots render additional rows as `Extra Off Tank N`.
- Kiggler tanks remain a list field with the preserved `kiggler-tanks` key and Diamond marker treatment.
- Hunter misdirect rows were rebuilt as generated list rows with live target labels. The labels update when tank inputs change and when off-tank slot counts change.
- Public guide link generation was rebuilt so local links export the current saved roster through the existing `#roster=` hash path, while session-backed links carry `?session=` without exposing edit keys.
- Session-backed load/save/clear remains available through `RaidSessionClient`/`GruulsSessionClient`, but the roster page now treats it as a storage adapter around the same normalized state shape.
- Hash export remains compatible with boss pages because boss pages already import `#roster=` through `RaidRosterStorage.importRosterFromHash()` before binding assignments.

## Broken legacy behaviors not preserved

- The old hard-coded `universalRosterHtml()` roster body was not preserved. It blocked SSC/TK-style schema/layout comparison and mixed Gruul mechanics with DOM construction.
- The old unused roster-link helper path was not preserved as a separate behavior. Link generation is now one explicit `rosterUrl()` path for public guide links.
- Empty optional Kiggler/Blindeye misdirect rows are no longer treated as legacy quirks outside normalization. They are normal configured list defaults so the UI and saved state agree.
- Legacy fields are migrated only into current canonical fields. The rebuilt roster does not keep rendering or saving obsolete field names after migration.

## Compatibility pieces that remain

- Canonical field keys remain unchanged for boss-page compatibility: `main-tank`, `off-tanks`, `mage-tank`, `kiggler-tanks`, `main-tank-healers`, `off-tank-healers`, `kiggler-healer`, `mage-tank-healer`, `raid-healers`, `md-maulgar`, `md-ot`, `md-blindeye`, `md-kiggler`, `blindeye-kicks`, `curse-elements`, `curse-reck`, `curse-tongues`, `enslave-warlocks`, and `soft-reserve-url`.
- Legacy migration remains for known older Gruul local-storage keys such as `maulgar-tank`, `gruul-tank`, `ot-blindeye-olm`, `kiggler-tank`, `gruul-raid-healers`, and indexed Blindeye kick fields.
- The page still includes `session-client.js` because current Gruul boss pages support `?session=` view links and shared session storage.
- The page still uses the existing Gruul raid schema instead of changing schemas, boss pages, or shared JavaScript.

## Gaps versus SSC/TK

- Gruul still has session-backed behavior and hash export on the roster page, while current SSC/TK roster pages are local-only public guide links. This is intentionally retained for compatibility with existing Gruul boss-page/session flows.
- Gruul still needs compatibility migration for historical field names. SSC/TK pages do not need those aliases.
- Gruul has fight-specific off-tank and misdirect target hooks that are more dynamic than SSC/TK's static field metadata.

## Manual browser test checklist before deleting old compatibility code

1. Open `roster.html` from a static server and confirm the generated roster renders.
2. Enter values for all preserved canonical fields and refresh; confirm local save/load works.
3. Enter a Soft Reserve URL, refresh `roster.html`, then open a copied guide link and confirm the Soft Reserve button appears on boss pages.
4. Copy the public guide link in local mode and confirm it contains a `#roster=` hash and opens `maulgar.html` with assignments bound.
5. Open `roster.html?session=<id>&key=<edit-key>` and confirm load/save/clear call the session-backed path when a valid session exists.
6. Open the session public guide link and confirm it uses `maulgar.html?session=<id>` without the edit key.
7. Confirm one off-tank row is labeled Blindeye/Olm Tank.
8. Add a second off-tank and confirm row labels split to Blindeye Tank and Olm Tank.
9. Add a third off-tank and confirm the extra row is labeled Extra Off Tank 3.
10. Confirm Kiggler tank rows render with the Diamond marker and save under `kiggler-tanks`.
11. Type or change main tank, off tanks, and Kiggler tanks and confirm hunter misdirect target labels update live.
12. Open `maulgar.html` and `gruul.html` from local and hash links and confirm boss-page bindings receive assignment data.
13. Seed local storage with old legacy keys and confirm migration fills canonical fields without continuing to save obsolete field names.

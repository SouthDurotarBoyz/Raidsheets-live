# Shared JS Architecture Audit

## Summary

This audit records the current shared JavaScript architecture after Legacy Retirement Plan Tasks 1 through 8. See [Legacy Retirement Plan Status](legacy-retirement-plan.md) for the completed cleanup sequence. No code changes are included in this docs truth pass.

Overall status:

- `js/session-client.js`: **Pass with watch items**. It uses explicit page metadata for page role, raid identity, and boss identity. `?edit=` is the only query edit-token source.
- `js/roster-storage.js`: **Pass with watch items**. Storage keys are raid-scoped, built lazily, and refuse to resolve without explicit raid identity.
- `js/raid-nav.js`: **Pass**. Navigation reads raid metadata, uses metadata roster routes, and targets explicit roster-link anchors.
- `js/boss-sheet-loader.js`: **Pass**. Generic loader and lightbox behavior. Partial paths are page-authored.
- `js/soft-reserve-link.js`: **Pass with watch items**. It uses the shared soft-reserve key, avoids localStorage initialization on session-backed pages, waits for roster updates, and uses explicit nav anchors.
- `js/roster-ui-helpers.js`: **Pass with watch items**. Generic UI helpers remain shared. `bindSoftReserveInput()` now reads the shared soft-reserve key when no explicit key is passed and writes soft-reserve values to roster `meta`.

The remaining risks are ordinary shared-module risks: pages must provide the expected metadata, editor-only helpers must not be bound into read-only pages, and shared UI conventions must be kept consistent when future pages are added.

## File-by-file audit

### `js/session-client.js`

#### Current responsibility

- Detects the current page role from `data-page-role`.
- Detects the current raid from `data-raid-id` or `RaidConfig.raidId`.
- Detects the current boss from `data-boss-id`.
- Reads public-code, session, and `?edit=` query parameters.
- Loads rosters from the session API when session-backed or public-code backed.
- Falls back to `RaidRosterStorage` for local mode.
- Creates sessions and saves debounced roster updates through the session API.
- Prevents cross-raid session usage when both the page session and API payload expose `raidId`.

#### Generic/shared status: Pass with watch items

The client is metadata-driven and does not hardcode Gruul, SSC, TK, boss IDs, assignment names, or roster field names. It no longer depends on path-derived boss IDs or path and DOM role heuristics as current behavior.

#### Current architecture notes

- Page role is explicit through `data-page-role`.
- Raid identity is explicit through `data-raid-id` or `RaidConfig.raidId`.
- Boss identity is explicit through `data-boss-id`.
- `?edit=` is the only query edit-token source.
- Public-code mode is read-only by mode and `saveSessionRoster()` returns `false` unless the current session is edit mode with a session ID and edit token.
- Boss pages with `?session=` are view mode. Roster-editor pages with `?session=` and `?edit=` can save.
- Local mode remains available through `RaidRosterStorage` when the page is not session-backed.

#### Remaining risks

- Pages that load the client must provide correct metadata. Missing `data-page-role`, missing raid identity, or missing `data-boss-id` on a boss page will block or limit shared behavior.
- Local-mode save and clear calls are still available to consumers that call them. Read-only pages should not wire mutating UI paths.

---

### `js/roster-storage.js`

#### Current responsibility

- Defines local roster storage format and version.
- Resolves the current raid ID from explicit page or session context.
- Builds raid-scoped localStorage keys.
- Loads, saves, and clears rosters in localStorage.
- Imports roster state from `#roster=` when the page is an explicit roster editor for a known raid.

#### Generic/shared status: Pass with watch items

The storage API is raid-scoped and now requires explicit raid identity. It no longer has a current Gruul default raid ID path.

#### Current architecture notes

- Storage keys use `raidSheet:<raidId>` once a raid ID resolves.
- `getStorageKey()` is the normal key path.
- `RaidRosterStorage.STORAGE_KEY` is a lazy getter that calls `getStorageKey()` instead of capturing a key at script load.
- Key construction refuses to continue when no raid ID resolves.
- Hash import requires `data-page-role="roster-editor"` and explicit raid identity before writing localStorage.
- Soft Reserve data is normalized into roster `meta` through the shared `SOFT_RESERVE_KEY`.

#### Remaining risks

- The storage layer intentionally exposes write primitives for local roster mode. Callers must keep read-only pages from invoking save or clear behavior.
- Pages without explicit raid identity cannot use local storage. This is expected, but it means new pages must include the metadata before local mode will work.

---

### `js/raid-nav.js`

#### Current responsibility

- Reads `body[data-raid-id]` and `body[data-boss-id]`.
- Fetches `raids/<raidId>/raid.json`.
- Reads `raid.rosterPage` for the roster route.
- Uses `[data-roster-link]` for the roster link.
- Hides roster links in session or public-code mode.
- Builds boss-tab navigation from raid metadata.
- Preserves relevant query parameters in generated navigation links.

#### Generic/shared status: Pass

This file is generic enough for the current multi-raid architecture. It does not contain hardcoded raid IDs, boss IDs, Gruul/SSC/TK names, roster fields, or assignment names.

#### Current architecture notes

- Navigation metadata path is convention-based: each raid has `raids/<raidId>/raid.json`.
- Boss tabs come from the metadata `bosses` array.
- Roster links come from `raid.rosterPage`, not from a hardcoded route.
- Roster-link DOM wiring uses `[data-roster-link]`.
- Session and public-code modes hide the roster link to avoid sending viewers to editor routes.

#### Remaining risks

- Future raid metadata must include valid `rosterPage` and boss `page` values.
- Page shells must include the expected navigation anchors for nav enhancement.

---

### `js/boss-sheet-loader.js`

#### Current responsibility

- Loads boss sheet partial HTML into elements marked with `[data-boss-sheet-container]`.
- Reads partial URLs from each container's `data-boss-partial` attribute.
- Initializes image accessibility affordances for `.positioning-img` images.
- Provides a reusable lightbox for boss positioning images.

#### Generic/shared status: Pass

This file is generic shared UI infrastructure. It has no hardcoded raid IDs, boss IDs, field names, assignment names, or raid-specific folder paths.

#### Remaining risks

- Partial paths remain page-authored, so each boss shell must provide the correct `data-boss-partial`.
- The image UI assumes the established boss-sheet CSS conventions.

---

### `js/soft-reserve-link.js`

#### Current responsibility

- Reads the soft-reserve URL from roster state using the shared `RaidRosterStorage.SOFT_RESERVE_KEY`.
- Displays the URL as a page-nav button.
- Skips localStorage initialization on session-backed or public-code pages.
- Waits for `updateFromRoster()` on session-backed pages so the session roster is the source of truth.
- Uses explicit `[data-soft-reserve-anchor]` or `[data-home-link]` anchors for insertion.
- Exposes a debug helper for current link state.

#### Generic/shared status: Pass with watch items

The module is session-aware and anchor-based. It no longer relies on legacy storage aliases or Home href/text matching as current behavior.

#### Current architecture notes

- The soft-reserve field key comes from `RaidRosterStorage.SOFT_RESERVE_KEY`.
- The displayed value is read from roster `meta`, with normalized roster state handling legacy input shapes before display.
- Session-backed and public-code pages wait for roster data rather than showing stale localStorage state.
- Local mode can still initialize from localStorage for roster pages and local boss views.

#### Remaining risks

- The feature still assumes the shared soft-reserve field exists for raids that want the button.
- Pages that want deterministic placement must include `[data-soft-reserve-anchor]` or `[data-home-link]`.

---

### `js/roster-ui-helpers.js`

#### Current responsibility

- Provides WoW icon URL generation.
- Provides local raid marker asset lookup.
- Provides clipboard-copy helper behavior.
- Binds a soft-reserve input to a roster state object and save callback.

#### Generic/shared status: Pass with watch items

The marker, icon, and clipboard helpers are generic for this application. The soft-reserve input helper is feature-specific but now reads the shared soft-reserve key when no explicit key is passed and writes to roster `meta`.

#### Current architecture notes

- `bindSoftReserveInput()` uses an explicit `options.key` when supplied.
- Without `options.key`, it reads `RaidRosterStorage.SOFT_RESERVE_KEY`.
- It migrates any existing soft-reserve value from `singles` to `meta` in the active roster state.
- It writes current input values to `activeState.meta[key]` and calls the supplied save callback.

#### Remaining risks

- `bindSoftReserveInput()` is mutating UI behavior and should only be bound on editor-capable pages.
- The helper still has soft-reserve-specific semantics, so it should not be treated as a generic arbitrary metadata input helper.

## Current watch list

1. Keep explicit page metadata mandatory for pages that load shared session or storage modules.
2. Keep editor-only mutation helpers out of read-only boss, session view, and public-code views.
3. Keep raid metadata complete when adding new raids, especially `rosterPage` and boss page routes.
4. Keep soft-reserve anchors explicit on pages that display the nav button.

## No action needed from completed tasks

The following completed migrations should not be reopened as future work in docs:

1. Explicit `data-page-role`, `data-raid-id` or `RaidConfig.raidId`, and `data-boss-id` metadata are the current session-client contract.
2. Storage key construction is lazy and refuses missing raid identity.
3. Hash import is roster-editor and raid-identity gated.
4. Raid navigation uses metadata roster routes and `[data-roster-link]`.
5. Soft Reserve is session-aware, uses the shared `SOFT_RESERVE_KEY`, and uses explicit anchors.
6. `?key=` edit-token compatibility is retired.

# Shared JS Architecture Audit

## Summary

This audit reviewed the remaining shared JavaScript files for hidden raid-specific assumptions after `js/roster-bindings.js` was moved to schema/config-driven behavior. No code changes are included in this PR.

Overall status:

- `js/session-client.js`: **Warning**. Mostly generic, but it uses filename heuristics for boss IDs and falls back to local storage in local mode.
- `js/roster-storage.js`: **Warning**. Shared keying is raid-aware, but `DEFAULT_RAID_ID = "gruuls-lair"` and hash import write behavior are hidden defaults with future-raid risk.
- `js/raid-nav.js`: **Pass**. Navigation now comes from `raids/<raidId>/raid.json`; remaining assumptions are page-shell conventions, not raid-specific IDs.
- `js/boss-sheet-loader.js`: **Pass**. Generic loader and lightbox behavior; partial paths are page-authored, not hardcoded in the shared file.
- `js/soft-reserve-link.js`: **Warning**. It is functionally shared, but the data source is hardcoded to `singles["soft-reserve-url"]` and it reads local storage during automatic initialization.
- `js/roster-ui-helpers.js`: **Warning**. Icon/marker helpers are generic for WoW raid UI, but `bindSoftReserveInput` has a hardcoded default input ID and expects a roster `singles` key supplied by callers.

Main theme: most shared files are safe for SSC/TK and similar future raids if those raids follow the current page-shell conventions. The remaining non-generic areas are not embedded boss logic; they are shared assumptions about identity discovery, local-storage fallback, soft-reserve metadata, and DOM/nav conventions.

## File-by-file audit

### `js/session-client.js`

#### Current responsibility

- Detects the current raid, boss, and page mode.
- Reads public-code, session, edit-token, and key query parameters.
- Loads rosters from the session API when session/public-code backed.
- Falls back to `RaidRosterStorage` for local mode.
- Creates sessions and saves debounced roster updates through the session API.
- Prevents cross-raid session usage when both the page session and API payload expose `raidId`.

#### Generic/shared status: Warning

The file is mostly generic and does not hardcode Gruul, SSC, TK, boss IDs, assignment names, or roster field names. However, it contains implicit shared architecture assumptions that should be documented or eventually extracted.

#### Raid-specific assumptions found

- **Raid ID detection is generic but dependent on page conventions.** It checks `window.RaidConfig.raidId`, then `body[data-raid-id]`, then storage-derived raid ID. This supports current raids but assumes future pages expose one of those signals.
- **Boss ID detection has a filename fallback.** It uses `body[data-boss-id]` first, then derives the boss ID from the current `.html` filename and excludes `roster` / `*-roster`. This is not Gruul-specific, but it assumes one boss per HTML filename and could misclassify future non-boss utility pages unless those pages avoid loading this script or explicitly set no boss context.
- **Role detection is DOM/filename based.** Roster editor mode depends on `roster.html`, `*-roster.html`, `.roster-form`, or `[data-roster-editor]`. This is generic enough for current pages but is still a convention hidden in shared code.
- **Public code mode is global.** A valid `code` query parameter makes the page session-backed even without a `session` parameter. This is generic, but future unrelated pages using a five-character `code` parameter could be accidentally interpreted as public roster mode if this script is loaded there.
- **API payload assumptions are minimal but fixed.** The client accepts `payload.roster` or `payload.payload`, expects `payload.raidId` for strict cross-raid validation when available, and writes `{ roster: safeRoster(roster) }` on save. This is shared session API coupling, not raid-specific logic.
- **No Gruul default in this file.** `emptySession()` defaults to configured raid ID or `null`, not Gruul. The only default raid risk enters indirectly through `RaidRosterStorage.getCurrentRaidId()`.
- **Local mode storage fallback can read/write on any page that calls it.** `loadSessionRoster()`, `saveSessionRoster()`, and `clearSessionRoster()` delegate to local storage when not session-backed. This is expected for roster editors, but boss pages or public pages that accidentally call save/clear in local mode could mutate local storage.

#### Storage/session/public-code risk

- Local storage is only used through `RaidRosterStorage` when `session.isSessionBacked` is false.
- Public-code mode is read-only by mode (`view`) and `saveSessionRoster()` returns `false` unless in edit mode with `sessionId` and edit token.
- Boss pages with `?session=` are forced into `view` mode even if an edit token is present, which is safe for preventing boss-page writes to a session.
- The main remaining storage risk is local-mode call sites, not this file's session-mode branch.

#### Risk level: Medium

Medium because a future page can be misclassified by URL/DOM heuristics, and because local-mode storage writes are available to any shared consumer that calls save/clear. The risk is architectural, not currently raid-breaking.

#### Recommended fix, if needed

- Add an explicit page-role signal such as `body[data-page-role="roster-editor|boss-view|other"]` and prefer it over filename/DOM heuristics.
- Require or strongly prefer `body[data-boss-id]` for boss pages; keep filename fallback only as legacy compatibility.
- Consider making local-mode save/clear explicit to editor pages, or requiring a write-capability flag from the caller.
- Keep the existing session API shape unless backend requirements change.

#### Fix timing

**Fix soon** for explicit page role and boss ID declarations if more raids/pages are being added. **Later cleanup** for removing filename fallbacks after all pages have explicit metadata.

---

### `js/roster-storage.js`

#### Current responsibility

- Defines local roster storage format and version.
- Computes the current raid ID.
- Builds raid-scoped localStorage keys.
- Loads, saves, and clears rosters in localStorage.
- Imports roster state from a URL hash and writes it to localStorage.

#### Generic/shared status: Warning

The storage API is raid-scoped and mostly shared, but the file still contains the clearest explicit Gruul assumption in the audited set: `DEFAULT_RAID_ID = "gruuls-lair"`.

#### Raid-specific assumptions found

- **Hardcoded default raid ID.** If no session, `RaidConfig`, or `body[data-raid-id]` is available, `getCurrentRaidId()` falls back to `gruuls-lair`. This preserves legacy behavior but is not truly generic shared architecture.
- **Storage key generation is generic once a raid ID is known.** Keys use `raidSheet:<raidId>`, so SSC/TK/future raids are isolated when pages provide a raid ID.
- **The exported `STORAGE_KEY` is evaluated at script load.** It captures whatever `getStorageKey()` returns when the script initializes. If loaded before page metadata or session state is stable, `STORAGE_KEY` can reflect the Gruul fallback while `getStorageKey()` later returns the intended raid key. This is a subtle legacy/export risk.
- **`importRosterFromHash()` writes localStorage immediately.** Any page with `#roster=...` that loads this script and calls import can write into the current raid key. If no raid ID is configured, it writes into the Gruul default key.
- **No boss-page write protection.** The storage layer intentionally exposes read/write primitives and does not know whether the caller is a roster editor, boss page, public code page, or session-backed page.
- **No roster field names or boss names.** The file does not hardcode roster schema fields or assignments.

#### Storage/session/public-code risk

- All persistence is localStorage-based; this is correct for local mode but must be guarded by higher-level session code and page call sites.
- `getCurrentRaidId()` can call `RaidSessionClient.getCurrentSession().raidId`, so session mode can influence storage key choice even though session-backed reads/writes should normally bypass localStorage.
- Public-code pages should not write through this layer, but this file does not enforce that itself.

#### Risk level: Medium

Medium because the hardcoded Gruul fallback can silently route unknown/misconfigured pages into Gruul's storage namespace, and hash imports can mutate storage if invoked on the wrong page.

#### Recommended fix, if needed

- Replace `DEFAULT_RAID_ID = "gruuls-lair"` with an explicit required raid ID for new shared behavior, while preserving a compatibility shim only for legacy Gruul pages if necessary.
- Remove or deprecate the exported eager `STORAGE_KEY` value in favor of `getStorageKey()`.
- Make `importRosterFromHash()` require an explicit raid ID or editor context before writing.
- Keep storage primitives simple, but enforce editor/session-mode write policy at call sites or through a thin safe wrapper.

#### Fix timing

**Fix soon** for the default raid fallback and hash-import write guard. **Later cleanup** for the eager `STORAGE_KEY` export if no callers depend on it.

---

### `js/raid-nav.js`

#### Current responsibility

- Reads the current `body[data-raid-id]` and `body[data-boss-id]`.
- Fetches `raids/<raidId>/raid.json`.
- Builds boss-tab navigation from the raid metadata's `bosses` array.
- Propagates `?session=<id>` into boss-tab links.
- Hides the static roster link in session mode.

#### Generic/shared status: Pass

This file is generic enough for the current multi-raid architecture. It does not contain hardcoded raid IDs, boss IDs, Gruul/SSC/TK names, roster fields, or assignment names.

#### Raid-specific assumptions found

- **Navigation metadata path is convention-based.** The file assumes every raid has `raids/<raidId>/raid.json` and that the JSON contains a `bosses` array with `id`, `page`, `icon`, and display-name fields.
- **DOM conventions are fixed.** It expects `[data-boss-tabs]`, `body[data-raid-id]`, `body[data-boss-id]`, and a static roster link matching `.page-nav-actions a[href="roster.html"]` when hiding the roster link.
- **Session propagation only carries `session`.** It does not carry `code`, `edit`, or other query parameters to boss pages. For boss view pages this is mostly expected, but public-code navigation may depend on the session API/client behavior elsewhere.
- **The roster-link selector is Gruul-shaped.** It only matches `href="roster.html"`. SSC/TK roster pages use different filenames, so this hiding behavior may not apply there. This is not a raid data assumption, but it is a legacy page-route assumption.

#### Storage/session/public-code risk

- Does not read or write localStorage.
- Does not mutate roster/session data.
- Only mutates navigation DOM.

#### Risk level: Low

Low because future raids can be added by creating `raids/<raidId>/raid.json` and authoring page shells with the expected data attributes. The roster-link hiding selector is worth fixing but does not corrupt data.

#### Recommended fix, if needed

- Eventually drive the roster URL and boss pages entirely from raid metadata, including a metadata-defined roster page path.
- Change the roster-link hiding selector to a generic data attribute such as `[data-roster-link]` rather than `a[href="roster.html"]`.
- Consider preserving relevant query parameters (`session`, maybe `code`) through metadata-driven URL helpers.

#### Fix timing

**Later cleanup**. This file does not block adding new raids if page shells and `raid.json` follow current conventions.

---

### `js/boss-sheet-loader.js`

#### Current responsibility

- Loads boss sheet partial HTML into elements marked with `[data-boss-sheet-container]`.
- Reads partial URLs from each container's `data-boss-partial` attribute.
- Initializes image accessibility affordances for `.positioning-img` images.
- Provides a reusable lightbox for boss positioning images.

#### Generic/shared status: Pass

This file is generic shared UI infrastructure. It has no hardcoded raid IDs, boss IDs, field names, assignment names, or raid-specific folder paths.

#### Raid-specific assumptions found

- **Partial path is page-authored.** The loader does not construct `raids/<raidId>/bosses/<bossId>.html`; it trusts `data-boss-partial`. This avoids hidden raid assumptions but requires every boss shell to provide the correct path.
- **CSS/class conventions are fixed.** The lightbox and image affordances assume `.positioning-img`, `.image-card`, and `.image-card-caption` conventions. These are shared boss-sheet UI conventions, not Gruul-specific data assumptions.
- **Text labels use generic boss language.** ARIA labels mention boss positioning images, which is appropriate for boss pages but means the file is specifically shared boss-sheet infrastructure rather than universal partial loading.

#### Storage/session/public-code risk

- Does not use localStorage.
- Does not call session APIs.
- Does not mutate roster data.

#### Risk level: Low

Low. The file is safe for SSC/TK/future boss sheets as long as they use the established data attributes and CSS classes.

#### Recommended fix, if needed

- No immediate fix needed.
- Optional later enhancement: add a metadata-driven helper that can derive the partial path from `raidId` and `bossId`, while continuing to support explicit `data-boss-partial` paths.

#### Fix timing

**No action needed** for the current audit. Optional helper work belongs in **later cleanup** only.

---

### `js/soft-reserve-link.js`

#### Current responsibility

- Reads a soft-reserve URL from roster state.
- Normalizes and displays the URL as a button in `.page-nav` after the Home link.
- Can update directly from an in-memory roster state.
- Automatically initializes from local storage when the DOM is ready.
- Exposes a debug helper for current link state.

#### Generic/shared status: Warning

The file is generic in the sense that it contains no boss IDs or raid IDs, but it encodes a roster-field assumption directly in shared code: `singles["soft-reserve-url"]` is the source of truth.

#### Raid-specific assumptions found

- **Hardcoded roster key.** `SOFT_RESERVE_KEY = "soft-reserve-url"` assumes every raid stores this feature in `state.singles["soft-reserve-url"]`. Current raids appear to share that field, but this should ideally be metadata/schema-derived.
- **Storage fallback includes legacy alias.** `getStorage()` accepts `global.GruulsRosterStorage` as a fallback. That is a legacy Gruul compatibility assumption in shared code.
- **Raid ID detection mirrors shared conventions.** It checks an explicit argument, `body[data-raid-id]`, `RaidConfig.raidId`, then `storage.getCurrentRaidId()`. If storage falls back to Gruul, this file can read Gruul's soft-reserve URL on misconfigured pages.
- **Automatic init reads local storage.** On DOM ready, it calls `init()` and loads from localStorage via `storage.loadRoster()`. This can conflict with session/public-code mode if the page expects the session roster to be the only source of truth and does not later call `updateFromRoster()`.
- **Page-nav structure is assumed.** It looks for `.page-nav`, then `a[href="index.html"]` or a link whose text is exactly `Home`. This is a shared page-shell assumption, not a raid-specific ID, but it is brittle for future layouts.
- **No direct writes.** It does not mutate roster state or localStorage.

#### Storage/session/public-code risk

- The file reads localStorage during automatic initialization.
- It does not know whether the current page is in session mode, edit mode, view mode, or public-code mode.
- If session-backed roster data arrives later and calls `updateFromRoster()`, the link self-corrects. If not, a session/public page could display stale local soft-reserve data.

#### Risk level: Medium

Medium because this can surface the wrong soft-reserve link in session/public-code contexts and because the field source belongs in raid schema/metadata rather than a shared hardcoded constant.

#### Recommended fix, if needed

- Move the soft-reserve field key to raid schema/metadata or a shared feature config, rather than hardcoding `soft-reserve-url` here.
- Make automatic initialization session-aware: if `RaidSessionClient.getCurrentSession().isSessionBacked` is true, avoid localStorage reads and wait for `updateFromRoster()`.
- Replace the legacy `GruulsRosterStorage` fallback when migration is complete.
- Use an explicit insertion anchor such as `[data-soft-reserve-anchor]` or `[data-home-link]` instead of text/href matching.

#### Fix timing

**Fix soon** for session-aware initialization and metadata/config source of truth. **Later cleanup** for removing the Gruul storage alias and making nav insertion anchors explicit.

---

### `js/roster-ui-helpers.js`

#### Current responsibility

- Provides WoW icon URL generation.
- Provides local raid marker asset lookup.
- Provides clipboard-copy helper behavior.
- Binds a soft-reserve input to a roster state object and save callback.

#### Generic/shared status: Warning

The marker/icon/clipboard helpers are generic for this application. The soft-reserve input helper is reusable but has a hidden default element ID and shared assumptions about `state.singles`.

#### Raid-specific assumptions found

- **Raid markers are hardcoded to standard WoW markers.** This is generic game UI, not raid-specific. It is safe unless future content needs custom marker packs or alternate asset roots.
- **Icon URLs assume Wowhead/Zam icon names.** This is generic for WoW icon usage but is an external-provider convention embedded in shared code.
- **`bindSoftReserveInput()` defaults to `soft-reserve-url` as the input element ID.** The roster key is passed in by callers (`options.key`), but the default DOM ID still bakes in the current soft-reserve field naming convention.
- **`bindSoftReserveInput()` mutates roster state.** It writes and deletes `activeState.singles[options.key]` and then calls `options.saveState()`. This is expected for a form helper, but it should only be used by editor pages and should not be bound in public/view-only modes.
- **No raid IDs, boss IDs, assignment names, or Gruul/SSC/TK branches.** The file has no direct raid-specific routing or schema logic.

#### Storage/session/public-code risk

- Does not use localStorage directly.
- It can indirectly persist state through `options.saveState()`; caller code is responsible for ensuring save behavior respects session/public/edit mode.
- If used on a boss page or public-code view with an active input, it can mutate in-memory state and trigger save attempts.

#### Risk level: Low to Medium

Low for marker/icon helpers; Medium for `bindSoftReserveInput()` if it is reused without an explicit editor-mode guard.

#### Recommended fix, if needed

- Keep marker/icon helpers as-is for now.
- Require `options.inputId` explicitly, or rename the helper to make it clearly soft-reserve-specific.
- Add caller-side or helper-side editor-mode checks before binding mutating inputs.
- Consider moving feature-specific input binding to a feature module once soft-reserve metadata is extracted.

#### Fix timing

**Later cleanup** for explicit input IDs and feature-module separation. **Fix soon** only if this helper is about to be used on session/public pages without an edit-mode guard.

## Priority fixes

### Fix soon

1. **Remove hidden Gruul fallback from generic storage paths.** `js/roster-storage.js` should not silently default unknown pages to `gruuls-lair`; require explicit raid metadata for new pages and keep any Gruul fallback as a deliberate legacy shim only.
2. **Guard hash imports and local writes by editor context.** `importRosterFromHash()` and local save/clear flows should not be reachable from boss/view/public pages without an explicit editor capability.
3. **Make `js/soft-reserve-link.js` session-aware.** Avoid reading localStorage during automatic init when the current page is session-backed or public-code backed; wait for session roster state instead.
4. **Extract the soft-reserve source of truth.** Move `soft-reserve-url` out of shared JS constants and into raid schema/metadata or a shared feature config.
5. **Add explicit page-role metadata.** Introduce a page role such as `data-page-role` and have `js/session-client.js` prefer it over filename and DOM heuristics.

### Later cleanup

1. Replace filename-derived boss IDs in `js/session-client.js` with required `body[data-boss-id]` on boss pages, leaving filename fallback only for legacy compatibility until removed.
2. Replace `js/raid-nav.js`'s `a[href="roster.html"]` selector with a generic data attribute or metadata-provided roster route.
3. Preserve relevant query parameters in navigation through a shared URL helper rather than only appending `session`.
4. Deprecate the eager `RaidRosterStorage.STORAGE_KEY` export in favor of always calling `getStorageKey()`.
5. Remove the `GruulsRosterStorage` fallback from `js/soft-reserve-link.js` after migration is complete.
6. Make soft-reserve nav insertion use an explicit DOM anchor instead of Home-link href/text matching.
7. Consider deriving boss partial paths from `raidId` and `bossId` as an optional helper while retaining explicit `data-boss-partial` support.
8. Split `bindSoftReserveInput()` into a feature-specific module or require explicit options so generic UI helpers do not embed soft-reserve naming defaults.

### No action needed

1. `js/boss-sheet-loader.js` is generic enough for current and future boss-sheet pages that follow the established partial/container/image conventions.
2. `js/raid-nav.js` is safe for adding future raids when those raids provide `raids/<raidId>/raid.json` and page shells with the current data attributes.
3. `js/roster-ui-helpers.js` marker and icon helpers are acceptable shared WoW UI utilities; no raid-specific extraction is currently needed for them.

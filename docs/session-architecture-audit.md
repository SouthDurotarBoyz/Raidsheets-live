# Raid-Generic Session Architecture Audit

## Scope

This audit covers the current frontend session architecture and the backend contract needed for raid-generic sessions across Gruul's Lair, Serpentshrine Cavern, and Tempest Keep.

This migration step updates only Worker session backend source and tests, plus this documentation. Frontend JavaScript, roster pages, boss shell pages, storage/binding helpers, schemas, CSS, assets, templates, and raid content are not changed.

## Backend Search Result

Backend-related files are present in this repository:

- `worker/wrangler.toml` now declares the raid-generic `raidsheets-session-api` Worker; the old Worker name was the Gruul-specific `gruuls-lair-session-api`.
- `worker/src/index.js` contains Cloudflare Worker and Durable Object session code.
- `worker/test/session-api.test.js` contains session API tests.

The Worker source now supports raid-generic session creation and URL generation for Gruul's Lair, Serpentshrine Cavern, and Tempest Keep. The deployed frontend must continue using the existing `API_BASE` until the renamed `raidsheets-session-api` Worker is deployed and smoke-tested; after that validation, `js/session-client.js` should be updated in a separate PR.

## Current Frontend Session Assumptions

Before this cleanup, `js/session-client.js` made session mode decisions from three Gruul-specific filenames:

- `roster.html?session=...&key=...` meant edit mode;
- `maulgar.html?session=...` meant view mode for the Maulgar sheet;
- `gruul.html?session=...` meant view mode for the Gruul sheet.

That worked for the original Gruul-only session system, but it does not scale cleanly to SSC/TK because their pages use different roster and boss filenames.

The frontend session public API that must remain stable is:

- `getCurrentSession()`;
- `loadSessionRoster()`;
- `saveSessionRoster()`;
- `clearSessionRoster()`;
- `isEditMode()`;
- `isViewMode()`.

Local mode must continue delegating to `RaidRosterStorage` with no session URL required.

## Frontend Cleanup Completed

`js/session-client.js` now derives the current page raid ID from:

1. `window.RaidConfig.raidId`;
2. `body[data-raid-id]`;
3. `RaidRosterStorage.getCurrentRaidId()`.

Session mode detection is role-based instead of being exclusive to Gruul page names:

- pages with a roster/editor role become edit mode when both `session` and an edit token are present;
- pages with a roster/editor role and `session` but no edit token are session-backed view mode;
- pages with a boss role are view mode when `session` is present;
- boss identity comes from `body[data-boss-id]`, with a filename fallback for boss shell pages.

Compatibility is preserved for current Gruul URLs:

- `roster.html?session=...&key=...`;
- `maulgar.html?session=...`;
- `gruul.html?session=...`.

The edit-token query parameter can now be either `edit` or `key`, with `key` retained for existing Gruul links.

## Worker Backend Status

The Worker code in this repository now provides the backend half of the raid-generic session architecture. It:

1. Accepts `raidId` on session creation for:
   - `gruuls-lair`;
   - `serpentshrine-cavern`;
   - `tempest-keep`.
2. Rejects unknown raid IDs with `400`.
3. Stores `raidId` in the Durable Object session record.
4. Returns `raidId` on every session read and write response.
5. Generates raid-specific URLs:
   - Gruul edit: `roster.html?session=...&edit=...`;
   - SSC edit: `ssc-roster.html?session=...&edit=...`;
   - TK edit: `tk-roster.html?session=...&edit=...`;
   - Gruul views: `maulgar.html?session=...`, `gruul.html?session=...`;
   - SSC views: `hydross.html?session=...`, `lurker.html?session=...`, `leotheras.html?session=...`, `karathress.html?session=...`, `morogrim.html?session=...`, `vashj.html?session=...`;
   - TK views: `alar.html?session=...`, `void-reaver.html?session=...`, `solarian.html?session=...`, `kaelthas.html?session=...`.
6. Preserves `key` token compatibility for existing Gruul links while emitting `edit` for new links.
7. Keeps write authorization token-backed through `X-Edit-Token`, `Authorization: Bearer ...`, `?edit=...`, and legacy `?key=...`.
8. Includes tests for Gruul, SSC, and TK create/read/write flows and raid ID validation.

Deployment is not complete unless a separate deploy step is performed and validated.
Use the [Raid-Generic Session Activation Checklist](session-activation-checklist.md) to validate the deployed Worker before enabling SSC/TK session flows.

## Safe Migration Plan

1. Keep the current API base and existing `/api/sessions` routes in the frontend.
2. Land frontend role-based session detection without touching roster/boss shell pages.
3. Document the raid-generic backend contract.
4. Land the Worker backend source changes.
5. Deploy the renamed `raidsheets-session-api` Worker and validate:
   - existing Gruul edit URLs using `key`;
   - new Gruul edit URLs using `edit`;
   - Gruul boss view URLs;
   - SSC session creation and boss views;
   - TK session creation and boss views;
   - local mode for all raids.
6. Only after Worker validation, update frontend `API_BASE` in `js/session-client.js` through a separate PR.
7. Only after the separate `API_BASE` update is validated, wire SSC/TK roster pages into session creation and shared-session UX.

## Do-Not-Break Checklist

- Do not change frontend `API_BASE` until the renamed `raidsheets-session-api` Worker deployment is proven by smoke tests.
- Do not switch the frontend to `/api/v1` routes without matching Worker changes.
- Do not change roster pages or boss shell pages in this step.
- Do not change `RaidRosterStorage` behavior.
- Do not change schemas, raid content, CSS, assets, or templates.
- Preserve local mode, Gruul edit mode, and Gruul boss view mode.

# Raid-Generic Session Deployment and Smoke Checklist

## Purpose

This checklist describes current deployment and smoke validation for raid-generic sessions after Legacy Retirement Plan Tasks 1 through 8. See [Legacy Retirement Plan Status](legacy-retirement-plan.md) for the completed cleanup sequence.

This is a deployment and smoke checklist only. It is not a request to change runtime code, Worker code, page shells, raid metadata, or API route prefixes.

## Deployment model (current)

Repo-verified facts:

- `worker/wrangler.toml` names the Worker `raidsheets-session-api` (`main = "src/index.js"`). This is a Worker service name, not a repo-name mirror. Do not rename it to match the repository name.
- `js/session-client.js` points the frontend at `https://api.raidsheets.com`.

Operational settings (managed in the Cloudflare dashboard, not in this repo; verified against the dashboard on 2026-07-04):

- The session API Worker auto-deploys from `main` via Cloudflare Workers Builds. Build settings: root directory `worker`, deploy command `npx wrangler deploy`, production branch `main`, non-production branch builds disabled.
- `api.raidsheets.com` is bound to `raidsheets-session-api` (Production).
- The frontend deploys separately via Cloudflare Pages on every merge to `main`.
- No manual `wrangler deploy` is required for the normal main-branch deployment path.
- Post-deploy smoke checks should be run after Cloudflare Workers Builds and Cloudflare Pages finish deploying `main`.

Historical note:

- This project originally lived in `SouthDurotarBoyz/Raidsheets`. On 2026-05-10 it was shipped as a new repository, `SouthDurotarBoyz/Raidsheets-live`, and the original repository was deleted. The Worker's git connection still pointed at the deleted repository, so automatic builds silently stopped, and the Worker served the old repository's final deploy (PR #349, version `e0131a84`) for 55 days. The frontend was unaffected because the Pages project was created against `Raidsheets-live`. The Worker was reconnected to `Raidsheets-live` on 2026-07-04.

Keep the route prefix as `/api`. Do not document or test `/api/v1` for the current session contract.

## Deployed API smoke tests

Run these checks against the deployed API endpoint used by the current frontend. Current `js/session-client.js` uses:

```text
https://api.raidsheets.com
```

### Health check

- [ ] `GET /api/health` returns a healthy response from the deployed Worker.

### Create session checks

- [ ] `POST /api/sessions` with `raidId: "gruuls-lair"` succeeds.
- [ ] `POST /api/sessions` with `raidId: "serpentshrine-cavern"` succeeds.
- [ ] `POST /api/sessions` with `raidId: "tempest-keep"` succeeds.
- [ ] `POST /api/sessions` with `raidId: "mount-hyjal"` succeeds.
- [ ] `POST /api/sessions` with an invalid `raidId` returns `400`.

### Returned URL checks

For each created session, verify the response returns the correct `editUrl`, `viewUrl`, and `viewUrls`.

#### Gruul's Lair (`gruuls-lair`)

- [ ] `editUrl` points to `roster.html?session=...&edit=...`.
- [ ] `viewUrl` points to `maulgar.html?session=...`.
- [ ] `viewUrls.maulgar` points to `maulgar.html?session=...`.
- [ ] `viewUrls.gruul` points to `gruul.html?session=...`.

#### Serpentshrine Cavern (`serpentshrine-cavern`)

- [ ] `editUrl` points to `ssc-roster.html?session=...&edit=...`.
- [ ] `viewUrl` points to `hydross.html?session=...`.
- [ ] `viewUrls.hydross` points to `hydross.html?session=...`.
- [ ] `viewUrls.lurker` points to `lurker.html?session=...`.
- [ ] `viewUrls.leotheras` points to `leotheras.html?session=...`.
- [ ] `viewUrls.karathress` points to `karathress.html?session=...`.
- [ ] `viewUrls.morogrim` points to `morogrim.html?session=...`.
- [ ] `viewUrls.vashj` points to `vashj.html?session=...`.

#### Tempest Keep (`tempest-keep`)

- [ ] `editUrl` points to `tk-roster.html?session=...&edit=...`.
- [ ] `viewUrl` points to `alar.html?session=...`.
- [ ] `viewUrls.alar` points to `alar.html?session=...`.
- [ ] `viewUrls["void-reaver"]` points to `void-reaver.html?session=...`.
- [ ] `viewUrls.solarian` points to `solarian.html?session=...`.
- [ ] `viewUrls.kaelthas` points to `kaelthas.html?session=...`.

#### Mount Hyjal (`mount-hyjal`)

- [ ] `editUrl` points to `hyjal-roster.html?session=...&edit=...`.
- [ ] `viewUrl` points to `rage-winterchill.html?session=...`.
- [ ] `viewUrls.trash` points to `hyjal-trash.html?session=...`.
- [ ] `viewUrls["rage-winterchill"]` points to `rage-winterchill.html?session=...`.
- [ ] `viewUrls.anetheron` points to `anetheron.html?session=...`.
- [ ] `viewUrls.kazrogal` points to `kazrogal.html?session=...`.
- [ ] `viewUrls.azgalor` points to `azgalor.html?session=...`.
- [ ] `viewUrls.archimonde` points to `archimonde.html?session=...`.

### Token and read safety checks

- [ ] The raw edit token is present only inside `editUrl`.
- [ ] `GET /api/sessions/:sessionId` does not expose `editTokenHash`.
- [ ] `GET /api/sessions/:sessionId` does not expose the raw edit token.
- [ ] Read responses include `sessionId`, `raidId`, `roster`, and `updatedAt`.

### Write authorization checks

For at least one session, verify the current Task 8 edit-token contract.

- [ ] `PUT /api/sessions/:sessionId?key=<token>` with no other token returns `401`.
- [ ] `PUT /api/sessions/:sessionId?edit=<token>` succeeds.
- [ ] `PUT /api/sessions/:sessionId` with `X-Edit-Token: <token>` succeeds.
- [ ] `PUT /api/sessions/:sessionId` with `Authorization: Bearer <token>` succeeds.
- [ ] `PUT /api/sessions/:sessionId` with no token returns `401`.
- [ ] `PUT /api/sessions/:sessionId` with an invalid token returns `403`.
- [ ] `PUT /api/sessions/:sessionId` cannot change the session `raidId`.

Post-deploy smoke should explicitly verify that `?key=` returns `401` and `?edit=` saves.

## Shared session page checks

The current shared session shape supports Gruul's Lair, Serpentshrine Cavern, Tempest Keep, and Mount Hyjal. These checks verify that each raid remains wired to the shared contract.

### Local roster mode

- [ ] Existing local roster mode works with no `session` parameter.
- [ ] `#roster=` import still works on roster-editor pages with explicit raid identity.
- [ ] Soft Reserve still reads and writes through roster `meta` in local edit mode.

### Gruul's Lair

- [ ] Open `roster.html?session=...&edit=...` and save roster assignments.
- [ ] Open `maulgar.html?session=...` and verify saved assignments load.
- [ ] Open `gruul.html?session=...` and verify saved assignments load.

### Serpentshrine Cavern

- [ ] Open `ssc-roster.html?session=...&edit=...` and save roster assignments.
- [ ] Open `hydross.html?session=...` and verify saved assignments load.
- [ ] Open at least one more SSC boss page with `?session=...` and verify saved assignments load.

### Tempest Keep

- [ ] Open `tk-roster.html?session=...&edit=...` and save roster assignments.
- [ ] Open `alar.html?session=...` and verify saved assignments load.
- [ ] Open at least one more TK boss page with `?session=...` and verify saved assignments load.

### Mount Hyjal

- [ ] Open `hyjal-roster.html?session=...&edit=...` and save roster assignments.
- [ ] Open `rage-winterchill.html?session=...` and verify saved assignments load.
- [ ] Open `hyjal-trash.html?session=...` and verify saved assignments load.
- [ ] Open at least one more Hyjal boss page with `?session=...` and verify saved assignments load.

## Current decision gates

- Do not remove local roster mode.
- Do not change the `/api` route prefix.
- Do not claim deployment has happened unless a green Workers Builds run or post-deploy smoke checks confirm it.
- Do not treat `?key=` as an accepted edit-token source. It is retired and rejected.

## Out of scope

The following changes are intentionally out of scope for this checklist:

- Runtime JavaScript changes.
- Worker source changes.
- Worker test changes.
- Roster page changes.
- Boss shell page changes.
- Raid schema, content, CSS, asset, template, or `index.html` changes.

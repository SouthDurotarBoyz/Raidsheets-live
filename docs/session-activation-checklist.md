# Raid-Generic Session Deployment and Smoke Checklist

## Purpose

This checklist describes current manual deployment and smoke validation for raid-generic sessions after Legacy Retirement Plan Tasks 1 through 8. See [Legacy Retirement Plan Status](legacy-retirement-plan.md) for the completed cleanup sequence.

This is a deployment and smoke checklist only. It is not a request to change runtime code, Worker code, page shells, raid metadata, or API route prefixes.

## Manual deployment note

Deployment is performed manually by the repo owner with `wrangler`. This repository does not prove that a deployment has happened unless a commit, tag, release note, or other repo artifact says so.

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

The current shared session shape supports Gruul's Lair, Serpentshrine Cavern, and Tempest Keep. These checks verify that each raid remains wired to the shared contract.

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

## Current decision gates

- Do not remove local roster mode.
- Do not change the `/api` route prefix.
- Do not claim deployment has happened unless the repo itself proves it.
- Do not treat `?key=` as an accepted edit-token source. It is retired and rejected.

## Out of scope

The following changes are intentionally out of scope for this checklist:

- Runtime JavaScript changes.
- Worker source changes.
- Worker test changes.
- Roster page changes.
- Boss shell page changes.
- Raid schema, content, CSS, asset, template, or `index.html` changes.

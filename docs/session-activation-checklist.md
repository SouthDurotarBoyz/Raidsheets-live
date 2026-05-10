# Raid-Generic Session Activation Checklist

## Purpose

PR #253 updated the Worker source for raid-generic sessions, but activation is not complete until the deployed Worker proves the new backend behavior. Do not wire Serpentshrine Cavern or Tempest Keep users into session flows until the deployed API, not only local tests, passes this checklist.

This is a deployment and activation checklist only. It is not a request to change runtime code.

## Deployment Sequence

1. Deploy the Worker source from current `main`, including the raid-generic session changes and the renamed Worker configuration.
2. Use the raid-generic Worker name for the new deployment:

   ```text
   raidsheets-session-api
   ```

3. Remember that the old Worker name was Gruul-specific:

   ```text
   gruuls-lair-session-api
   ```

4. Do not change frontend `API_BASE` before the new Worker is deployed and smoke-tested. The frontend must keep using the existing API base until that validation is complete:

   ```text
   https://gruuls-lair-session-api.southdurotarboyz.workers.dev
   ```

5. Do not change `js/session-client.js` before the deployed `raidsheets-session-api` Worker passes smoke tests.
6. After deployment validation, update `js/session-client.js` `API_BASE` in a separate PR.
7. Do not change the API route prefix as part of the Worker rename.

## Deployed API Smoke Tests

Run these checks against the deployed `raidsheets-session-api` Worker endpoint, not a local test server.

### Health Check

- [ ] `GET /api/health` returns a healthy response from the deployed Worker.

### Create Session Checks

- [ ] `POST /api/sessions` with `raidId: "gruuls-lair"` succeeds.
- [ ] `POST /api/sessions` with `raidId: "serpentshrine-cavern"` succeeds.
- [ ] `POST /api/sessions` with `raidId: "tempest-keep"` succeeds.
- [ ] `POST /api/sessions` with an invalid `raidId` returns `400`.

### Returned URL Checks

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

### Token and Read Safety Checks

- [ ] The raw edit token is present only inside `editUrl`.
- [ ] `GET /api/sessions/:sessionId` does not expose `editTokenHash`.
- [ ] `GET /api/sessions/:sessionId` does not expose the raw edit token.
- [ ] Read responses include `sessionId`, `raidId`, `roster`, and `updatedAt`.

### Write Authorization Checks

For at least one session, verify all supported edit-token paths.

- [ ] `PUT /api/sessions/:sessionId` accepts `X-Edit-Token: <token>`.
- [ ] `PUT /api/sessions/:sessionId` accepts `Authorization: Bearer <token>`.
- [ ] `PUT /api/sessions/:sessionId?edit=<token>` succeeds.
- [ ] Legacy `PUT /api/sessions/:sessionId?key=<token>` still succeeds.
- [ ] Missing edit token returns `401`.
- [ ] Invalid edit token returns `403`.
- [ ] `PUT /api/sessions/:sessionId` cannot change the session `raidId`.

## Gruul Regression Checks

These checks protect the existing Gruul user flow while the backend is upgraded in place.

- [ ] Existing local roster mode still works with no `session` parameter.
- [ ] Existing Gruul session edit links using `?key=...` still save roster assignments.
- [ ] New Gruul session edit links using `?edit=...` save roster assignments.
- [ ] `maulgar.html?session=...` loads saved assignments.
- [ ] `gruul.html?session=...` loads saved assignments.
- [ ] Soft Reserve still works after the Worker deployment.

## SSC/TK Activation Checks After Worker Deploy

Only run these checks after the deployed Worker has passed the smoke tests above. These checks validate the first frontend wiring step for SSC and TK session UX.

### Serpentshrine Cavern

- [ ] Create a `serpentshrine-cavern` session through the deployed API.
- [ ] Open `ssc-roster.html?session=...&edit=...`.
- [ ] Save roster assignments from the SSC roster page.
- [ ] Open `hydross.html?session=...`.
- [ ] Verify saved assignments load on Hydross.
- [ ] Open at least one more SSC boss page with `?session=...`.
- [ ] Verify saved assignments load on the additional SSC boss page.

### Tempest Keep

- [ ] Create a `tempest-keep` session through the deployed API.
- [ ] Open `tk-roster.html?session=...&edit=...`.
- [ ] Save roster assignments from the TK roster page.
- [ ] Open `alar.html?session=...`.
- [ ] Verify saved assignments load on Al'ar.
- [ ] Open at least one more TK boss page with `?session=...`.
- [ ] Verify saved assignments load on the additional TK boss page.

## Decision Gates

- Do not wire Create Raid UI to SSC/TK until the deployed Worker passes all smoke tests.
- Do not wire SSC/TK pages into session flow until deployed API validation succeeds.
- Do not update frontend `API_BASE` until the renamed `raidsheets-session-api` Worker has been deployed and smoke-tested.
- Do not change the API route prefix to `/api/v1` yet.
- Do not remove local roster mode.
- Do not remove legacy `?key=` compatibility until all existing Gruul edit links can be safely retired.

## Out of Scope

The following changes are intentionally out of scope for this activation checklist:

- Worker source changes.
- Worker test changes.
- Frontend JavaScript changes, including the separate future `js/session-client.js` `API_BASE` update.
- Roster page changes.
- Boss shell page changes.
- Raid schema, content, CSS, asset, template, or `index.html` changes.

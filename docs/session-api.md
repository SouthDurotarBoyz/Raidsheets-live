# Raid-Generic Session API Contract

## Status

The Worker was originally deployed with the Gruul-specific name `gruuls-lair-session-api`. The Worker configuration now uses the raid-generic name `raidsheets-session-api` because the session backend supports Gruul's Lair, Serpentshrine Cavern, and Tempest Keep.

The frontend `API_BASE` still points at the legacy deployed endpoint until the renamed Worker is deployed and smoke-tested:

```text
https://gruuls-lair-session-api.southdurotarboyz.workers.dev
```

After the `raidsheets-session-api` deployment passes smoke tests, update `js/session-client.js` in a separate PR. Do **not** change `js/session-client.js` to the new Worker endpoint, `/api/v1`, or another API base in the Worker rename PR.

See [Raid-Generic Session Activation Checklist](session-activation-checklist.md) for the deployment smoke tests and decision gates required before wiring SSC/TK session UX.

## Goal

The end-state is one token-backed, raid-generic session system shared by Gruul's Lair, Serpentshrine Cavern, and Tempest Keep:

- every session has a `raidId`;
- every session keeps its UUID `sessionId` as the internal identifier and also has a short public viewer `publicCode`;
- create-session requests accept a `raidId`;
- the backend stores the `raidId` with the session record;
- frontend pages derive their current raid ID and validate loaded sessions against it;
- the backend returns raid-specific edit and view URLs;
- Gruul, SSC, and TK use the same API shape and frontend session client.

## Raid IDs

Canonical raid IDs:

| Raid | `raidId` | Roster editor | Default view page |
| --- | --- | --- | --- |
| Gruul's Lair | `gruuls-lair` | `roster.html` | `maulgar.html` |
| Serpentshrine Cavern | `serpentshrine-cavern` | `ssc-roster.html` | `hydross.html` |
| Tempest Keep | `tempest-keep` | `tk-roster.html` | `alar.html` |

The frontend derives the current page raid ID from, in order:

1. `window.RaidConfig.raidId`;
2. `body[data-raid-id]`;
3. `RaidRosterStorage.getCurrentRaidId()`.

## Compatibility Requirements

The existing deployed Worker contract must keep working until the renamed Worker is deployed, smoke-tested, and the frontend `API_BASE` is updated in a separate PR:

- Old Gruul-specific Worker/API base: `https://gruuls-lair-session-api.southdurotarboyz.workers.dev`
- New raid-generic Worker name: `raidsheets-session-api`
- Future API base after deployment validation: `https://raidsheets-session-api.southdurotarboyz.workers.dev`
- Read/write route: `/api/sessions/:sessionId`
- Create route, where used by backend/frontend integration: `/api/sessions`
- Existing Gruul edit URL compatibility: `roster.html?session=...&key=...`
- Existing Gruul boss view URLs:
  - `maulgar.html?session=...`
  - `gruul.html?session=...`
- Existing write header: `X-Edit-Token`
- Existing write body: `{ "roster": { "groups": {}, "singles": {}, "meta": {} } }`

New Worker-created edit URLs use `edit` as the edit-token query parameter, while write requests still preserve `key` compatibility for existing links. Legacy viewer links with `?session=<sessionId>` remain supported; future raider-facing links will use `/raid/<publicCode>`.

## Worker Route Contract

The Worker source implements the route shape below for the existing `/api/sessions` endpoints. Frontend activation for additional raids should still wait until deployment is updated and tested.

### Create Session

`POST /api/sessions`

Request:

```json
{
  "raidId": "serpentshrine-cavern"
}
```

Response (`201`):

```json
{
  "sessionId": "sess_xxx",
  "publicCode": "K7M2P",
  "raidId": "serpentshrine-cavern",
  "editUrl": "ssc-roster.html?session=sess_xxx&edit=edit_xxx",
  "viewUrl": "hydross.html?session=sess_xxx",
  "viewUrls": {
    "hydross": "hydross.html?session=sess_xxx",
    "lurker": "lurker.html?session=sess_xxx",
    "leotheras": "leotheras.html?session=sess_xxx",
    "karathress": "karathress.html?session=sess_xxx",
    "morogrim": "morogrim.html?session=sess_xxx",
    "vashj": "vashj.html?session=sess_xxx"
  }
}
```

Requirements:

- Request bodies are capped at 32KB; oversized bodies return `413 Payload too large`.
- `raidId` is required.
- Unknown `raidId` values return `400`.
- A 5-character `publicCode` is generated server-side from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.
- `publicCode` is for public read/view access only; it is never an edit credential.
- An edit token is generated server-side with cryptographically strong randomness and returned only inside `editUrl`.
- The backend stores only an edit-token hash, never the raw token.
- `editUrl` must point at the roster editor for the requested raid.
- `viewUrl` must point at that raid's default boss guide.
- `viewUrls` should include every boss page for that raid so the frontend can share canonical boss-specific links.
- `viewUrl` and `viewUrls` may continue to use `?session=<sessionId>` for backward compatibility until the future `/raid/<publicCode>` route is implemented.

### Get Session

`GET /api/sessions/:sessionId`

Response (`200`):

```json
{
  "sessionId": "sess_xxx",
  "publicCode": "K7M2P",
  "raidId": "serpentshrine-cavern",
  "roster": {
    "groups": {},
    "singles": {},
    "meta": {}
  },
  "updatedAt": "2026-05-08T00:00:00.000Z"
}
```

Requirements:

- No edit token is required for reads.
- The response must include `raidId` and `publicCode`.
- The roster payload must preserve the current `RaidRosterStorage` shape: `{ "groups": {}, "singles": {}, "meta": {} }`. Soft Reserve URLs are stored at `roster.meta["soft-reserve-url"]`; legacy `roster.singles["soft-reserve-url"]` is accepted and migrated during writes.
- A missing session returns `404`.

### Get Session by Public Code

`GET /api/codes/:publicCode`

Response (`200`):

```json
{
  "sessionId": "sess_xxx",
  "publicCode": "K7M2P",
  "raidId": "serpentshrine-cavern",
  "roster": {
    "groups": {},
    "singles": {},
    "meta": {}
  },
  "updatedAt": "2026-05-08T00:00:00.000Z"
}
```

Requirements:

- Public-code lookup is case-insensitive; `k7m2p` and `K7M2P` resolve the same session.
- Invalid code shapes return `400`.
- Valid-shaped unknown codes return `404`.
- This route returns the same public session data as `GET /api/sessions/:sessionId`.
- This route is read-only and does not accept or authorize writes.
- Responses must not expose `editTokenHash` or the raw edit token.

### Update Session Roster

`PUT /api/sessions/:sessionId`

Headers:

```text
Content-Type: application/json
X-Edit-Token: edit_xxx
```

Request:

```json
{
  "roster": {
    "groups": {},
    "singles": {},
    "meta": {}
  }
}
```

Response (`200`):

```json
{
  "sessionId": "sess_xxx",
  "publicCode": "K7M2P",
  "raidId": "serpentshrine-cavern",
  "roster": {
    "groups": {},
    "singles": {},
    "meta": {}
  },
  "updatedAt": "2026-05-08T00:00:00.000Z"
}
```

Requirements:

- Request bodies are capped at 32KB; oversized bodies return `413 Payload too large`.
- Missing edit token returns `401`.
- Invalid edit token returns `403`.
- View-only clients must not be able to write.
- Invalid roster shape returns `400`.
- The backend must not allow a write to change the session `raidId`.
- Write authorization accepts `X-Edit-Token`, `Authorization: Bearer ...`, `?edit=...`, and legacy `?key=...` tokens.

### Clear Session Roster

The frontend can clear by sending an empty roster through the same update route:

```json
{
  "roster": {
    "groups": {},
    "singles": {},
    "meta": {}
  }
}
```

A separate `DELETE` route is optional later, but the existing frontend API only requires `clearSessionRoster()` to preserve current Gruul behavior.

## Session Expiration

Session-backed raidsheets expire 4 hours after the raid leader's last successful edit write. The session `updatedAt` field is the last successful write time, not the last viewed time.

Read-only requests do not extend the session lifetime. This includes `GET /api/sessions/:sessionId`, `GET /api/codes/:publicCode`, and viewer polling from public/boss pages.

After expiration, direct session reads, public-code lookups, and edit writes return `410 Gone` with a stable JSON error body:

```json
{
  "error": "Session expired",
  "message": "This raid session has expired."
}
```

An expired session cannot be revived by saving with a valid edit token. The raid leader must create a new raidsheet session after expiration.

## Session Data Model

```json
{
  "sessionId": "string",
  "raidId": "gruuls-lair | serpentshrine-cavern | tempest-keep",
  "publicCode": "5-character public viewer code",
  "editTokenHash": "string",
  "roster": {
    "groups": { "<field>": ["..."] },
    "singles": { "<field>": "..." },
    "meta": { "soft-reserve-url": "https://softres.it/..." }
  },
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

## Frontend Validation Contract

For every session-backed page load:

1. The frontend derives the page `raidId`.
2. The frontend requests the session by `sessionId`.
3. The backend returns the session `raidId`.
4. If both IDs are present and do not match, the frontend must refuse to use that roster payload.

This prevents a Gruul session URL from accidentally populating SSC or TK pages once those pages become session-enabled.

## Security Rules

- Generate edit tokens using cryptographically strong randomness.
- Store only one-way token hashes server-side.
- Compare token hashes without exposing raw tokens in logs or responses after creation.
- Never require an edit token for read-only view links.
- Keep `sessionId` as the internal session identifier; do not replace it with `publicCode` for writes.
- Treat `publicCode` as a short public viewer code only, not as a bearer secret or edit authorization.
- Edit links still require the long edit token.
- Reject all writes without a valid edit token.
- Treat edit tokens as bearer secrets in URLs; avoid analytics/logging capture where possible.

## Migration Plan

1. Preserve local roster mode and the deployed Gruul session API.
2. Generalize frontend session detection so it no longer depends only on `roster.html`, `maulgar.html`, and `gruul.html` path checks.
3. Update the Worker to accept and persist all supported `raidId` values.
4. Update Worker URL generation to return raid-specific roster and boss URLs.
5. Enable session-client usage on SSC/TK roster pages only after the Worker supports those raid IDs.
6. Validate Gruul edit/view URLs and local mode after each step.
7. Deploy and smoke-test the renamed `raidsheets-session-api` Worker before changing frontend routing.
8. After smoke tests pass, update `js/session-client.js` `API_BASE` in a separate PR.
9. Only then consider changing API prefixes or additional deployment routing.

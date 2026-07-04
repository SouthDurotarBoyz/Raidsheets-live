import test from 'node:test';
import assert from 'node:assert/strict';

import worker, { SessionDurableObject } from '../src/index.js';

const PUBLIC_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/;
const SESSION_IDLE_TIMEOUT_MS = 4 * 60 * 60 * 1000;

class FakeStorage {
  constructor() {
    this.map = new Map();
  }

  async get(key) {
    return this.map.get(key);
  }

  async put(key, value) {
    this.map.set(key, value);
  }
}

function createFakeEnv() {
  const instances = new Map();

  return {
    SESSION_DO: {
      idFromName(sessionId) {
        return sessionId;
      },
      get(id) {
        if (!instances.has(id)) {
          const state = { storage: new FakeStorage() };
          instances.set(id, new SessionDurableObject(state));
        }
        const instance = instances.get(id);
        return {
          fetch(url, init) {
            return instance.fetch(new Request(url, init));
          }
        };
      }
    }
  };
}

async function readJson(response) {
  return response.json();
}

function assertCorsHeaders(response) {
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
  assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET, POST, PUT, OPTIONS');
  assert.equal(
    response.headers.get('Access-Control-Allow-Headers'),
    'Content-Type, Authorization, X-Edit-Token'
  );
  assert.equal(response.headers.get('Access-Control-Max-Age'), '86400');
}

async function createSession(env, raidId) {
  const response = await worker.fetch(
    new Request('https://example.com/api/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ raidId })
    }),
    env
  );
  assert.equal(response.status, 201);
  assertCorsHeaders(response);
  return readJson(response);
}

function tokenFromEditUrl(editUrl) {
  const url = new URL(editUrl, 'https://example.com');
  return url.searchParams.get('edit');
}

function unknownPublicCode(createdCode) {
  return createdCode === 'ZZZZZ' ? 'YYYYY' : 'ZZZZZ';
}

async function readStoredSession(env, sessionId) {
  const durableObjectId = env.SESSION_DO.idFromName(sessionId);
  const durableObject = env.SESSION_DO.get(durableObjectId);
  const response = await durableObject.fetch('https://session.internal/session');
  assert.equal(response.status, 200);
  return readJson(response);
}

async function writeStoredSession(env, session) {
  const durableObjectId = env.SESSION_DO.idFromName(session.sessionId);
  const durableObject = env.SESSION_DO.get(durableObjectId);
  const response = await durableObject.fetch('https://session.internal/session', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(session)
  });
  assert.equal(response.status, 200);
}

async function overwriteSessionFields(env, sessionId, fields) {
  const session = await readStoredSession(env, sessionId);
  const updatedSession = { ...session, ...fields };
  await writeStoredSession(env, updatedSession);
  return updatedSession;
}

function expiredUpdatedAt() {
  return new Date(Date.now() - SESSION_IDLE_TIMEOUT_MS).toISOString();
}

function activePastUpdatedAt() {
  return new Date(Date.now() - 60 * 60 * 1000).toISOString();
}

async function assertExpiredResponse(response) {
  assert.equal(response.status, 410);
  assertCorsHeaders(response);
  assert.deepEqual(await readJson(response), {
    error: 'Session expired',
    message: 'This raid session has expired.'
  });
}

async function assertInvalidRosterResponse(response) {
  assert.equal(response.status, 400);
  assertCorsHeaders(response);
  assert.deepEqual(await readJson(response), {
    error: 'Invalid request',
    message: 'roster must be an object with groups and singles objects.'
  });
}

async function putRoster(env, sessionId, editToken, roster, headers = {}) {
  return worker.fetch(
    new Request(`https://example.com/api/sessions/${sessionId}`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-edit-token': editToken,
        ...headers
      },
      body: JSON.stringify({ roster })
    }),
    env
  );
}

test('GET /api/health returns 200 with ok true', async () => {
  const env = createFakeEnv();
  const response = await worker.fetch(new Request('https://example.com/api/health'), env);

  assert.equal(response.status, 200);
  assertCorsHeaders(response);
  assert.deepEqual(await readJson(response), { ok: true });
});

test('session API validates create requests and missing sessions', async () => {
  const env = createFakeEnv();

  const optionsResponse = await worker.fetch(
    new Request('https://example.com/api/sessions', { method: 'OPTIONS' }),
    env
  );
  assert.equal(optionsResponse.status, 204);
  assertCorsHeaders(optionsResponse);

  let response = await worker.fetch(
    new Request('https://example.com/api/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({})
    }),
    env
  );
  assert.equal(response.status, 400);
  assertCorsHeaders(response);

  response = await worker.fetch(
    new Request('https://example.com/api/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ raidId: 'invalid-raid' })
    }),
    env
  );
  assert.equal(response.status, 400);

  response = await worker.fetch(new Request('https://example.com/api/sessions/missing'), env);
  assert.equal(response.status, 404);
});

test('POST /api/sessions rejects oversized request bodies before parsing JSON', async () => {
  const env = createFakeEnv();
  const response = await worker.fetch(
    new Request('https://example.com/api/sessions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': '32769'
      },
      body: '{}'
    }),
    env
  );

  assert.equal(response.status, 413);
  assertCorsHeaders(response);
  assert.deepEqual(await readJson(response), {
    error: 'Payload too large',
    message: 'Request body exceeds the maximum allowed size.'
  });
});

test('Gruul create/read/update flow supports edit URLs and rejects retired key writes', async () => {
  const env = createFakeEnv();
  const created = await createSession(env, 'gruuls-lair');

  assert.equal(typeof created.sessionId, 'string');
  assert.match(created.publicCode, PUBLIC_CODE_PATTERN);
  assert.equal(created.raidId, 'gruuls-lair');
  assert.match(created.editUrl, new RegExp(`^roster\\.html\\?session=${created.sessionId}&edit=.+$`));
  assert.equal(created.viewUrl, `maulgar.html?session=${created.sessionId}`);
  assert.deepEqual(created.viewUrls, {
    maulgar: `maulgar.html?session=${created.sessionId}`,
    gruul: `gruul.html?session=${created.sessionId}`,
    magtheridon: `magtheridon.html?session=${created.sessionId}`
  });

  const editUrl = new URL(created.editUrl, 'https://example.com');
  assert.equal(editUrl.searchParams.get('session'), created.sessionId);
  const editToken = tokenFromEditUrl(created.editUrl);
  assert.ok(editToken);
  assert.equal(editToken.length, 48);

  let response = await worker.fetch(
    new Request(`https://example.com/api/sessions/${created.sessionId}`),
    env
  );
  assert.equal(response.status, 200);
  const fetched = await readJson(response);
  assert.equal(fetched.sessionId, created.sessionId);
  assert.equal(fetched.publicCode, created.publicCode);
  assert.equal(fetched.raidId, 'gruuls-lair');
  assert.deepEqual(fetched.roster, { groups: {}, singles: {}, meta: {} });
  assert.ok(!('editTokenHash' in fetched));
  assert.ok(!('editToken' in fetched));

  response = await worker.fetch(
    new Request(`https://example.com/api/codes/${created.publicCode}`),
    env
  );
  assert.equal(response.status, 200);
  assertCorsHeaders(response);
  const fetchedByCode = await readJson(response);
  assert.deepEqual(fetchedByCode, fetched);

  response = await worker.fetch(
    new Request(`https://example.com/api/codes/${created.publicCode.toLowerCase()}`),
    env
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), fetched);

  response = await worker.fetch(new Request('https://example.com/api/codes/invalid'), env);
  assert.equal(response.status, 400);
  assertCorsHeaders(response);

  response = await worker.fetch(new Request(`https://example.com/api/codes/${unknownPublicCode(created.publicCode)}`), env);
  assert.equal(response.status, 404);
  assertCorsHeaders(response);

  response = await worker.fetch(
    new Request(`https://example.com/api/codes/${created.publicCode}?edit=${editToken}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ roster: { groups: {}, singles: {}, meta: {} } })
    }),
    env
  );
  assert.equal(response.status, 404);

  response = await worker.fetch(
    new Request(`https://example.com/api/sessions/${created.sessionId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ roster: { groups: {}, singles: {}, meta: {} } })
    }),
    env
  );
  assert.equal(response.status, 401);

  response = await worker.fetch(
    new Request(`https://example.com/api/sessions/${created.sessionId}`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer bad-token'
      },
      body: JSON.stringify({ roster: { groups: {}, singles: {}, meta: {} } })
    }),
    env
  );
  assert.equal(response.status, 403);

  response = await worker.fetch(
    new Request(`https://example.com/api/sessions/${created.sessionId}`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${editToken}`
      },
      body: '{not-json'
    }),
    env
  );
  assert.equal(response.status, 400);

  response = await worker.fetch(
    new Request(`https://example.com/api/sessions/${created.sessionId}`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${editToken}`
      },
      body: JSON.stringify({})
    }),
    env
  );
  assert.equal(response.status, 400);

  const retiredKeyRoster = {
    groups: { g1: ['Tanky'] },
    singles: { s1: 'Healz' },
    meta: { 'soft-reserve-url': 'https://softres.it/key' }
  };

  response = await worker.fetch(
    new Request(`https://example.com/api/sessions/${created.sessionId}?key=${editToken}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ raidId: 'tempest-keep', roster: retiredKeyRoster })
    }),
    env
  );
  assert.equal(response.status, 401);

  const editRoster = {
    groups: { g2: ['Edit'] },
    singles: { s2: 'Query' },
    meta: { 'soft-reserve-url': 'https://softres.it/edit' }
  };

  response = await worker.fetch(
    new Request(`https://example.com/api/sessions/${created.sessionId}?edit=${editToken}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ roster: editRoster })
    }),
    env
  );
  assert.equal(response.status, 200);
  let updated = await readJson(response);
  assert.equal(updated.publicCode, created.publicCode);
  assert.equal(updated.raidId, 'gruuls-lair');
  assert.deepEqual(updated.roster, editRoster);
  assert.ok(!('editTokenHash' in updated));

  const bearerRoster = {
    groups: { g2: ['Bear'] },
    singles: { s2: 'Token' },
    meta: { 'soft-reserve-url': 'https://softres.it/bearer' }
  };

  response = await worker.fetch(
    new Request(`https://example.com/api/sessions/${created.sessionId}`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${editToken}`
      },
      body: JSON.stringify({ roster: bearerRoster })
    }),
    env
  );
  assert.equal(response.status, 200);
  updated = await readJson(response);
  assert.equal(updated.publicCode, created.publicCode);
  assert.equal(updated.raidId, 'gruuls-lair');
  assert.deepEqual(updated.roster, bearerRoster);
  assert.ok(!('editTokenHash' in updated));

  const headerRoster = {
    groups: { g2: ['Dpsy'] },
    singles: { s2: 'Buffs' },
    meta: { 'soft-reserve-url': 'https://softres.it/header' }
  };

  response = await worker.fetch(
    new Request(`https://example.com/api/sessions/${created.sessionId}`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-edit-token': editToken
      },
      body: JSON.stringify({ roster: headerRoster })
    }),
    env
  );
  assert.equal(response.status, 200);
  updated = await readJson(response);
  assert.equal(updated.publicCode, created.publicCode);
  assert.equal(updated.raidId, 'gruuls-lair');
  assert.deepEqual(updated.roster, headerRoster);
  assert.ok(!('editTokenHash' in updated));

  response = await worker.fetch(
    new Request(`https://example.com/api/sessions/${created.sessionId}`),
    env
  );
  assert.equal(response.status, 200);
  const fetchedAfterPut = await readJson(response);
  assert.equal(fetchedAfterPut.publicCode, created.publicCode);
  assert.equal(fetchedAfterPut.raidId, 'gruuls-lair');
  assert.deepEqual(fetchedAfterPut.roster, headerRoster);
  assert.ok(!('editTokenHash' in fetchedAfterPut));

  response = await worker.fetch(
    new Request(`https://example.com/api/codes/${created.publicCode}`),
    env
  );
  assert.equal(response.status, 200);
  const codeAfterPut = await readJson(response);
  assert.deepEqual(codeAfterPut.roster, headerRoster);
});

test('SSC session creation returns raid-specific edit and boss view URLs', async () => {
  const env = createFakeEnv();
  const created = await createSession(env, 'serpentshrine-cavern');

  assert.match(created.publicCode, PUBLIC_CODE_PATTERN);
  assert.equal(created.raidId, 'serpentshrine-cavern');
  assert.match(created.editUrl, new RegExp(`^ssc-roster\\.html\\?session=${created.sessionId}&edit=.+$`));
  assert.equal(created.viewUrl, `hydross.html?session=${created.sessionId}`);
  assert.deepEqual(created.viewUrls, {
    hydross: `hydross.html?session=${created.sessionId}`,
    lurker: `lurker.html?session=${created.sessionId}`,
    leotheras: `leotheras.html?session=${created.sessionId}`,
    karathress: `karathress.html?session=${created.sessionId}`,
    morogrim: `morogrim.html?session=${created.sessionId}`,
    vashj: `vashj.html?session=${created.sessionId}`
  });

  const response = await worker.fetch(
    new Request(`https://example.com/api/sessions/${created.sessionId}`),
    env
  );
  assert.equal(response.status, 200);
  const fetched = await readJson(response);
  assert.equal(fetched.publicCode, created.publicCode);
  assert.equal(fetched.raidId, 'serpentshrine-cavern');
  assert.ok(!('editTokenHash' in fetched));
});

test('TK session creation returns raid-specific edit and boss view URLs', async () => {
  const env = createFakeEnv();
  const created = await createSession(env, 'tempest-keep');

  assert.match(created.publicCode, PUBLIC_CODE_PATTERN);
  assert.equal(created.raidId, 'tempest-keep');
  assert.match(created.editUrl, new RegExp(`^tk-roster\\.html\\?session=${created.sessionId}&edit=.+$`));
  assert.equal(created.viewUrl, `alar.html?session=${created.sessionId}`);
  assert.deepEqual(created.viewUrls, {
    alar: `alar.html?session=${created.sessionId}`,
    'void-reaver': `void-reaver.html?session=${created.sessionId}`,
    solarian: `solarian.html?session=${created.sessionId}`,
    kaelthas: `kaelthas.html?session=${created.sessionId}`
  });

  const editToken = tokenFromEditUrl(created.editUrl);
  const updatedRoster = { groups: { g1: [] }, singles: {}, meta: {} };
  const response = await worker.fetch(
    new Request(`https://example.com/api/sessions/${created.sessionId}?edit=${editToken}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ raidId: 'gruuls-lair', roster: updatedRoster })
    }),
    env
  );
  assert.equal(response.status, 200);
  const updated = await readJson(response);
  assert.equal(updated.publicCode, created.publicCode);
  assert.equal(updated.raidId, 'tempest-keep');
  assert.deepEqual(updated.roster, updatedRoster);
  assert.ok(!('editTokenHash' in updated));
});

test('PUT /api/sessions/:sessionId rejects oversized and malformed roster payloads', async () => {
  const env = createFakeEnv();
  const created = await createSession(env, 'gruuls-lair');
  const editToken = tokenFromEditUrl(created.editUrl);

  let response = await putRoster(
    env,
    created.sessionId,
    editToken,
    { groups: {}, singles: {}, meta: {} },
    { 'content-length': '32769' }
  );
  assert.equal(response.status, 413);
  assertCorsHeaders(response);
  assert.deepEqual(await readJson(response), {
    error: 'Payload too large',
    message: 'Request body exceeds the maximum allowed size.'
  });

  response = await putRoster(env, created.sessionId, editToken, {
    groups: { tanks: ['Main Tank', null], healers: ['Healer'] },
    singles: { assignment: 'DPS note' }
  });
  assert.equal(response.status, 200);
  assert.deepEqual((await readJson(response)).roster, {
    groups: { tanks: ['Main Tank', ''], healers: ['Healer'] },
    singles: { assignment: 'DPS note' },
    meta: {}
  });

  response = await putRoster(env, created.sessionId, editToken, {
    groups: Object.fromEntries(Array.from({ length: 51 }, (_, index) => [`group-${index}`, []])),
    singles: {}
  });
  await assertInvalidRosterResponse(response);

  response = await putRoster(env, created.sessionId, editToken, {
    groups: {},
    singles: Object.fromEntries(Array.from({ length: 51 }, (_, index) => [`single-${index}`, 'value']))
  });
  await assertInvalidRosterResponse(response);

  response = await putRoster(env, created.sessionId, editToken, {
    groups: { ['a'.repeat(81)]: [] },
    singles: {}
  });
  await assertInvalidRosterResponse(response);

  response = await putRoster(env, created.sessionId, editToken, {
    groups: { bad_key: [] },
    singles: {}
  });
  await assertInvalidRosterResponse(response);

  response = await putRoster(env, created.sessionId, editToken, {
    groups: {},
    singles: {},
    meta: []
  });
  await assertInvalidRosterResponse(response);

  response = await putRoster(env, created.sessionId, editToken, {
    groups: {},
    singles: {},
    meta: { bad_key: 'value' }
  });
  await assertInvalidRosterResponse(response);

  response = await putRoster(env, created.sessionId, editToken, {
    groups: { raid: Array.from({ length: 41 }, (_, index) => `player-${index}`) },
    singles: {}
  });
  await assertInvalidRosterResponse(response);

  response = await putRoster(env, created.sessionId, editToken, {
    groups: { raid: ['a'.repeat(101)] },
    singles: {}
  });
  await assertInvalidRosterResponse(response);

  response = await putRoster(env, created.sessionId, editToken, {
    groups: {},
    singles: {},
    meta: { 'soft-reserve-url': `https://example.com/${'a'.repeat(120)}` }
  });
  assert.equal(response.status, 200);
  assert.equal((await readJson(response)).roster.meta['soft-reserve-url'].length, 140);

  response = await putRoster(env, created.sessionId, editToken, {
    groups: {},
    singles: { 'soft-reserve-url': 'https://softres.it/legacy' }
  });
  assert.equal(response.status, 200);
  const migrated = await readJson(response);
  assert.deepEqual(migrated.roster, {
    groups: {},
    singles: {},
    meta: { 'soft-reserve-url': 'https://softres.it/legacy' }
  });

  response = await putRoster(env, created.sessionId, editToken, {
    groups: {},
    singles: {},
    meta: { 'soft-reserve-url': 'a'.repeat(1025) }
  });
  await assertInvalidRosterResponse(response);
});

test('session reads do not refresh updatedAt', async () => {
  const env = createFakeEnv();
  const created = await createSession(env, 'gruuls-lair');
  const fixedUpdatedAt = activePastUpdatedAt();
  await overwriteSessionFields(env, created.sessionId, { updatedAt: fixedUpdatedAt });

  let response = await worker.fetch(
    new Request(`https://example.com/api/sessions/${created.sessionId}`),
    env
  );
  assert.equal(response.status, 200);
  assert.equal((await readJson(response)).updatedAt, fixedUpdatedAt);
  assert.equal((await readStoredSession(env, created.sessionId)).updatedAt, fixedUpdatedAt);

  response = await worker.fetch(
    new Request(`https://example.com/api/codes/${created.publicCode}`),
    env
  );
  assert.equal(response.status, 200);
  assert.equal((await readJson(response)).updatedAt, fixedUpdatedAt);
  assert.equal((await readStoredSession(env, created.sessionId)).updatedAt, fixedUpdatedAt);
});

test('successful active session PUT refreshes updatedAt', async () => {
  const env = createFakeEnv();
  const created = await createSession(env, 'gruuls-lair');
  const editToken = tokenFromEditUrl(created.editUrl);
  const originalUpdatedAt = activePastUpdatedAt();
  await overwriteSessionFields(env, created.sessionId, { updatedAt: originalUpdatedAt });

  const roster = { groups: { g1: ['Fresh save'] }, singles: {}, meta: {} };
  const response = await worker.fetch(
    new Request(`https://example.com/api/sessions/${created.sessionId}`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-edit-token': editToken
      },
      body: JSON.stringify({ roster })
    }),
    env
  );

  assert.equal(response.status, 200);
  const updated = await readJson(response);
  assert.deepEqual(updated.roster, roster);
  assert.ok(Date.parse(updated.updatedAt) > Date.parse(originalUpdatedAt));
  assert.equal((await readStoredSession(env, created.sessionId)).updatedAt, updated.updatedAt);
});

test('GET /api/sessions/:sessionId returns 410 when updatedAt is at least four hours old', async () => {
  const env = createFakeEnv();
  const created = await createSession(env, 'gruuls-lair');
  await overwriteSessionFields(env, created.sessionId, { updatedAt: expiredUpdatedAt() });

  const response = await worker.fetch(
    new Request(`https://example.com/api/sessions/${created.sessionId}`),
    env
  );

  await assertExpiredResponse(response);
});

test('GET /api/sessions/:sessionId returns 410 when updatedAt is missing or invalid', async () => {
  const env = createFakeEnv();
  const missingUpdatedAt = await createSession(env, 'gruuls-lair');
  const invalidUpdatedAt = await createSession(env, 'gruuls-lair');

  const sessionWithoutUpdatedAt = await readStoredSession(env, missingUpdatedAt.sessionId);
  delete sessionWithoutUpdatedAt.updatedAt;
  await writeStoredSession(env, sessionWithoutUpdatedAt);
  await overwriteSessionFields(env, invalidUpdatedAt.sessionId, { updatedAt: 'not-a-date' });

  let response = await worker.fetch(
    new Request(`https://example.com/api/sessions/${missingUpdatedAt.sessionId}`),
    env
  );
  await assertExpiredResponse(response);

  response = await worker.fetch(
    new Request(`https://example.com/api/sessions/${invalidUpdatedAt.sessionId}`),
    env
  );
  await assertExpiredResponse(response);
});

test('GET /api/codes/:publicCode returns 410 for an expired target session', async () => {
  const env = createFakeEnv();
  const created = await createSession(env, 'gruuls-lair');
  await overwriteSessionFields(env, created.sessionId, { updatedAt: expiredUpdatedAt() });

  const response = await worker.fetch(
    new Request(`https://example.com/api/codes/${created.publicCode}`),
    env
  );

  await assertExpiredResponse(response);
});

test('PUT /api/sessions/:sessionId rejects expired sessions without changing roster data', async () => {
  const env = createFakeEnv();
  const created = await createSession(env, 'gruuls-lair');
  const editToken = tokenFromEditUrl(created.editUrl);
  const originalRoster = { groups: { g1: [{ name: 'Do not overwrite' }] }, singles: {} };
  const originalUpdatedAt = expiredUpdatedAt();
  await overwriteSessionFields(env, created.sessionId, {
    roster: originalRoster,
    updatedAt: originalUpdatedAt
  });

  const rejectedRoster = { groups: { g2: [{ name: 'Rejected' }] }, singles: { s1: { name: 'Nope' } } };
  const response = await worker.fetch(
    new Request(`https://example.com/api/sessions/${created.sessionId}`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-edit-token': editToken
      },
      body: JSON.stringify({ roster: rejectedRoster })
    }),
    env
  );

  await assertExpiredResponse(response);
  const stored = await readStoredSession(env, created.sessionId);
  assert.deepEqual(stored.roster, originalRoster);
  assert.equal(stored.updatedAt, originalUpdatedAt);
});

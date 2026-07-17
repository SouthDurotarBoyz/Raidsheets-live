export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith('/api/')) {
      return jsonResponse({ error: 'Not found' }, 404);
    }

    if (request.method === 'OPTIONS') {
      return corsResponse(204);
    }

    if (request.method === 'GET' && url.pathname === '/api/health') {
      return jsonResponse({ ok: true }, 200);
    }

    if (request.method === 'POST' && url.pathname === '/api/sessions') {
      if (hasOversizedRequestBody(request)) {
        return payloadTooLargeResponse();
      }

      let payload;
      try {
        payload = await request.json();
      } catch {
        return jsonResponse(
          {
            error: 'Invalid request',
            message: 'Request body must be valid JSON.'
          },
          400
        );
      }

      const raidId = payload?.raidId;
      if (!raidId) {
        return jsonResponse(
          {
            error: 'Invalid request',
            message: 'raidId is required.'
          },
          400
        );
      }

      const raidConfig = RAID_CONFIGS[raidId];
      if (!raidConfig) {
        return jsonResponse(
          {
            error: 'Invalid request',
            message: 'Invalid raidId.'
          },
          400
        );
      }

      const sessionId = crypto.randomUUID();
      const publicCode = await claimPublicCode(env, sessionId);
      if (!publicCode) {
        return jsonResponse(
          {
            error: 'Internal server error',
            message: 'Unable to allocate public session code.'
          },
          500
        );
      }

      const editToken = generateEditToken();
      const editTokenHash = await hashEditToken(editToken);
      const now = new Date().toISOString();

      const sessionRecord = {
        sessionId,
        raidId,
        publicCode,
        editTokenHash,
        roster: { groups: {}, singles: {}, meta: {} },
        createdAt: now,
        updatedAt: now
      };

      const durableObjectId = env.SESSION_DO.idFromName(sessionId);
      const durableObject = env.SESSION_DO.get(durableObjectId);
      await durableObject.fetch('https://session.internal/session', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(sessionRecord)
      });

      return jsonResponse(
        {
          sessionId,
          publicCode,
          raidId,
          editUrl: buildEditUrl(raidConfig, sessionId, editToken),
          viewUrl: buildViewUrl(raidConfig.defaultViewPage, sessionId),
          viewUrls: buildViewUrls(raidConfig, sessionId)
        },
        201
      );
    }

    const codeMatch = url.pathname.match(/^\/api\/codes\/([^\/]+)\/?$/);
    if (codeMatch) {
      const publicCode = normalizePublicCode(codeMatch[1]);

      if (request.method === 'GET') {
        if (!publicCode) {
          return jsonResponse(
            {
              error: 'Invalid request',
              message: 'publicCode must be a 5-character code using unambiguous uppercase letters and digits.'
            },
            400
          );
        }

        const codeDurableObjectId = env.SESSION_DO.idFromName(`code:${publicCode}`);
        const codeDurableObject = env.SESSION_DO.get(codeDurableObjectId);
        const codeResponse = await codeDurableObject.fetch('https://session.internal/code');

        if (codeResponse.status === 404) {
          return jsonResponse(
            {
              error: 'Not found',
              message: 'Public session code not found.'
            },
            404
          );
        }

        if (!codeResponse.ok) {
          return jsonResponse({ error: 'Internal server error' }, 500);
        }

        const codeMapping = await codeResponse.json();
        const response = await fetchSession(env, codeMapping.sessionId);

        if (response.status === 404) {
          return jsonResponse(
            {
              error: 'Not found',
              message: 'Session not found.'
            },
            404
          );
        }

        if (!response.ok) {
          return jsonResponse({ error: 'Internal server error' }, 500);
        }

        const session = await response.json();
        if (isSessionExpired(session)) {
          return expiredSessionResponse();
        }

        return jsonResponse(publicSessionResponse(session), 200);
      }
    }

    const sessionMatch = url.pathname.match(/^\/api\/sessions\/([^\/]+)\/?$/);
    if (sessionMatch) {
      const sessionId = sessionMatch[1];

      if (request.method === 'GET') {
        const response = await fetchSession(env, sessionId);

        if (response.status === 404) {
          return jsonResponse(
            {
              error: 'Not found',
              message: 'Session not found.'
            },
            404
          );
        }

        if (!response.ok) {
          return jsonResponse({ error: 'Internal server error' }, 500);
        }

        const session = await response.json();
        if (isSessionExpired(session)) {
          return expiredSessionResponse();
        }

        return jsonResponse(publicSessionResponse(session), 200);
      }

      if (request.method === 'PUT') {
        const editToken = getEditTokenFromRequest(request, url);
        if (!editToken) {
          return jsonResponse(
            {
              error: 'Unauthorized',
              message: 'Edit token is required.'
            },
            401
          );
        }

        const durableObjectId = env.SESSION_DO.idFromName(sessionId);
        const durableObject = env.SESSION_DO.get(durableObjectId);
        const getResponse = await durableObject.fetch('https://session.internal/session');

        if (getResponse.status === 404) {
          return jsonResponse(
            {
              error: 'Not found',
              message: 'Session not found.'
            },
            404
          );
        }

        if (!getResponse.ok) {
          return jsonResponse({ error: 'Internal server error' }, 500);
        }

        const session = await getResponse.json();
        if (isSessionExpired(session)) {
          return expiredSessionResponse();
        }

        const editTokenHash = await hashEditToken(editToken);
        if (session.editTokenHash !== editTokenHash) {
          return jsonResponse(
            {
              error: 'Forbidden',
              message: 'Invalid edit token.'
            },
            403
          );
        }

        if (hasOversizedRequestBody(request)) {
          return payloadTooLargeResponse();
        }

        let payload;
        try {
          payload = await request.json();
        } catch {
          return jsonResponse(
            {
              error: 'Invalid request',
              message: 'Request body must be valid JSON.'
            },
            400
          );
        }

        const roster = normalizeRosterPayload(payload);
        if (!roster) {
          return jsonResponse(
            {
              error: 'Invalid request',
              message: 'roster must be an object with groups and singles objects.'
            },
            400
          );
        }

        const updatedSession = {
          sessionId: session.sessionId,
          raidId: session.raidId,
          publicCode: session.publicCode,
          editTokenHash: session.editTokenHash,
          roster,
          createdAt: session.createdAt,
          updatedAt: new Date().toISOString()
        };

        await durableObject.fetch('https://session.internal/session', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(updatedSession)
        });

        return jsonResponse(publicSessionResponse(updatedSession), 200);
      }
    }

    return jsonResponse({ error: 'Not found' }, 404);
  }
};

export class SessionDurableObject {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/code') {
      if (request.method === 'POST') {
        const codeMapping = await request.json();
        const existing = await this.state.storage.get('code');
        if (existing) {
          return jsonResponse({ error: 'Conflict' }, 409);
        }

        await this.state.storage.put('code', codeMapping);
        return jsonResponse({ ok: true }, 201);
      }

      if (request.method === 'GET') {
        const codeMapping = await this.state.storage.get('code');
        if (!codeMapping) {
          return jsonResponse({ error: 'Not found' }, 404);
        }
        return jsonResponse(codeMapping, 200);
      }

      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    if (url.pathname !== '/session') {
      return jsonResponse({ error: 'Not found' }, 404);
    }

    if (request.method === 'PUT') {
      const session = await request.json();
      await this.state.storage.put('session', session);
      return jsonResponse({ ok: true }, 200);
    }

    if (request.method === 'GET') {
      const session = await this.state.storage.get('session');
      if (!session) {
        return jsonResponse({ error: 'Not found' }, 404);
      }
      return jsonResponse(session, 200);
    }

    return jsonResponse({ error: 'Method not allowed' }, 405);
  }
}

const SESSION_IDLE_TIMEOUT_MS = 4 * 60 * 60 * 1000;
const PUBLIC_CODE_LENGTH = 5;
const PUBLIC_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PUBLIC_CODE_PATTERN = new RegExp(`^[${PUBLIC_CODE_ALPHABET}]{${PUBLIC_CODE_LENGTH}}$`);
const PUBLIC_CODE_MAX_ATTEMPTS = 10;
const MAX_REQUEST_BODY_BYTES = 32768;
const MAX_ROSTER_GROUP_KEYS = 50;
const MAX_ROSTER_SINGLE_KEYS = 50;
const MAX_ROSTER_META_KEYS = 50;
const SOFT_RESERVE_KEY = 'soft-reserve-url';
const MAX_ROSTER_KEY_LENGTH = 80;
const MAX_ROSTER_GROUP_ITEMS = 40;
const MAX_ROSTER_VALUE_LENGTH = 100;
const MAX_SOFT_RESERVE_URL_LENGTH = 1024;
const INVALID_ROSTER_VALUE = Symbol('invalid roster value');

const RAID_CONFIGS = {
  'gruuls-lair': {
    rosterPage: 'roster.html',
    defaultViewPage: 'maulgar.html',
    bossViewPages: {
      maulgar: 'maulgar.html',
      gruul: 'gruul.html',
      magtheridon: 'magtheridon.html'
    }
  },
  'serpentshrine-cavern': {
    rosterPage: 'ssc-roster.html',
    defaultViewPage: 'hydross.html',
    bossViewPages: {
      hydross: 'hydross.html',
      lurker: 'lurker.html',
      leotheras: 'leotheras.html',
      karathress: 'karathress.html',
      morogrim: 'morogrim.html',
      vashj: 'vashj.html'
    }
  },
  'tempest-keep': {
    rosterPage: 'tk-roster.html',
    defaultViewPage: 'alar.html',
    bossViewPages: {
      alar: 'alar.html',
      'void-reaver': 'void-reaver.html',
      solarian: 'solarian.html',
      kaelthas: 'kaelthas.html'
    }
  },
  'mount-hyjal': {
    rosterPage: 'hyjal-roster.html',
    defaultViewPage: 'rage-winterchill.html',
    bossViewPages: {
      trash: 'hyjal-trash.html',
      'rage-winterchill': 'rage-winterchill.html',
      anetheron: 'anetheron.html',
      kazrogal: 'kazrogal.html',
      azgalor: 'azgalor.html',
      archimonde: 'archimonde.html'
    }
  }
};

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status: status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...corsHeaders()
    }
  });
}

function corsResponse(status) {
  return new Response(null, {
    status,
    headers: corsHeaders()
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Edit-Token',
    'Access-Control-Max-Age': '86400'
  };
}

function isSessionExpired(session, now = Date.now()) {
  const updatedAtMs = Date.parse(session?.updatedAt);
  return !Number.isFinite(updatedAtMs) || now - updatedAtMs >= SESSION_IDLE_TIMEOUT_MS;
}

function expiredSessionResponse() {
  return jsonResponse(
    {
      error: 'Session expired',
      message: 'This raid session has expired.'
    },
    410
  );
}

function hasOversizedRequestBody(request) {
  const contentLength = request.headers.get('content-length');
  if (contentLength === null) {
    return false;
  }

  const parsedLength = Number.parseInt(contentLength, 10);
  if (!Number.isFinite(parsedLength) || parsedLength < 0 || String(parsedLength) !== contentLength.trim()) {
    return false;
  }

  return parsedLength > MAX_REQUEST_BODY_BYTES;
}

function payloadTooLargeResponse() {
  return jsonResponse(
    {
      error: 'Payload too large',
      message: 'Request body exceeds the maximum allowed size.'
    },
    413
  );
}

async function fetchSession(env, sessionId) {
  const durableObjectId = env.SESSION_DO.idFromName(sessionId);
  const durableObject = env.SESSION_DO.get(durableObjectId);
  return durableObject.fetch('https://session.internal/session');
}

function getEditTokenFromRequest(request, url) {
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      return token;
    }
  }

  const headerToken = request.headers.get('x-edit-token');
  if (headerToken && headerToken.trim()) {
    return headerToken.trim();
  }

  const editQueryToken = url.searchParams.get('edit');
  if (editQueryToken && editQueryToken.trim()) {
    return editQueryToken.trim();
  }
  return '';
}

function normalizeRosterPayload(payload) {
  if (!isPlainObject(payload)) {
    return null;
  }

  if (!('roster' in payload)) {
    return null;
  }

  const { roster } = payload;
  if (!isPlainObject(roster) || !isPlainObject(roster.groups) || !isPlainObject(roster.singles) || ('meta' in roster && !isPlainObject(roster.meta))) {
    return null;
  }

  const sourceMeta = { ...(roster.meta || {}) };
  const sourceSingles = { ...roster.singles };
  if (Object.prototype.hasOwnProperty.call(sourceSingles, SOFT_RESERVE_KEY)) {
    if (!Object.prototype.hasOwnProperty.call(sourceMeta, SOFT_RESERVE_KEY)) {
      sourceMeta[SOFT_RESERVE_KEY] = sourceSingles[SOFT_RESERVE_KEY];
    }
    delete sourceSingles[SOFT_RESERVE_KEY];
  }

  const groupEntries = Object.entries(roster.groups);
  if (groupEntries.length > MAX_ROSTER_GROUP_KEYS) {
    return null;
  }

  const singleEntries = Object.entries(sourceSingles);
  if (singleEntries.length > MAX_ROSTER_SINGLE_KEYS) {
    return null;
  }

  const metaEntries = Object.entries(sourceMeta);
  if (metaEntries.length > MAX_ROSTER_META_KEYS) {
    return null;
  }

  const groups = {};
  for (const [key, value] of groupEntries) {
    if (!isValidRosterKey(key) || !Array.isArray(value) || value.length > MAX_ROSTER_GROUP_ITEMS) {
      return null;
    }

    const normalizedValues = [];
    for (const item of value) {
      const normalizedValue = normalizeRosterValue(item, key);
      if (normalizedValue === INVALID_ROSTER_VALUE) {
        return null;
      }
      normalizedValues.push(normalizedValue);
    }
    groups[key] = normalizedValues;
  }

  const singles = {};
  for (const [key, value] of singleEntries) {
    if (!isValidRosterKey(key)) {
      return null;
    }

    const normalizedValue = normalizeRosterValue(value, key);
    if (normalizedValue === INVALID_ROSTER_VALUE) {
      return null;
    }
    singles[key] = normalizedValue;
  }

  const meta = {};
  for (const [key, value] of metaEntries) {
    if (!isValidRosterKey(key)) {
      return null;
    }

    const normalizedValue = normalizeRosterValue(value, key);
    if (normalizedValue === INVALID_ROSTER_VALUE) {
      return null;
    }
    meta[key] = normalizedValue;
  }

  return { groups, singles, meta };
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isValidRosterKey(key) {
  return (
    typeof key === 'string' &&
    key.length > 0 &&
    key.length <= MAX_ROSTER_KEY_LENGTH &&
    /^[a-z0-9-]+$/.test(key)
  );
}

function normalizeRosterValue(value, key) {
  let normalizedValue;
  try {
    normalizedValue = value == null ? '' : String(value);
  } catch {
    return INVALID_ROSTER_VALUE;
  }

  const maxLength = key === 'soft-reserve-url' ? MAX_SOFT_RESERVE_URL_LENGTH : MAX_ROSTER_VALUE_LENGTH;
  return normalizedValue.length <= maxLength ? normalizedValue : INVALID_ROSTER_VALUE;
}

async function claimPublicCode(env, sessionId) {
  for (let attempt = 0; attempt < PUBLIC_CODE_MAX_ATTEMPTS; attempt += 1) {
    const publicCode = generatePublicCode();
    const durableObjectId = env.SESSION_DO.idFromName(`code:${publicCode}`);
    const durableObject = env.SESSION_DO.get(durableObjectId);
    const response = await durableObject.fetch('https://session.internal/code', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ publicCode, sessionId })
    });

    if (response.status === 201) {
      return publicCode;
    }

    if (response.status !== 409) {
      return '';
    }
  }

  return '';
}

function generatePublicCode() {
  const values = new Uint8Array(PUBLIC_CODE_LENGTH);
  crypto.getRandomValues(values);

  return Array.from(values, (value) => PUBLIC_CODE_ALPHABET[value % PUBLIC_CODE_ALPHABET.length]).join('');
}

function normalizePublicCode(publicCode) {
  let normalized;
  try {
    normalized = decodeURIComponent(publicCode).toUpperCase();
  } catch {
    return '';
  }

  return PUBLIC_CODE_PATTERN.test(normalized) ? normalized : '';
}

function buildEditUrl(raidConfig, sessionId, editToken) {
  return `${raidConfig.rosterPage}?session=${encodeURIComponent(sessionId)}&edit=${encodeURIComponent(editToken)}`;
}

function buildViewUrl(page, sessionId) {
  return `${page}?session=${encodeURIComponent(sessionId)}`;
}

function buildViewUrls(raidConfig, sessionId) {
  return Object.fromEntries(
    Object.entries(raidConfig.bossViewPages).map(([bossId, page]) => [bossId, buildViewUrl(page, sessionId)])
  );
}

function publicSessionResponse(session) {
  return {
    sessionId: session.sessionId,
    publicCode: session.publicCode,
    raidId: session.raidId,
    roster: session.roster,
    updatedAt: session.updatedAt
  };
}

function generateEditToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);

  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

async function hashEditToken(editToken) {
  const encoded = new TextEncoder().encode(editToken);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}

(function(global){
  'use strict';

  var storage = global.RaidRosterStorage;
  var API_BASE = 'https://api.raidsheets.com';
  var SOFT_RESERVE_KEY = 'soft-reserve-url';
  var SESSION_SAVE_DEBOUNCE_MS = 4000;
  var PUBLIC_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/;
  var PAGE_ROLES = {
    ROSTER_EDITOR: 'roster-editor',
    BOSS_VIEW: 'boss-view',
    RAID_RESOLVER: 'raid-resolver'
  };
  var readingStorageRaidId = false;
  var sessionSaveDebounceTimer = null;
  var pendingSessionSave = null;
  var pendingSessionSaveWaiters = [];
  var warnedUnknownPageRoles = {};

  function ensureStorage(){
    if (!storage) throw new Error('RaidRosterStorage is required');
    return storage;
  }

  function getPathname(){
    return (global.location && global.location.pathname) || '/';
  }

  function getSearchParams(){
    var search = (global.location && global.location.search) || '';
    return new global.URLSearchParams(search);
  }

  function getBodyAttribute(name){
    return global.document && global.document.body ? global.document.body.getAttribute(name) : '';
  }

  function normalizePageRole(value){
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
  }

  function isKnownPageRole(role){
    return role === PAGE_ROLES.ROSTER_EDITOR || role === PAGE_ROLES.BOSS_VIEW || role === PAGE_ROLES.RAID_RESOLVER;
  }

  function getRawPageRole(){
    return getBodyAttribute('data-page-role');
  }

  function getPageRole(){
    var pageRole = normalizePageRole(getRawPageRole());
    if (!pageRole) return '';
    if (isKnownPageRole(pageRole)) return pageRole;

    if (!warnedUnknownPageRoles[pageRole]) {
      warnedUnknownPageRoles[pageRole] = true;
      console.warn('[RaidSessionClient] Unknown data-page-role: ' + pageRole);
    }

    return '';
  }

  function getConfiguredRaidId(){
    return (global.RaidConfig && global.RaidConfig.raidId) || getBodyAttribute('data-raid-id') || '';
  }

  function getStorageRaidId(){
    if (!storage || !storage.getCurrentRaidId || readingStorageRaidId) return '';

    readingStorageRaidId = true;
    try {
      return storage.getCurrentRaidId() || '';
    } catch (err) {
      console.warn('[RaidSessionClient] Unable to derive raid ID from storage.', err && err.message ? err.message : err);
      return '';
    } finally {
      readingStorageRaidId = false;
    }
  }

  function getCurrentRaidId(){
    return getConfiguredRaidId() || getStorageRaidId() || null;
  }

  function getBossIdFromPath(){
    var fileMatch = getPathname().match(/([^\/]+)\.html$/);
    if (!fileMatch) return null;

    var fileName = fileMatch[1];
    if (fileName === 'roster' || /-roster$/.test(fileName)) return null;
    return fileName;
  }

  function getCurrentBossId(){
    return getBodyAttribute('data-boss-id') || getBossIdFromPath();
  }

  function hasRosterEditorRole(){
    var pageRole = getPageRole();
    if (pageRole === PAGE_ROLES.ROSTER_EDITOR) return true;
    if (pageRole === PAGE_ROLES.BOSS_VIEW || pageRole === PAGE_ROLES.RAID_RESOLVER) return false;

    var path = getPathname();
    if (/\b(?:roster|[^\/]+-roster)\.html$/.test(path)) return true;
    return !!(global.document && global.document.querySelector && global.document.querySelector('.roster-form, [data-roster-editor]'));
  }

  function hasBossViewRole(){
    var pageRole = getPageRole();
    if (pageRole === PAGE_ROLES.BOSS_VIEW) return true;
    if (pageRole === PAGE_ROLES.ROSTER_EDITOR || pageRole === PAGE_ROLES.RAID_RESOLVER) return false;

    return !!getCurrentBossId();
  }


  function debugPageRole(){
    var pageRole = getPageRole();
    var rawPageRole = getRawPageRole();

    return {
      pageRole: pageRole,
      rawPageRole: rawPageRole,
      isKnownPageRole: isKnownPageRole(pageRole),
      hasRosterEditorRole: hasRosterEditorRole(),
      hasBossViewRole: hasBossViewRole(),
      pathname: getPathname(),
      raidId: getCurrentRaidId(),
      bossId: getCurrentBossId()
    };
  }

  function emptySession(raidId){
    return {
      mode: 'local',
      sessionId: null,
      editToken: null,
      publicCode: null,
      raidId: raidId || getConfiguredRaidId() || null,
      bossId: null,
      pageRole: getPageRole(),
      isSessionBacked: false
    };
  }

  function isValidPublicCode(code){
    return typeof code === 'string' && PUBLIC_CODE_PATTERN.test(code);
  }

  function getPublicCode(){
    var rawCode = getSearchParams().get('code');
    var code = rawCode ? String(rawCode).toUpperCase() : '';
    return isValidPublicCode(code) ? code : '';
  }

  function getCurrentSession(){
    if (readingStorageRaidId) return emptySession(getConfiguredRaidId());

    var params = getSearchParams();
    var sessionId = params.get('session');
    var editToken = params.get('edit') || params.get('key');
    var publicCode = getPublicCode();
    var raidId = getCurrentRaidId();
    var bossId = getCurrentBossId();
    var pageRole = getPageRole();

    if (sessionId) {
      if (hasBossViewRole()) {
        return {
          mode: 'view',
          sessionId: sessionId,
          editToken: null,
          publicCode: publicCode || null,
          raidId: raidId,
          bossId: bossId,
          pageRole: pageRole,
          isSessionBacked: true
        };
      }

      if (hasRosterEditorRole()) {
        return {
          mode: editToken ? 'edit' : 'view',
          sessionId: sessionId,
          editToken: editToken,
          publicCode: publicCode || null,
          raidId: raidId,
          bossId: null,
          pageRole: pageRole,
          isSessionBacked: true
        };
      }

      return {
        mode: editToken ? 'edit' : 'view',
        sessionId: sessionId,
        editToken: editToken,
        publicCode: publicCode || null,
        raidId: raidId,
        bossId: bossId,
        pageRole: pageRole,
        isSessionBacked: true
      };
    }

    if (publicCode) {
      return {
        mode: 'view',
        sessionId: null,
        editToken: null,
        publicCode: publicCode,
        raidId: raidId,
        bossId: bossId,
        pageRole: pageRole,
        isSessionBacked: true
      };
    }

    return emptySession(raidId);
  }

  function emptyRoster(){
    return { groups: {}, singles: {}, meta: {} };
  }

  function isPlainRosterObject(value){
    return !!(value && typeof value === 'object' && !Array.isArray(value));
  }

  function safeRoster(roster){
    if (!isPlainRosterObject(roster)) return emptyRoster();
    var normalized = {
      groups: isPlainRosterObject(roster.groups) ? roster.groups : {},
      singles: isPlainRosterObject(roster.singles) ? roster.singles : {},
      meta: isPlainRosterObject(roster.meta) ? roster.meta : {}
    };
    if (Object.prototype.hasOwnProperty.call(normalized.singles, SOFT_RESERVE_KEY)) {
      if (!Object.prototype.hasOwnProperty.call(normalized.meta, SOFT_RESERVE_KEY)) {
        normalized.meta[SOFT_RESERVE_KEY] = normalized.singles[SOFT_RESERVE_KEY];
      }
      delete normalized.singles[SOFT_RESERVE_KEY];
    }
    return normalized;
  }


  function createSessionHttpError(response, payload){
    var error = new Error(response && response.status === 410 ? 'Raid session has expired' : 'Session request failed');
    error.name = response && response.status === 410 ? 'RaidSessionExpiredError' : 'RaidSessionHttpError';
    error.status = response ? response.status : 0;
    error.code = response && response.status === 410 ? 'SESSION_EXPIRED' : 'SESSION_HTTP_ERROR';
    error.payload = payload || null;
    return error;
  }

  function isSessionExpiredError(error){
    return !!(error && (error.status === 410 || error.code === 'SESSION_EXPIRED'));
  }

  function parseErrorJson(response){
    if (!response || !response.json) return Promise.resolve(null);
    return response.json().catch(function(){ return null; });
  }

  function getSessionExpiredMessage(){
    if (hasRosterEditorRole()) {
      return 'This raidsheet session has expired. Create a new raidsheet to continue sharing.';
    }
    return 'This raidsheet session has expired. Ask the raid leader to create a new link.';
  }

  function applyNoticeStyles(notice){
    notice.style.background = '#fff3cd';
    notice.style.border = '1px solid #ffec99';
    notice.style.borderRadius = '8px';
    notice.style.color = '#5c3c00';
    notice.style.fontWeight = '700';
    notice.style.margin = '12px auto';
    notice.style.maxWidth = '1100px';
    notice.style.padding = '12px 16px';
    notice.style.textAlign = 'center';
  }

  function showSessionExpiredNotice(messageOverride){
    if (!global.document || !global.document.body) return null;

    var notice = global.document.querySelector('[data-session-expired-notice="true"]');
    if (!notice) {
      notice = global.document.createElement('div');
      notice.setAttribute('data-session-expired-notice', 'true');
      notice.setAttribute('role', 'alert');
      applyNoticeStyles(notice);
    }

    notice.textContent = messageOverride || getSessionExpiredMessage();

    if (!notice.parentNode) {
      var rosterActions = global.document.querySelector('.roster-top-actions');
      var pageNav = global.document.querySelector('.page-nav');
      var anchor = hasRosterEditorRole() ? rosterActions : pageNav;
      if (!anchor) anchor = rosterActions || pageNav;

      if (anchor && anchor.parentNode) {
        anchor.parentNode.insertBefore(notice, anchor.nextSibling);
      } else {
        global.document.body.insertBefore(notice, global.document.body.firstChild);
      }
    }

    return notice;
  }

  function handleSessionExpired(error){
    if (!isSessionExpiredError(error)) return false;
    showSessionExpiredNotice();
    return true;
  }


  function snapshotRoster(roster){
    var safe = safeRoster(roster);
    var groups = {};
    var singles = {};
    var meta = {};

    Object.keys(safe.groups || {}).forEach(function(key){
      groups[key] = Array.isArray(safe.groups[key]) ? safe.groups[key].slice() : safe.groups[key];
    });
    Object.keys(safe.singles || {}).forEach(function(key){
      singles[key] = safe.singles[key] || '';
    });
    Object.keys(safe.meta || {}).forEach(function(key){
      meta[key] = safe.meta[key] || '';
    });

    return { groups: groups, singles: singles, meta: meta };
  }

  function getPayloadRoster(payload){
    return (payload && (payload.roster || payload.payload)) || null;
  }

  function isSessionRaidMatch(session, payload){
    if (!session.raidId || !payload || !payload.raidId) return true;
    return session.raidId === payload.raidId;
  }

  function loadSessionPayload(session){
    var endpoint = session.publicCode && !session.sessionId
      ? '/api/codes/' + encodeURIComponent(session.publicCode)
      : '/api/sessions/' + encodeURIComponent(session.sessionId);

    return global.fetch(API_BASE + endpoint, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    }).then(function(res){
      if (res.ok) return res.json();
      return parseErrorJson(res).then(function(payload){
        if (res.status === 410) throw createSessionHttpError(res, payload);
        throw new Error('Failed to load session roster');
      });
    });
  }

  function createSession(raidId){
    return global.fetch(API_BASE + '/api/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ raidId: raidId })
    }).then(function(res){
      if (!res.ok) throw new Error('Failed to create session');
      return res.json();
    });
  }

  function getEditTokenFromUrl(editUrl){
    if (typeof editUrl !== 'string' || !editUrl) return '';

    try {
      var parsed = new global.URL(editUrl, global.location && global.location.href ? global.location.href : API_BASE);
      return parsed.searchParams.get('edit') || parsed.searchParams.get('key') || '';
    } catch (err) {
      return '';
    }
  }

  function appendPublicCodeToEditUrl(editUrl, publicCode){
    if (!isValidPublicCode(publicCode)) return editUrl;

    try {
      var parsed = new global.URL(editUrl, global.location && global.location.href ? global.location.href : API_BASE);
      parsed.searchParams.set('code', publicCode);
      return parsed.toString();
    } catch (err) {
      return editUrl;
    }
  }

  function saveRosterToSession(sessionId, editToken, roster){
    return global.fetch(API_BASE + '/api/sessions/' + encodeURIComponent(sessionId), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Edit-Token': editToken
      },
      body: JSON.stringify({ roster: safeRoster(roster) })
    }).then(function(res){
      if (res.ok) return true;
      return parseErrorJson(res).then(function(payload){
        if (res.status === 410) throw createSessionHttpError(res, payload);
        throw new Error('Failed to save session roster');
      });
    });
  }


  function resolvePendingSessionSaveWaiters(waiters, value){
    waiters.forEach(function(resolve){
      try {
        resolve(value);
      } catch (err) {
        console.error('[RaidSessionClient] Unable to resolve debounced session save.', err && err.message ? err.message : err);
      }
    });
  }

  function cancelDebouncedSessionSave(value){
    if (sessionSaveDebounceTimer) {
      global.clearTimeout(sessionSaveDebounceTimer);
      sessionSaveDebounceTimer = null;
    }
    pendingSessionSave = null;
    if (pendingSessionSaveWaiters.length) {
      resolvePendingSessionSaveWaiters(pendingSessionSaveWaiters.splice(0), value);
    }
  }

  function flushDebouncedSessionSave(){
    var save = pendingSessionSave;
    var waiters = pendingSessionSaveWaiters.splice(0);
    pendingSessionSave = null;
    sessionSaveDebounceTimer = null;

    if (!save) {
      resolvePendingSessionSaveWaiters(waiters, false);
      return Promise.resolve(false);
    }

    return saveRosterToSession(save.sessionId, save.editToken, save.roster).catch(function(err){
      if (handleSessionExpired(err)) return false;
      console.error('[RaidSessionClient] Unable to save session roster.', err && err.message ? err.message : err);
      return false;
    }).then(function(result){
      resolvePendingSessionSaveWaiters(waiters, result);
      return result;
    });
  }

  function debouncedSaveSessionRoster(session, roster){
    if (!session || session.mode !== 'edit' || !session.sessionId || !session.editToken) {
      return Promise.resolve(false);
    }

    pendingSessionSave = {
      sessionId: session.sessionId,
      editToken: session.editToken,
      roster: snapshotRoster(roster)
    };

    if (sessionSaveDebounceTimer) {
      global.clearTimeout(sessionSaveDebounceTimer);
    }

    return new Promise(function(resolve){
      pendingSessionSaveWaiters.push(resolve);
      sessionSaveDebounceTimer = global.setTimeout(flushDebouncedSessionSave, SESSION_SAVE_DEBOUNCE_MS);
    });
  }

  function createSessionFromRoster(raidId, roster){
    return createSession(raidId).then(function(data){
      var sessionId = data && data.sessionId;
      var editToken = getEditTokenFromUrl(data && data.editUrl);

      if (!sessionId || !editToken) {
        throw new Error('Missing session data');
      }

      return saveRosterToSession(sessionId, editToken, roster).then(function(){
        if (data.publicCode && data.editUrl) {
          data.editUrl = appendPublicCodeToEditUrl(data.editUrl, String(data.publicCode).toUpperCase());
        }
        return data;
      });
    });
  }

  function loadSessionRoster(){
    var session = getCurrentSession();
    if (!session.isSessionBacked) {
      return ensureStorage().loadRoster();
    }

    return loadSessionPayload(session).then(function(payload){
      if (!isSessionRaidMatch(session, payload)) {
        console.error('[RaidSessionClient] Session raid does not match current page raid.');
        return emptyRoster();
      }

      return safeRoster(getPayloadRoster(payload));
    }).catch(function(err){
      if (handleSessionExpired(err)) throw err;
      console.error('[RaidSessionClient] Unable to load session roster.', err && err.message ? err.message : err);
      return emptyRoster();
    });
  }

  function saveSessionRoster(roster){
    var session = getCurrentSession();
    if (!session.isSessionBacked) {
      return ensureStorage().saveRoster(roster);
    }

    if (session.mode !== 'edit' || !session.sessionId || !session.editToken) {
      return Promise.resolve(false);
    }

    return debouncedSaveSessionRoster(session, roster);
  }

  function clearSessionRoster(){
    var session = getCurrentSession();
    if (!session.isSessionBacked) {
      return ensureStorage().clearRoster();
    }

    if (session.mode === 'edit' && session.sessionId && session.editToken) {
      cancelDebouncedSessionSave(false);
      return saveRosterToSession(session.sessionId, session.editToken, emptyRoster()).catch(function(err){
        if (handleSessionExpired(err)) return false;
        console.error('[RaidSessionClient] Unable to clear session roster.', err && err.message ? err.message : err);
        return false;
      });
    }

    return Promise.resolve(false);
  }

  function isEditMode(){ return getCurrentSession().mode === 'edit'; }
  function isViewMode(){ return getCurrentSession().mode === 'view'; }

  var api = {
    createSession: createSession,
    getEditTokenFromUrl: getEditTokenFromUrl,
    saveRosterToSession: saveRosterToSession,
    debouncedSaveSessionRoster: debouncedSaveSessionRoster,
    createSessionFromRoster: createSessionFromRoster,
    getPublicCode: getPublicCode,
    isValidPublicCode: isValidPublicCode,
    loadSessionPayload: loadSessionPayload,
    getCurrentSession: getCurrentSession,
    debugPageRole: debugPageRole,
    loadSessionRoster: loadSessionRoster,
    saveSessionRoster: saveSessionRoster,
    clearSessionRoster: clearSessionRoster,
    isEditMode: isEditMode,
    isViewMode: isViewMode,
    createSessionHttpError: createSessionHttpError,
    isSessionExpiredError: isSessionExpiredError,
    showSessionExpiredNotice: showSessionExpiredNotice,
    handleSessionExpired: handleSessionExpired
  };

  global.RaidSessionClient = api;
})(window);

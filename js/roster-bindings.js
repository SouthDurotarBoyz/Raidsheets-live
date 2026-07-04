(function(global) {
  'use strict';

  const storage = window.RaidRosterStorage;
  const sessionClient = window.RaidSessionClient;
  const SOFT_RESERVE_KEY = 'soft-reserve-url';
  const SESSION_VIEW_REFRESH_INTERVAL_MS = 30000;
  const SESSION_VIEW_REFRESH_JITTER_MS = 5000;
  const SESSION_VIEW_REFRESH_BACKOFF_MAX_MS = 300000;
  
  const EMPTY_BINDING_CONFIG = Object.freeze({});

  let GROUP_DEFS = {};
  let SINGLE_DEFAULTS = {};
  let SINGLE_ALIASES = {};
  let GROUP_ALIASES = {};
  let GROUP_TARGET_ALIASES = {};
  let GROUP_LABELS = {};
  let INDEX_ALIASES = {};
  let DERIVED_BINDINGS = {};
  let schemaFields = {};
  let currentRaidId = '';
  let hasRaidBindingConfig = false;

  function resetActiveBindings() {
    GROUP_DEFS = {};
    SINGLE_DEFAULTS = {};
    SINGLE_ALIASES = {};
    GROUP_ALIASES = {};
    GROUP_TARGET_ALIASES = {};
    GROUP_LABELS = {};
    INDEX_ALIASES = {};
    DERIVED_BINDINGS = {};
    hasRaidBindingConfig = false;
  }

  function activateBindingConfig(config) {
    const bindingConfig = config && typeof config === 'object' ? config : EMPTY_BINDING_CONFIG;
    GROUP_DEFS = bindingConfig.groupDefs || {};
    SINGLE_DEFAULTS = bindingConfig.singleDefaults || {};
    SINGLE_ALIASES = bindingConfig.singleAliases || {};
    GROUP_ALIASES = bindingConfig.groupAliases || {};
    GROUP_TARGET_ALIASES = bindingConfig.groupTargetAliases || {};
    GROUP_LABELS = bindingConfig.groupLabels || {};
    INDEX_ALIASES = bindingConfig.indexAliases || {};
    DERIVED_BINDINGS = bindingConfig.derivedBindings || {};
    hasRaidBindingConfig = Object.keys(bindingConfig).some(function(key) {
      return bindingConfig[key] && typeof bindingConfig[key] === 'object' && Object.keys(bindingConfig[key]).length > 0;
    });
  }

  let state = { groups: {}, singles: {}, meta: {} };
  let sessionViewRefreshTimerId = null;
  let sessionViewRefreshFailureCount = 0;
  let sessionViewVisibilityHandlerAttached = false;
  let sessionViewExpired = false;

  function isSessionViewMode() {
    if (sessionViewExpired) return false;
    if (!sessionClient || !sessionClient.getCurrentSession) return false;
    const session = sessionClient.getCurrentSession();
    return !!(session && session.isSessionBacked && session.mode === 'view');
  }

  function shouldUseSessionRoster() {
    return isSessionViewMode();
  }

  function getCurrentRaidId() {
    const bodyRaidId = global.document && global.document.body ? global.document.body.getAttribute('data-raid-id') : '';
    if (bodyRaidId) return bodyRaidId;
    if (global.RaidConfig && global.RaidConfig.raidId) return global.RaidConfig.raidId;
    if (storage && storage.getCurrentRaidId) return storage.getCurrentRaidId();
    return '';
  }

  function isListField(key) {
    if (schemaFields[key] && schemaFields[key].type === 'list') return true;
    return !!GROUP_DEFS[key];
  }

  function loadRosterSchema(raidId) {
    schemaFields = {};
    if (!raidId || !global.fetch) return Promise.resolve(schemaFields);
    return fetch('raids/' + raidId + '/roster-schema.json', { credentials: 'same-origin' }).then(function(response) {
      if (!response || !response.ok) throw new Error('Unable to load roster schema for ' + raidId);
      return response.json();
    }).then(function(schema) {
      schemaFields = schema && schema.fields ? schema.fields : {};
      return schemaFields;
    }).catch(function(error) {
      schemaFields = {};
      if (raidId === 'gruuls-lair') {
        console.warn('Unable to load Gruul roster schema; falling back to legacy bindings.', error);
      } else {
        console.warn('Unable to load roster schema for ' + raidId + '; continuing with direct bindings only.', error);
      }
      return schemaFields;
    });
  }

  function loadRosterBindingConfig(raidId) {
    if (!raidId || !global.fetch) return Promise.resolve(EMPTY_BINDING_CONFIG);
    return fetch('raids/' + raidId + '/roster-bindings.json', { credentials: 'same-origin' }).then(function(response) {
      if (!response || response.status === 404) return EMPTY_BINDING_CONFIG;
      if (!response.ok) throw new Error('Unable to load roster binding config for ' + raidId);
      return response.json();
    }).catch(function(error) {
      console.warn('Unable to load roster binding config for ' + raidId + '; continuing with direct bindings only.', error);
      return EMPTY_BINDING_CONFIG;
    });
  }

  function configureActiveBindings(raidId) {
    currentRaidId = raidId || getCurrentRaidId();
    resetActiveBindings();
  }

  function updateSoftReserveLink() {
    const currentRaidId = getCurrentRaidId();
    if (!global.SoftReserveLink || !global.SoftReserveLink.updateFromRoster) return;
    global.SoftReserveLink.updateFromRoster(state, currentRaidId);
  }

  function debugSoftReserve() {
    const session = sessionClient && sessionClient.getCurrentSession ? sessionClient.getCurrentSession() : null;
    const metaSoftReserveUrl = state && state.meta ? state.meta[SOFT_RESERVE_KEY] : undefined;
    const legacySoftReserveUrl = state && state.singles ? state.singles[SOFT_RESERVE_KEY] : undefined;
    const softReserveUrl = metaSoftReserveUrl || legacySoftReserveUrl;
    return {
      raidId: getCurrentRaidId(),
      sessionMode: session && session.mode ? session.mode : 'local',
      isSessionBacked: !!(session && session.isSessionBacked),
      publicCode: session && session.publicCode ? session.publicCode : null,
      sessionId: session && session.sessionId ? session.sessionId : null,
      softReserveUrl: softReserveUrl || '',
      metaSoftReserveUrl: metaSoftReserveUrl || '',
      legacySinglesSoftReserveUrl: legacySoftReserveUrl || '',
      hasSoftReserveUrl: !!softReserveUrl
    };
  }

  function normalizeLoadedState() {
    state = state || { groups: {}, singles: {}, meta: {} };
    if (!state.groups || typeof state.groups !== 'object' || Array.isArray(state.groups)) state.groups = {};
    if (!state.singles || typeof state.singles !== 'object' || Array.isArray(state.singles)) state.singles = {};
    if (!state.meta || typeof state.meta !== 'object' || Array.isArray(state.meta)) state.meta = {};
    if (Object.prototype.hasOwnProperty.call(state.singles, SOFT_RESERVE_KEY)) {
      if (!Object.prototype.hasOwnProperty.call(state.meta, SOFT_RESERVE_KEY)) state.meta[SOFT_RESERVE_KEY] = state.singles[SOFT_RESERVE_KEY];
      delete state.singles[SOFT_RESERVE_KEY];
    }
    Object.keys(schemaFields || {}).forEach(function(key) {
      const field = schemaFields[key] || {};
      if (field.type === 'list') {
        if (!Array.isArray(state.groups[key])) {
          const defaultCount = GROUP_DEFS[key] ? GROUP_DEFS[key].defaultCount || 0 : 0;
          state.groups[key] = new Array(defaultCount).fill('');
        }
        return;
      }
      if (field.type === 'single' && state.singles[key] !== undefined && typeof state.singles[key] !== 'string') {
        state.singles[key] = state.singles[key] == null ? '' : String(state.singles[key]);
      }
    });
    Object.keys(GROUP_DEFS).forEach(function(groupName) {
      if (!Array.isArray(state.groups[groupName])) state.groups[groupName] = new Array(GROUP_DEFS[groupName].defaultCount || 0).fill('');
    });
  }

  function normalizeRosterState(roster) {
    const currentState = state;
    state = roster || { groups: {}, singles: {}, meta: {} };
    normalizeLoadedState();
    const normalizedState = state;
    state = currentState;
    return normalizedState;
  }

  function serializeRosterState(roster) {
    const normalized = normalizeRosterState(roster);
    const serialized = {
      groups: {},
      singles: {},
      meta: {}
    };
    Object.keys(normalized.groups || {}).sort().forEach(function(key) {
      serialized.groups[key] = Array.isArray(normalized.groups[key]) ? normalized.groups[key] : [];
    });
    Object.keys(normalized.singles || {}).sort().forEach(function(key) {
      serialized.singles[key] = normalized.singles[key] || '';
    });
    Object.keys(normalized.meta || {}).sort().forEach(function(key) {
      serialized.meta[key] = normalized.meta[key] || '';
    });
    return JSON.stringify(serialized);
  }

  function rosterHasAssignments(roster) {
    const normalized = normalizeRosterState(roster);
    const hasGroupAssignments = Object.keys(normalized.groups || {}).some(function(key) {
      return Array.isArray(normalized.groups[key]) && normalized.groups[key].some(function(value) {
        return !!(value && value.trim());
      });
    });
    if (hasGroupAssignments) return true;
    return Object.keys(normalized.singles || {}).some(function(key) {
      const value = normalized.singles[key];
      return !!(value && value.trim());
    });
  }

  function isSessionExpiredError(error) {
    return !!(sessionClient && sessionClient.isSessionExpiredError && sessionClient.isSessionExpiredError(error));
  }

  function handleSessionExpiredError(error) {
    if (!isSessionExpiredError(error)) return false;
    if (sessionClient && sessionClient.handleSessionExpired) sessionClient.handleSessionExpired(error);
    sessionViewExpired = true;
    stopSessionViewPolling();
    removeSessionViewVisibilityHandler();
    return true;
  }

  function emptyRosterState() {
    return { groups: {}, singles: {}, meta: {} };
  }

  function refreshSessionBindings() {
    if (!isSessionViewMode()) {
      stopSessionViewPolling();
      return Promise.resolve();
    }
    if (!sessionClient || !sessionClient.loadSessionRoster) return Promise.resolve();
    return Promise.resolve(sessionClient.loadSessionRoster()).then(function(nextState) {
      if (rosterHasAssignments(state) && !rosterHasAssignments(nextState)) {
        console.warn('Session roster refresh returned empty bindings; keeping current assignments.');
        return;
      }
      const currentSerialized = serializeRosterState(state);
      const nextSerialized = serializeRosterState(nextState);
      if (nextSerialized === currentSerialized) return;
      state = normalizeRosterState(nextState);
      updateAllBindings();
      updateSoftReserveLink();
      sessionViewRefreshFailureCount = 0;
    }).catch(function(error) {
      if (handleSessionExpiredError(error)) return;
      sessionViewRefreshFailureCount += 1;
      console.warn('Unable to refresh session roster bindings.', error);
    });
  }

  function getSessionViewRefreshDelay() {
    if (sessionViewRefreshFailureCount <= 0) {
      return SESSION_VIEW_REFRESH_INTERVAL_MS + Math.floor(Math.random() * (SESSION_VIEW_REFRESH_JITTER_MS + 1));
    }
    const failureDelayMs = Math.min(SESSION_VIEW_REFRESH_BACKOFF_MAX_MS, 60000 * Math.pow(2, sessionViewRefreshFailureCount - 1));
    return failureDelayMs;
  }

  function scheduleSessionViewRefresh(delayMs) {
    stopSessionViewPolling();
    if (!isSessionViewMode() || isDocumentHidden()) return;
    sessionViewRefreshTimerId = global.setTimeout(function() {
      sessionViewRefreshTimerId = null;
      if (!isSessionViewMode() || isDocumentHidden()) {
        stopSessionViewPolling();
        return;
      }
      refreshSessionBindings().finally(function() {
        if (!isSessionViewMode() || isDocumentHidden()) {
          stopSessionViewPolling();
          return;
        }
        scheduleSessionViewRefresh(getSessionViewRefreshDelay());
      });
    }, delayMs);
  }

  function isDocumentHidden() {
    return !!(global.document && global.document.hidden);
  }

  function addSessionViewVisibilityHandler() {
    if (sessionViewVisibilityHandlerAttached || !global.document || !global.document.addEventListener) return;
    global.document.addEventListener('visibilitychange', handleSessionViewVisibilityChange);
    sessionViewVisibilityHandlerAttached = true;
  }

  function removeSessionViewVisibilityHandler() {
    if (!sessionViewVisibilityHandlerAttached || !global.document || !global.document.removeEventListener) return;
    global.document.removeEventListener('visibilitychange', handleSessionViewVisibilityChange);
    sessionViewVisibilityHandlerAttached = false;
  }

  function stopSessionViewPolling() {
    if (!sessionViewRefreshTimerId) return;
    clearTimeout(sessionViewRefreshTimerId);
    sessionViewRefreshTimerId = null;
  }

  function handleSessionViewVisibilityChange() {
    if (!isSessionViewMode()) {
      stopSessionViewPolling();
      removeSessionViewVisibilityHandler();
      return;
    }

    if (isDocumentHidden()) {
      stopSessionViewPolling();
      return;
    }

    refreshSessionBindings().finally(function() {
      if (!isSessionViewMode() || isDocumentHidden()) return;
      scheduleSessionViewRefresh(getSessionViewRefreshDelay());
    });
  }

  function startSessionViewPolling() {
    stopSessionViewPolling();
    if (!isSessionViewMode() || !sessionClient || !sessionClient.loadSessionRoster) {
      removeSessionViewVisibilityHandler();
      return;
    }

    addSessionViewVisibilityHandler();
    if (isDocumentHidden()) return;
    scheduleSessionViewRefresh(getSessionViewRefreshDelay());
  }

  function cleanList(values) { return (values || []).filter(function(value) { return value && value.trim(); }); }
  function getRawGroupSlot(groupName, index) {
    const values = Array.isArray(state.groups[groupName]) ? state.groups[groupName] : [];
    const value = values[index];
    return value ? value.trim() : '';
  }
  function getUniqueGroupSlot(groups, index) {
    const seen = {};
    const values = (Array.isArray(groups) ? groups : []).reduce(function(uniqueValues, groupName) {
      const groupValues = Array.isArray(state.groups[groupName]) ? state.groups[groupName] : [];
      groupValues.forEach(function(value) {
        const trimmed = value ? value.trim() : '';
        const normalized = trimmed.toLowerCase();
        if (!trimmed || seen[normalized]) return;
        seen[normalized] = true;
        uniqueValues.push(trimmed);
      });
      return uniqueValues;
    }, []);
    return values[index] || '';
  }
  function getGroupSlotModulo(groupName, modulo, remainder) {
    const slotModulo = Number(modulo);
    const slotRemainder = Number(remainder) || 0;
    if (!Number.isFinite(slotModulo) || slotModulo <= 0) return '';
    const values = Array.isArray(state.groups[groupName]) ? state.groups[groupName] : [];
    return values.reduce(function(cleanValues, value) {
      const trimmed = value ? value.trim() : '';
      if (trimmed) cleanValues.push(trimmed);
      return cleanValues;
    }, []).filter(function(value, index) {
      return index % slotModulo === slotRemainder;
    }).join(', ');
  }
  function getIndexedAlias(key) { const spec = INDEX_ALIASES[key]; return spec ? cleanList(state.groups[spec.group])[spec.index] || '' : ''; }
  function getDerivedValue(key) {
    const spec = DERIVED_BINDINGS[key];
    if (!spec || typeof spec !== 'object') return '';
    if (spec.type === 'group-slot') return getRawGroupSlot(spec.group, spec.index || 0);
    if (spec.type === 'group-slot-fallback') return getRawGroupSlot(spec.group, spec.index || 0) || getRawGroupSlot(spec.group, spec.fallbackIndex || 0);
    if (spec.type === 'unique-group-slot') return getUniqueGroupSlot(spec.groups, spec.index || 0);
    if (spec.type === 'group-slot-modulo') return getGroupSlotModulo(spec.group, spec.modulo, spec.remainder);
    if (spec.type === 'olm-tank') {
      const values = Array.isArray(state.groups[spec.group]) ? state.groups[spec.group] : [];
      return getRawGroupSlot(spec.group, values.length >= 2 ? 1 : 0);
    }
    if (spec.type === 'single-list') {
      const seen = {};
      return (Array.isArray(spec.keys) ? spec.keys : []).reduce(function(values, singleKey) {
        if (singleKey === key) return values;
        const value = state.singles && state.singles[singleKey] ? state.singles[singleKey].trim() : '';
        if (!value || seen[value]) return values;
        seen[value] = true;
        values.push(value);
        return values;
      }, []).join(', ');
    }
    if (spec.type === 'single-fallback') {
      const keys = Array.isArray(spec.keys) ? spec.keys : [];
      for (let i = 0; i < keys.length; i += 1) {
        if (keys[i] === key) continue;
        const value = state.singles && state.singles[keys[i]] ? state.singles[keys[i]].trim() : '';
        if (value) return value;
      }
    }
    return '';
  }
  function getGroupValues(groupName, visitedAliases, seenValues) {
    const aliasGroups = GROUP_ALIASES[groupName];
    if (aliasGroups) {
      if (visitedAliases[groupName]) return [];
      visitedAliases[groupName] = true;
      return aliasGroups.reduce(function(values, aliasGroupName) {
        return values.concat(getGroupValues(aliasGroupName, visitedAliases, seenValues));
      }, []);
    }

    return cleanList(state.groups[groupName]).reduce(function(values, value) {
      const trimmed = value.trim();
      const normalized = trimmed.toLowerCase();
      if (!trimmed || seenValues[normalized]) return values;
      seenValues[normalized] = true;
      values.push(trimmed);
      return values;
    }, []);
  }
  function getGroupValue(groupName) { return getGroupValues(groupName, {}, {}).join(', '); }
  function getSingleValue(key) {
    if (DERIVED_BINDINGS[key]) return getDerivedValue(key);
    if (INDEX_ALIASES[key]) return getIndexedAlias(key);
    const alias = SINGLE_ALIASES[key];
    if (alias) return isListField(alias) ? getGroupValue(alias) : state.singles[alias] || '';
    if (GROUP_TARGET_ALIASES[key]) return getGroupValue(GROUP_TARGET_ALIASES[key]);
    if (state.singles[key]) return state.singles[key];
    if (isListField(key) || (!schemaFields[key] && Array.isArray(state.groups[key]))) return getGroupValue(key);
    return '';
  }
  function fallbackForSingle(key, el) { if (el && el.dataset.default) return el.dataset.default; if (DERIVED_BINDINGS[key]) return DERIVED_BINDINGS[key].fallback || key; if (INDEX_ALIASES[key]) return INDEX_ALIASES[key].fallback; if (SINGLE_DEFAULTS[key]) return SINGLE_DEFAULTS[key]; const alias = SINGLE_ALIASES[key]; if (alias && SINGLE_DEFAULTS[alias]) return SINGLE_DEFAULTS[alias]; if (GROUP_TARGET_ALIASES[key]) return groupNamePlural(GROUP_TARGET_ALIASES[key]); return key; }

  function updateAllBindings() {
    const singleKeys = new Set(Object.keys(SINGLE_DEFAULTS).concat(Object.keys(SINGLE_ALIASES)).concat(Object.keys(GROUP_TARGET_ALIASES)).concat(Object.keys(INDEX_ALIASES)).concat(Object.keys(DERIVED_BINDINGS)));
    document.querySelectorAll('[data-bind]').forEach(function(el) { if (el.dataset.bind) singleKeys.add(el.dataset.bind); });
    Object.keys(state.singles || {}).forEach(function(key) { singleKeys.add(key); });
    singleKeys.forEach(function(key) {
      const value = getSingleValue(key);
      const isAssigned = !!value;
      document.querySelectorAll('[data-bind="' + key + '"]').forEach(function(el) {
        const hideEmptyRow = el.dataset.hideEmptyRow === 'true';
        const setupLine = hideEmptyRow && el.closest ? el.closest('.setup-line') : null;
        if (setupLine) setupLine.style.display = isAssigned ? '' : 'none';
        el.textContent = value || (hideEmptyRow ? '' : fallbackForSingle(key, el));
        el.classList.toggle('unassigned', !isAssigned);
      });
    });
    const schemaGroupKeys = Object.keys(schemaFields || {}).filter(isListField);
    const groupKeys = new Set(schemaGroupKeys.concat(Object.keys(GROUP_DEFS)).concat(Object.keys(GROUP_ALIASES)));
    document.querySelectorAll('[data-bind-group]').forEach(function(el) { if (el.dataset.bindGroup) groupKeys.add(el.dataset.bindGroup); });
    Object.keys(state.groups || {}).forEach(function(key) { groupKeys.add(key); });
    groupKeys.forEach(function(groupName) {
      const value = getGroupValue(groupName);
      const isAssigned = !!value;
      document.querySelectorAll('[data-bind-group="' + groupName + '"]').forEach(function(el) {
        const hideEmptyRow = el.dataset.hideEmptyRow === 'true';
        const setupLine = hideEmptyRow && el.closest ? el.closest('.setup-line') : null;
        if (setupLine) setupLine.style.display = isAssigned ? '' : 'none';
        el.textContent = value || (hideEmptyRow ? '' : el.dataset.default || groupNamePlural(groupName));
        el.classList.toggle('unassigned', !isAssigned);
      });
    });
    document.querySelectorAll('[data-target-bind]').forEach(function(el) {
      const key = el.dataset.targetBind;
      const value = getSingleValue(key);
      if (!value) { el.textContent = ''; return; }
      if (el.classList.contains('assignment-target')) { el.textContent = value; return; }
      const prev = el.previousElementSibling;
      const isHealerMdContext = el.classList.contains('tank-paren') && prev && (prev.hasAttribute('data-bind-group') || prev.hasAttribute('data-bind'));
      el.textContent = isHealerMdContext ? ' → (' + value + ')' : ' (' + value + ')';
    });
  }

  function groupNamePlural(name) {
    if (GROUP_LABELS[name]) return GROUP_LABELS[name];
    const groupDef = GROUP_DEFS[name];
    if (groupDef && groupDef.defaultLabel) return groupDef.defaultLabel;
    return name.replace(/-/g, ' ');
  }

  function initBindingsWithState() {
    normalizeLoadedState();
    updateAllBindings();
    updateSoftReserveLink();
    startSessionViewPolling();
  }

  function loadStateForBindings() {
    if (shouldUseSessionRoster() && sessionClient && sessionClient.loadSessionRoster) {
      return Promise.resolve(sessionClient.loadSessionRoster()).catch(function(error) {
        if (handleSessionExpiredError(error)) return emptyRosterState();
        return storage.loadRoster();
      });
    }
    return storage.loadRoster();
  }

  function debugStateKeys() {
    return {
      raidId: currentRaidId,
      schemaFieldKeys: Object.keys(schemaFields || {}).sort(),
      groupKeys: Object.keys(state.groups || {}).sort(),
      singleKeys: Object.keys(state.singles || {}).sort(),
      metaKeys: Object.keys(state.meta || {}).sort(),
      hasRaidBindingConfig: hasRaidBindingConfig,
      bindingConfigKeys: {
        groupDefs: Object.keys(GROUP_DEFS || {}).sort(),
        singleDefaults: Object.keys(SINGLE_DEFAULTS || {}).sort(),
        singleAliases: Object.keys(SINGLE_ALIASES || {}).sort(),
        groupAliases: Object.keys(GROUP_ALIASES || {}).sort(),
        groupTargetAliases: Object.keys(GROUP_TARGET_ALIASES || {}).sort(),
        groupLabels: Object.keys(GROUP_LABELS || {}).sort(),
        indexAliases: Object.keys(INDEX_ALIASES || {}).sort(),
        derivedBindings: Object.keys(DERIVED_BINDINGS || {}).sort()
      }
    };
  }

  const api = {
    debugSoftReserve: debugSoftReserve,
    debugStateKeys: debugStateKeys,
    init: function() {
      stopSessionViewPolling();
      sessionViewExpired = false;
      configureActiveBindings(getCurrentRaidId());
      var loaded;
      try {
        loaded = loadStateForBindings();
      } catch (error) {
        if (handleSessionExpiredError(error)) {
          loaded = emptyRosterState();
        } else {
          loaded = storage.loadRoster();
        }
      }
      Promise.all([
        Promise.resolve(loaded),
        loadRosterSchema(currentRaidId),
        loadRosterBindingConfig(currentRaidId)
      ]).then(function(results) {
        state = results[0];
        activateBindingConfig(results[2]);
        initBindingsWithState();
      }).catch(function(error) {
        if (handleSessionExpiredError(error)) {
          state = emptyRosterState();
        } else {
          state = storage.loadRoster();
        }
        activateBindingConfig(EMPTY_BINDING_CONFIG);
        initBindingsWithState();
      });
    }
  };

  global.RaidRosterBindings = api;
})(window);

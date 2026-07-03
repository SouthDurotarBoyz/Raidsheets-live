(function(global) {
  'use strict';

  var SOFT_RESERVE_SELECTOR = '[data-soft-reserve-link="true"]';
  var PUBLIC_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/;
  var SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  var lastInitSkippedLocalStorage = false;

  function getStorage() {
    return global.RaidRosterStorage;
  }

  function getSoftReserveKey() {
    var storage = getStorage();
    return storage && storage.SOFT_RESERVE_KEY ? storage.SOFT_RESERVE_KEY : '';
  }

  function hasRaidSessionClient() {
    return !!(global.RaidSessionClient && global.RaidSessionClient.getCurrentSession);
  }

  function getCurrentSession() {
    if (!hasRaidSessionClient()) return null;

    try {
      return global.RaidSessionClient.getCurrentSession();
    } catch (err) {
      return null;
    }
  }

  function getSearchParams() {
    try {
      return new global.URLSearchParams((global.location && global.location.search) || '');
    } catch (err) {
      return null;
    }
  }

  function hasSessionQueryParams() {
    var params = getSearchParams();
    var sessionId;
    var publicCode;

    if (!params) return false;

    sessionId = params.get('session') || '';
    if (SESSION_ID_PATTERN.test(sessionId)) return true;

    publicCode = params.get('code') || '';
    return PUBLIC_CODE_PATTERN.test(String(publicCode).toUpperCase());
  }

  function isSessionBackedPage() {
    var session = getCurrentSession();
    if (session && session.isSessionBacked) return true;
    return hasSessionQueryParams();
  }

  function getRaidId(storage, raidId) {
    var bodyRaidId = global.document && global.document.body ? global.document.body.getAttribute('data-raid-id') : '';
    if (raidId) return raidId;
    if (bodyRaidId) return bodyRaidId;
    if (global.RaidConfig && global.RaidConfig.raidId) return global.RaidConfig.raidId;
    if (storage && storage.getCurrentRaidId) return storage.getCurrentRaidId();
    return '';
  }

  function normalizeUrl(url) {
    var trimmed = url ? String(url).trim() : '';
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return 'https://' + trimmed;
  }

  function displayUrl(url) {
    return url ? String(url).trim().replace(/^https?:\/\//i, '') : '';
  }

  function softReserveUrlFromRoster(rosterState) {
    var key = getSoftReserveKey();
    var meta = rosterState && rosterState.meta && typeof rosterState.meta === 'object' ? rosterState.meta : {};
    var singles = rosterState && rosterState.singles && typeof rosterState.singles === 'object' ? rosterState.singles : {};
    var savedUrl;
    if (!key) {
      return {
        savedUrl: '',
        href: '',
        text: ''
      };
    }
    savedUrl = Object.prototype.hasOwnProperty.call(meta, key) ? meta[key] : singles[key];
    return {
      savedUrl: normalizeUrl(savedUrl),
      href: normalizeUrl(savedUrl),
      text: displayUrl(savedUrl)
    };
  }

  function softReserveUrl(storage, raidId) {
    var state = storage && storage.loadRoster ? storage.loadRoster(raidId) : null;
    return softReserveUrlFromRoster(state);
  }

  function findSoftReserveAnchor() {
    var pageNav = document.querySelector('.page-nav');

    if (!pageNav) return null;

    return pageNav.querySelector('[data-soft-reserve-anchor]') || pageNav.querySelector('[data-home-link]');
  }

  function updateButton(link, url) {
    link.className = 'btn';
    link.href = url.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = url.text;
    link.dataset.softReserveLink = 'true';
    link.style.marginRight = 'auto';
    return link;
  }

  function createButton(url) {
    return updateButton(document.createElement('a'), url);
  }

  function updateLink(url) {
    var existingLink = document.querySelector(SOFT_RESERVE_SELECTOR);
    var anchor;

    if (!url.href || !url.text) {
      if (existingLink) existingLink.remove();
      return;
    }

    anchor = findSoftReserveAnchor();
    if (!anchor) return;

    if (existingLink) {
      updateButton(existingLink, url);
      if (existingLink.previousElementSibling !== anchor) {
        anchor.insertAdjacentElement('afterend', existingLink);
      }
      return;
    }

    anchor.insertAdjacentElement('afterend', createButton(url));
  }

  var lastUrl = {
    savedUrl: '',
    href: '',
    text: ''
  };

  function rememberUrl(url) {
    lastUrl = url || {
      savedUrl: '',
      href: '',
      text: ''
    };
    return lastUrl;
  }

  function debug() {
    var navLink = document.querySelector(SOFT_RESERVE_SELECTOR);
    var pageNav = document.querySelector('.page-nav');
    return {
      foundNav: !!navLink,
      savedUrl: lastUrl.savedUrl || '',
      displayText: navLink ? navLink.textContent.trim() : (lastUrl.text || ''),
      href: navLink ? navLink.href : (lastUrl.href || ''),
      hasSoftReserveAnchor: !!findSoftReserveAnchor(),
      hasPageNav: !!pageNav,
      isSessionBacked: isSessionBackedPage(),
      skippedLocalInit: lastInitSkippedLocalStorage,
      hasRaidSessionClient: hasRaidSessionClient()
    };
  }

  function updateFromRoster(rosterState, raidId) {
    var url = rememberUrl(softReserveUrlFromRoster(rosterState));
    updateLink(url);
  }

  function init(raidId) {
    var storage;
    var url;

    if (isSessionBackedPage()) {
      lastInitSkippedLocalStorage = true;
      updateLink(rememberUrl({
        savedUrl: '',
        href: '',
        text: ''
      }));
      return;
    }

    lastInitSkippedLocalStorage = false;
    storage = getStorage();
    if (!storage) return;
    url = rememberUrl(softReserveUrl(storage, getRaidId(storage, raidId)));
    updateLink(url);
  }

  global.SoftReserveLink = {
    init: init,
    updateFromRoster: updateFromRoster,
    debug: debug
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function() { init(); });
  else init();
})(window);

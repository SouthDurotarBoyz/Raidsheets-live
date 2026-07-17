(function() {
  'use strict';

  var bossTabNavigationPending = false;

  function isModifiedNavigation(event) {
    return event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
  }

  function lockBossTabs() {
    var bossTabs = document.querySelectorAll('[data-boss-tabs] .boss-tab');
    for (var i = 0; i < bossTabs.length; i += 1) {
      bossTabs[i].setAttribute('aria-disabled', 'true');
      bossTabs[i].classList.add('boss-tab-pending');
    }
  }

  function getParams() {
    return new URLSearchParams(window.location.search || '');
  }

  function sanitizePage(page) {
    return typeof page === 'string' ? page.split('?')[0] : '';
  }

  function getPreservedQueryString(params) {
    var preservedParams = new URLSearchParams();
    var allowedParams = {
      code: true,
      session: true,
      edit: true
    };

    params.forEach(function(value, key) {
      if (allowedParams[key]) preservedParams.append(key, value);
    });

    return preservedParams.toString();
  }

  function buildBossTab(boss, currentBossId, preservedQueryString) {
    var link = document.createElement('a');
    var isCurrent = boss.id === currentBossId;
    link.className = 'btn boss-tab' + (isCurrent ? ' boss-tab-active' : '');
    var page = sanitizePage(boss.page);
    link.href = preservedQueryString ? (page + '?' + preservedQueryString) : page;
    if (isCurrent) link.setAttribute('aria-current', 'page');

    link.addEventListener('click', function(event) {
      if (isModifiedNavigation(event)) return;
      if (bossTabNavigationPending) {
        event.preventDefault();
        return;
      }

      bossTabNavigationPending = true;
      lockBossTabs();
    });

    var icon = document.createElement('img');
    icon.className = 'boss-tab-icon';
    icon.src = boss.icon;
    icon.alt = '';
    link.appendChild(icon);
    link.appendChild(document.createTextNode(boss.shortName || boss.name || boss.id));
    return link;
  }

  function applyNav(raid) {
    var root = document.body;
    var bossId = root.getAttribute('data-boss-id');
    var navContainer = document.querySelector('[data-boss-tabs]');
    if (!navContainer || !raid || !Array.isArray(raid.bosses)) return;

    var params = getParams();
    var preservedQueryString = getPreservedQueryString(params);
    var sessionId = params.get('session');
    var publicCode = params.get('code');
    var rosterPage = sanitizePage(raid.rosterPage);
    var rosterLink = document.querySelector('[data-roster-link]');
    if (rosterLink) {
      if (sessionId || publicCode) {
        rosterLink.style.display = 'none';
      } else if (rosterPage) {
        rosterLink.href = rosterPage;
      }
    }

    navContainer.innerHTML = '';
    for (var i = 0; i < raid.bosses.length; i += 1) {
      navContainer.appendChild(buildBossTab(raid.bosses[i], bossId, preservedQueryString));
    }
  }

  function init() {
    var root = document.body;
    var raidId = root.getAttribute('data-raid-id');
    if (!raidId) return;

    fetch('raids/' + raidId + '/raid.json', { credentials: 'same-origin' })
      .then(function(response) {
        if (!response.ok) throw new Error('Failed to load raid.json');
        return response.json();
      })
      .then(applyNav)
      .catch(function() {
        // Keep existing/static nav content if metadata cannot be loaded.
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

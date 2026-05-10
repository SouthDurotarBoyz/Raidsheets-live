(function(window) {
  'use strict';

  const RAID_MARKERS = {
    skull: 'assets/shared/markers/skull.svg',
    cross: 'assets/shared/markers/cross.svg',
    square: 'assets/shared/markers/square.svg',
    diamond: 'assets/shared/markers/diamond.svg',
    triangle: 'assets/shared/markers/triangle.svg',
    moon: 'assets/shared/markers/moon.svg',
    star: 'assets/shared/markers/star.svg',
    circle: 'assets/shared/markers/circle.svg'
  };

  function iconUrl(iconName) {
    return 'https://wow.zamimg.com/images/wow/icons/large/' + iconName + '.jpg';
  }

  function raidMarkerSource(markerName) {
    if (!Object.prototype.hasOwnProperty.call(RAID_MARKERS, markerName)) return '';
    return RAID_MARKERS[markerName];
  }

  async function copyTextWithButtonFeedback(text, button, promptMessage) {
    try {
      await navigator.clipboard.writeText(text);
      if (!button) return;

      const originalChildNodes = Array.from(button.childNodes).map(function(node) {
        return node.cloneNode(true);
      });

      button.textContent = 'Copied';
      setTimeout(function() {
        button.textContent = '';
        originalChildNodes.forEach(function(node) {
          button.appendChild(node);
        });
      }, 1400);
    } catch (error) {
      window.prompt(promptMessage, text);
    }
  }

  function bindSoftReserveInput(options) {
    const input = document.getElementById(options.inputId || 'soft-reserve-url');
    if (!input) return;

    function currentState() {
      return options.getState ? options.getState() : options.state;
    }

    function ensureSoftReserveMeta(activeState) {
      if (!activeState || typeof activeState !== 'object') activeState = {};
      if (!activeState.singles || typeof activeState.singles !== 'object' || Array.isArray(activeState.singles)) activeState.singles = {};
      if (!activeState.meta || typeof activeState.meta !== 'object' || Array.isArray(activeState.meta)) activeState.meta = {};
      if (Object.prototype.hasOwnProperty.call(activeState.singles, options.key)) {
        if (!Object.prototype.hasOwnProperty.call(activeState.meta, options.key)) activeState.meta[options.key] = activeState.singles[options.key];
        delete activeState.singles[options.key];
      }
      return activeState;
    }

    const state = ensureSoftReserveMeta(currentState());
    input.value = (state.meta && state.meta[options.key]) || '';
    input.addEventListener('input', function() {
      const activeState = ensureSoftReserveMeta(currentState());
      const trimmed = input.value.trim();
      if (trimmed) activeState.meta[options.key] = trimmed;
      else delete activeState.meta[options.key];
      options.saveState();
    });
  }

  window.RosterUiHelpers = {
    RAID_MARKERS: RAID_MARKERS,
    iconUrl: iconUrl,
    raidMarkerSource: raidMarkerSource,
    copyTextWithButtonFeedback: copyTextWithButtonFeedback,
    bindSoftReserveInput: bindSoftReserveInput
  };
})(window);

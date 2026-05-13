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

  function cloneButtonContent(button) {
    if (!button) return null;
    return Array.from(button.childNodes).map(function(node) {
      return node.cloneNode(true);
    });
  }

  function showCopiedButtonFeedback(button, originalChildNodes) {
    if (!button) return;

    const nodesToRestore = originalChildNodes || cloneButtonContent(button);

    button.textContent = 'Copied';
    setTimeout(function() {
      button.textContent = '';
      nodesToRestore.forEach(function(node) {
        button.appendChild(node);
      });
    }, 1400);
  }

  async function copyResolvedTextWithButtonFeedback(text, button, promptMessage, originalChildNodes) {
    const resolvedText = String(text || '');
    try {
      await navigator.clipboard.writeText(resolvedText);
      showCopiedButtonFeedback(button, originalChildNodes);
      return true;
    } catch (error) {
      window.prompt(promptMessage, resolvedText);
      return false;
    }
  }

  function copyTextWithButtonFeedback(text, button, promptMessage) {
    return copyResolvedTextWithButtonFeedback(text, button, promptMessage, cloneButtonContent(button));
  }

  function resolveCopyText(textPromise) {
    return Promise.resolve().then(function() {
      return typeof textPromise === 'function' ? textPromise() : textPromise;
    }).then(function(text) {
      return String(text || '');
    });
  }

  async function copyTextPromiseWithButtonFeedback(textPromise, button, promptMessage) {
    const originalChildNodes = cloneButtonContent(button);
    const resolvedTextPromise = resolveCopyText(textPromise);

    if (navigator.clipboard && navigator.clipboard.write && window.ClipboardItem) {
      let writePromise;

      try {
        const item = new window.ClipboardItem({
          'text/plain': resolvedTextPromise.then(function(text) {
            return new Blob([text], { type: 'text/plain' });
          })
        });
        writePromise = navigator.clipboard.write([item]);
      } catch (error) {
        return resolvedTextPromise.then(function(text) {
          return copyResolvedTextWithButtonFeedback(text, button, promptMessage, originalChildNodes);
        });
      }

      try {
        await writePromise;
        showCopiedButtonFeedback(button, originalChildNodes);
        return true;
      } catch (error) {
        const text = await resolvedTextPromise;
        window.prompt(promptMessage, text);
        return false;
      }
    }

    return resolvedTextPromise.then(function(text) {
      return copyResolvedTextWithButtonFeedback(text, button, promptMessage, originalChildNodes);
    });
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
    copyTextPromiseWithButtonFeedback: copyTextPromiseWithButtonFeedback,
    bindSoftReserveInput: bindSoftReserveInput
  };
})(window);

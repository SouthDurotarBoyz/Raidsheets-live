(function() {
  'use strict';

  var lightboxState = {
    initialized: false,
    overlay: null,
    image: null,
    caption: null,
    closeButton: null,
    lastTrigger: null
  };

  var fragmentFetchTimeout = 10000;

  function isContainerMissingSheet(container) {
    return !container.innerHTML.trim() || !container.querySelector('.sheet');
  }

  function isContainerFallback(container) {
    return !!container.querySelector('.boss-sheet-load-fallback');
  }

  function shouldRecoverContainer(container) {
    return container.hasAttribute('data-boss-partial') &&
      (isContainerMissingSheet(container) || isContainerFallback(container));
  }

  function loadContainer(container) {
    initBossImageLightbox();

    var loadId = (container.__bossSheetLoadId || 0) + 1;
    container.__bossSheetLoadId = loadId;
    var partial = container.getAttribute('data-boss-partial');
    if (!partial) {
      if (isContainerMissingSheet(container)) renderLoadFallback(container);
      container.__bossSheetLoadPromise = Promise.resolve(container);
      return container.__bossSheetLoadPromise;
    }

    var fetchOptions = { credentials: 'same-origin' };
    var controller = null;
    var timeoutId = null;
    if (typeof window.AbortController === 'function') {
      controller = new window.AbortController();
      fetchOptions.signal = controller.signal;
      timeoutId = window.setTimeout(function() {
        controller.abort();
      }, fragmentFetchTimeout);
    }

    var loadPromise = Promise.resolve().then(function() {
      return fetch(partial, fetchOptions);
    })
      .then(function(response) {
        if (!response.ok) throw new Error('Failed to load boss sheet: ' + partial);
        return response.text();
      })
      .then(function(html) {
        if (container.__bossSheetLoadId !== loadId) return container;
        container.innerHTML = html;
        if (isContainerMissingSheet(container)) {
          throw new Error('Boss sheet fragment was empty: ' + partial);
        }
        prepareZoomableImages(container);
        return container;
      })
      .catch(function(error) {
        if (container.__bossSheetLoadId === loadId) renderLoadFallback(container, error);
        return container;
      })
      .then(function(result) {
        if (timeoutId !== null) window.clearTimeout(timeoutId);
        return result;
      });

    container.__bossSheetLoadPromise = loadPromise;
    return loadPromise;
  }

  function renderLoadFallback(container, error) {
    container.innerHTML =
      '<div class="sheet boss-sheet-load-fallback">' +
        '<div class="boss-header">' +
          '<div class="boss-zone">Raid sheet</div>' +
          '<h1 class="boss-name">Sheet failed to load</h1>' +
        '</div>' +
        '<div class="setup-block">' +
          '<p>This sheet failed to load.</p>' +
          '<button type="button" class="btn">Retry</button>' +
        '</div>' +
      '</div>';

    var retryButton = container.querySelector('.boss-sheet-load-fallback .btn');
    retryButton.addEventListener('click', function() {
      loadContainer(container).then(function() {
        if (container.querySelector('.boss-sheet-load-fallback')) return;
        if (window.RaidRosterBindings && window.RaidRosterBindings.init) {
          window.RaidRosterBindings.init();
        }
      });
    });
  }

  function loadAll() {
    initBossImageLightbox();

    var containers = Array.prototype.slice.call(document.querySelectorAll('[data-boss-sheet-container]'));
    return Promise.all(containers.map(function(container) {
      return Promise.resolve().then(function() {
        return loadContainer(container);
      }).catch(function() {
        return container;
      });
    })).then(function() {
      return containers;
    }, function() {
      return containers;
    });
  }

  window.addEventListener('pageshow', function() {
    var containers = Array.prototype.slice.call(document.querySelectorAll('[data-boss-sheet-container]'));
    var recoveries = containers.filter(shouldRecoverContainer).map(function(container) {
      return Promise.resolve().then(function() {
        return loadContainer(container);
      }).catch(function() {
        return container;
      });
    });

    Promise.all(recoveries).then(function() {
      if (window.RaidRosterBindings && window.RaidRosterBindings.init) {
        window.RaidRosterBindings.init();
      }
    });
  });

  function prepareZoomableImages(root) {
    var scope = root || document;
    var images = Array.prototype.slice.call(scope.querySelectorAll('.sheet img'));

    images.forEach(function(image) {
      if (!isZoomableImage(image)) return;

      if (!image.hasAttribute('tabindex')) image.setAttribute('tabindex', '0');
      if (!image.hasAttribute('role')) image.setAttribute('role', 'button');
      if (!image.hasAttribute('aria-label')) {
        image.setAttribute('aria-label', 'Open larger view of ' + getImageLabel(image));
      }
    });
  }

  function getZoomableImage(target) {
    if (!target || !target.closest) return null;
    if (target.closest('.boss-image-lightbox')) return null;

    var image = target.closest('img');
    if (!image || !isZoomableImage(image)) return null;

    return image;
  }

  function isZoomableImage(image) {
    if (!image || image.closest('.boss-image-lightbox')) return false;
    if (!image.closest('.sheet')) return false;
    if (image.classList.contains('positioning-img')) return true;
    if (image.closest('.mech .icon')) return true;
    if (image.closest('.setup-block')) return true;
    return false;
  }

  function getImageLabel(image) {
    var alt = (image.getAttribute('alt') || '').trim();
    if (alt) return alt;

    var title = (image.getAttribute('title') || '').trim();
    if (title) return title;

    var mech = image.closest('.mech');
    var mechName = mech ? mech.querySelector('.mech-name') : null;
    var mechText = mechName ? mechName.textContent.trim() : '';
    if (mechText) return mechText;

    var setupLine = image.closest('.setup-line');
    var setupText = setupLine ? setupLine.textContent.trim() : '';
    if (setupText) return setupText;

    return image.classList.contains('positioning-img') ? 'boss positioning image' : 'boss sheet image';
  }

  function initBossImageLightbox() {
    if (lightboxState.initialized) return;
    lightboxState.initialized = true;

    document.addEventListener('click', handleLightboxClick);
    document.addEventListener('keydown', handleLightboxKeydown);
    prepareZoomableImages(document);
  }

  function getLightbox() {
    if (lightboxState.overlay) return lightboxState.overlay;

    var overlay = document.createElement('div');
    overlay.className = 'boss-image-lightbox';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('aria-label', 'Enlarged boss sheet image');

    var backdrop = document.createElement('div');
    backdrop.className = 'boss-image-lightbox-backdrop';
    backdrop.setAttribute('data-boss-image-lightbox-close', 'true');

    var panel = document.createElement('div');
    panel.className = 'boss-image-lightbox-panel';

    var closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'boss-image-lightbox-close';
    closeButton.setAttribute('aria-label', 'Close enlarged image');
    closeButton.setAttribute('data-boss-image-lightbox-close', 'true');
    closeButton.textContent = '×';

    var image = document.createElement('img');
    image.className = 'boss-image-lightbox-img';
    image.alt = '';

    var caption = document.createElement('div');
    caption.className = 'boss-image-lightbox-caption';

    panel.appendChild(image);
    panel.appendChild(caption);
    overlay.appendChild(backdrop);
    overlay.appendChild(panel);
    overlay.appendChild(closeButton);
    document.body.appendChild(overlay);

    lightboxState.overlay = overlay;
    lightboxState.image = image;
    lightboxState.caption = caption;
    lightboxState.closeButton = closeButton;

    return overlay;
  }

  function handleLightboxClick(event) {
    var closeTarget = event.target.closest('[data-boss-image-lightbox-close]');
    if (closeTarget) {
      closeLightbox();
      return;
    }

    var image = getZoomableImage(event.target);
    if (!image) return;

    event.preventDefault();
    openLightbox(image);
  }

  function handleLightboxKeydown(event) {
    if (event.key === 'Escape') {
      closeLightbox();
      return;
    }

    if (event.key !== 'Enter' && event.key !== ' ') return;

    var image = getZoomableImage(event.target);
    if (!image) return;

    event.preventDefault();
    openLightbox(image);
  }

  function openLightbox(triggerImage) {
    var overlay = getLightbox();
    var src = triggerImage.currentSrc || triggerImage.src || triggerImage.getAttribute('src');
    var alt = triggerImage.getAttribute('alt') || '';
    var captionText = getLightboxCaption(triggerImage);

    if (!src) return;

    lightboxState.lastTrigger = triggerImage;
    lightboxState.image.src = src;
    lightboxState.image.alt = alt || captionText || 'Expanded boss sheet image';
    lightboxState.image.classList.toggle('is-icon', isIconImage(triggerImage));
    lightboxState.caption.textContent = captionText;
    lightboxState.caption.hidden = !captionText;

    document.body.classList.add('boss-image-lightbox-open');
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    lightboxState.closeButton.focus();
  }

  function getLightboxCaption(image) {
    var imageCard = image.closest('.image-card');
    var captionSource = imageCard ? imageCard.querySelector('.image-card-caption') : null;
    var captionText = captionSource ? captionSource.textContent.trim() : '';
    if (captionText) return captionText;

    var mech = image.closest('.mech');
    if (mech) {
      var mechName = mech.querySelector('.mech-name');
      var mechDesc = mech.querySelector('.mech-desc');
      var parts = [];

      if (mechName && mechName.textContent.trim()) parts.push(mechName.textContent.trim());
      if (mechDesc && mechDesc.textContent.trim()) parts.push(mechDesc.textContent.trim());

      captionText = parts.join(' — ');
      if (captionText.length > 220) captionText = captionText.slice(0, 217).trim() + '…';
      if (captionText) return captionText;
    }

    return (image.getAttribute('alt') || image.getAttribute('title') || '').trim();
  }

  function isIconImage(image) {
    if (image.classList.contains('positioning-img')) return false;

    var naturalWidth = image.naturalWidth || 0;
    var naturalHeight = image.naturalHeight || 0;
    var renderedWidth = image.width || image.clientWidth || 0;
    var renderedHeight = image.height || image.clientHeight || 0;
    var hasSmallNaturalSize = naturalWidth > 0 && naturalHeight > 0 && naturalWidth <= 128 && naturalHeight <= 128;
    var hasSmallRenderedSize = renderedWidth > 0 && renderedHeight > 0 && renderedWidth <= 128 && renderedHeight <= 128;

    return hasSmallNaturalSize || hasSmallRenderedSize;
  }

  function closeLightbox() {
    var overlay = lightboxState.overlay;
    if (!overlay || !overlay.classList.contains('is-open')) return;

    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('boss-image-lightbox-open');

    if (lightboxState.lastTrigger && document.contains(lightboxState.lastTrigger)) {
      lightboxState.lastTrigger.focus();
    }

    lightboxState.lastTrigger = null;
  }

  window.BossSheetLoader = {
    loadAll: loadAll,
    loadContainer: loadContainer
  };
})();

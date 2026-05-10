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

  function loadContainer(container) {
    initBossImageLightbox();

    var partial = container.getAttribute('data-boss-partial');
    if (!partial) return Promise.resolve(container);

    return fetch(partial, { credentials: 'same-origin' })
      .then(function(response) {
        if (!response.ok) throw new Error('Failed to load boss sheet: ' + partial);
        return response.text();
      })
      .then(function(html) {
        container.innerHTML = html;
        prepareZoomableImages(container);
        return container;
      });
  }

  function loadAll() {
    initBossImageLightbox();

    var containers = Array.prototype.slice.call(document.querySelectorAll('[data-boss-sheet-container]'));
    return Promise.all(containers.map(loadContainer));
  }

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

// ── ELEMENT REFS ──────────────────────────────────────────
const navContainerEl        = document.getElementById('navContainer');
const navEl                 = document.getElementById('navEl');
const navTiles              = document.querySelectorAll('.nav-wrapper:first-child .nav-tile');
const navTileGridlines      = document.querySelectorAll('.nav-tile.nav-tile-gridlines');
const navButton             = document.getElementById('nav-button');
const navButtonGridline     = document.getElementById('navButtonGridline');
const navButtonTitle1       = document.querySelector('.nav-button-title-1');
const navButtonTitle2       = document.querySelector('.nav-button-title-2');
const horizontalTileLines   = document.querySelectorAll('.nav-tile.nav-tile-gridlines .tile-line.nav-t, .nav-tile.nav-tile-gridlines .tile-line.nav-b');
const verticalTileLines     = document.querySelectorAll('.nav-tile.nav-tile-gridlines .tile-line.nav-l, .nav-tile.nav-tile-gridlines .tile-line.nav-r');
const navWrapperGridlines   = document.querySelector('.nav-wrapper-gridlines');
const outroPage             = document.getElementById('outroPage');
const partnerInfoButton     = document.getElementById('partnerInfoButton');
const scrollChevronsEl      = document.getElementById('scrollChevrons');
const scrollChevronsContainer = document.getElementById('scrollChevronsContainer');
const navLinks              = document.querySelectorAll('.nav-wrapper:first-child .nav-tile > a');
const homeLogoPath          = document.querySelector('.home-logo path'); // used for dasharray init
const homeLogoPaths         = document.querySelectorAll('.home-logo path');
const homeLogoContainer     = document.querySelector('.home-logo-container');
const lightboxEl            = document.getElementById('lightbox');
const lightboxCardEl        = document.getElementById('lightboxCard');

// ── STATE ─────────────────────────────────────────────────
let firstNavButtonBreakpoint, secondNavButtonBreakpoint;
let baseWindowSize;
const initialScale = 2;
let scrollTimeout;
let currentMenuTileState;
let transitionTimeout;
let shouldSmoothlyTransitionToState3 = false;
let scrollingFromState1 = true;
let alreadyAnimatedIn = false;
let textAnimationStarted = false;
let logoAtCorner = false;
let cardRevealed = false; // becomes true once the neutral background + shadow fade in at corner-move

// Main-tile (nav button) intro colors
const CARD_BG     = '#F5F3EE';                          // neutral background revealed at corner-move
const CARD_SHADOW = '0 10px 24px rgba(26, 22, 18, 0.20), 0 2px 5px rgba(26, 22, 18, 0.16)'; // matches the grid plane's drop-shadow

// Tile scatter/assemble directions (desktop & mobile)
const desktopTransformations = [
  [ 4,  2],  // Strategy (tile-1)
  [-0.1, 1], // Voice & Tone (tile-2)
  [-1, -0.1],// Logo (tile-3)
  [-4,  2],  // Typography (tile-4)
  [ 4, -2],  // Iconography (tile-5)
  [ 1,  0.1],// Color (tile-6)
  [ 0.1,-1], // Imagery (tile-7)
  [-4, -2],  // Motion (tile-8)
];

const mobileTransformations = [
  [ 2,  3],
  [-2,  3],
  [ 0.25, 1.5],
  [-1.5, 0.25],
  [ 1.5,-0.25],
  [-0.25,-1.5],
  [ 2, -3],
  [-2, -3],
];

// ── EASING ────────────────────────────────────────────────
function calcBezier(t, a1, a2) {
  return (((1 - 3*a2 + 3*a1)*t + (3*a2 - 6*a1))*t + 3*a1)*t;
}
function binarySubdivide(x, lo, hi, mX1, mX2) {
  let cur, t, i = 0;
  do {
    t = lo + (hi - lo) / 2;
    cur = calcBezier(t, mX1, mX2) - x;
    if (cur > 0) hi = t; else lo = t;
  } while (Math.abs(cur) > 1e-7 && ++i < 12);
  return t;
}
function cubicBezier(mX1, mY1, mX2, mY2) {
  if (mX1 === mY1 && mX2 === mY2) return t => t;
  const getTForX = aX => binarySubdivide(aX, 0, 1, mX1, mX2);
  return t => (t === 0 || t === 1) ? t : calcBezier(getTForX(t), mY1, mY2);
}
const easeFunction = cubicBezier(1, 0.25, 0.85, 1);

// ── LOAD-IN ANIMATION ─────────────────────────────────────
function prepareLogoPathForLoadIn() {
  // Set dasharray on all logo paths so each one animates independently
  homeLogoPaths.forEach(p => {
    p.style.strokeDasharray = '6000';
    p.style.strokeDashoffset = '6000';
  });
}

function animateInHome() {
  if (alreadyAnimatedIn) return;
  alreadyAnimatedIn = true;

  navContainerEl.classList.add('animating-in');

  // ── Main tile: start with no background (the SVG .card-outline strokes the perimeter) ──
  navButton.style.background = 'transparent';
  navButton.style.boxShadow = 'none';

  // Build the outline path in pixel-space from the card's measured size + border-radius
  // so the stroke traces the card's true edge. Dash = its perimeter → one continuous line.
  const cardOutline = document.querySelector('.card-outline');
  const cardOutlinePath = cardOutline && cardOutline.querySelector('path');
  if (cardOutlinePath) {
    const rect = navButton.getBoundingClientRect();
    const sw = 1.5;                          // stroke width
    const inset = sw / 2;                     // keep the stroke inside the card edge
    const radius = parseFloat(getComputedStyle(navButton).borderTopLeftRadius) || 20;
    const r = Math.max(0, radius - inset);
    const x0 = inset, y0 = inset;
    const x1 = rect.width - inset, y1 = rect.height - inset;
    const d =
      `M${x0 + r},${y0} H${x1 - r} A${r},${r} 0 0 1 ${x1},${y0 + r}` +
      ` V${y1 - r} A${r},${r} 0 0 1 ${x1 - r},${y1}` +
      ` H${x0 + r} A${r},${r} 0 0 1 ${x0},${y1 - r}` +
      ` V${y0 + r} A${r},${r} 0 0 1 ${x0 + r},${y0} Z`;
    cardOutlinePath.setAttribute('d', d);
    const len = cardOutlinePath.getTotalLength();
    cardOutlinePath.style.strokeDasharray = String(len);
    cardOutlinePath.style.strokeDashoffset = String(len);
  }

  // Extend gridlines from menu center outward
  const menuGridlinesV = document.querySelectorAll('.menu .tile-line.nav-l, .menu .tile-line.nav-r');
  const menuGridlinesH = document.querySelectorAll('.menu .tile-line.nav-t, .menu .tile-line.nav-b');

  menuGridlinesV.forEach(line => {
    line.style.transition = 'transform 3s cubic-bezier(.5,0,0,1), background-color 1.5s ease-in-out 0.75s';
    line.style.transform = 'translate(0, -50%)';
    line.style.backgroundColor = 'var(--color--accent--line-solid)';
  });
  menuGridlinesH.forEach(line => {
    line.style.transition = 'transform 3s cubic-bezier(.5,0,0,1), background-color 1.5s ease-in-out 0.75s';
    line.style.transform = 'translate(50%, 0)';
    line.style.backgroundColor = 'var(--color--accent--line-solid)';
  });

  // Fade in additional gridlines
  verticalTileLines.forEach(line => {
    line.style.transition = 'opacity 1.5s ease-in-out 1.25s';
    line.style.transform = 'translate(0, -50%)';
    line.style.opacity = '1';
  });
  horizontalTileLines.forEach(line => {
    line.style.transition = 'opacity 1.5s ease-in-out 1.25s';
    line.style.transform = 'translate(50%, 0)';
    line.style.opacity = '1';
  });

  navContainerEl.classList.add('final');

  // ── Phase 2: Logo moves to bottom-left corner after draw-in ──
  setTimeout(() => {
    navContainerEl.classList.add('logo-to-corner');
    // Fade the neutral background + small shadow in (the .card-outline fades out via CSS)
    navButton.style.transition =
      'background-color 0.6s ease-in-out, box-shadow 0.6s ease-in-out';
    navButton.style.background = CARD_BG;
    navButton.style.boxShadow = CARD_SHADOW;
    cardRevealed = true;
  }, 1400);

  // Remove logo transition so it doesn't animate during scroll, then hand off to scroll handler
  setTimeout(() => {
    if (homeLogoContainer) homeLogoContainer.style.transition = 'none';
    logoAtCorner = true;
  }, 2850);

  // ── Phase 3: Text fades in as logo is filling in ─────────────
  setTimeout(() => {
    textAnimationStarted = true;
    navButtonTitle1.style.transition = 'opacity 0.6s cubic-bezier(.4,0,.2,1)';
    navButtonTitle1.style.opacity = '1';
    // Clean up transition so scroll handler can override cleanly
    setTimeout(() => { navButtonTitle1.style.transition = ''; }, 1000);
  }, 1100);

  setTimeout(() => { document.body.style.overflow = ''; }, 1800);
  setTimeout(() => { navContainerEl.classList.remove('animating-in'); }, 3000);
}

// ── SCROLL HANDLER ────────────────────────────────────────
function handleIntroResize(animated = false) {
  if (document.documentElement.scrollHeight - window.innerHeight - window.scrollY <= 200) {
    window.scrollTo(0, document.documentElement.scrollHeight);
  }
  baseWindowSize = Math.max(window.innerWidth, window.innerHeight);
  secondNavButtonBreakpoint = 0.05 + baseWindowSize / 5000;
  firstNavButtonBreakpoint  = 0;
  handleIntroScroll(animated);
}

function handleIntroScroll(animated = true) {
  if (!handleIntroScroll.throttled) {
    handleIntroScroll.throttled = true;
    requestAnimationFrame(() => {
      introScrollHandler(animated);
      handleIntroScroll.throttled = false;
    });
  }
}

function introScrollHandler(animated = true) {
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 200) {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
  }, 250);

  const scrollProgress = Math.min(
    (window.scrollY || window.pageYOffset) / (document.body.offsetHeight - window.innerHeight),
    1
  );
  const eased = easeFunction(scrollProgress);
  const scale = initialScale - (initialScale - 1) * eased;
  const fwd = eased - 1;
  const bwd = 1 - eased;
  const highestTileYeet = (baseWindowSize - 90) / 2 / initialScale;

  const transforms = window.innerWidth <= 991 ? mobileTransformations : desktopTransformations;

  for (let i = 0; i < transforms.length; i++) {
    const [x, y] = transforms[i];
    const xT = (x > 0 ? fwd : bwd) * Math.abs(x * highestTileYeet);
    const yT = (y > 0 ? fwd : bwd) * Math.abs(y * highestTileYeet);
    const transform = `scale(${scale}) translate(${xT}px, ${yT}px)`;
    if (navTiles[i])          navTiles[i].style.transform = transform;
    if (navTileGridlines[i])  navTileGridlines[i].style.transform = transform;
  }

  // Grow logo from corner size (16%) to full button fill (100%) in the second half of scroll
  if (logoAtCorner) {
    const logoProgress = Math.max(0, (eased - 0.5) / 0.5); // 0 until eased=0.5, then 0→1
    const logoSize   = 16 + 84 * logoProgress;    // 16% → 100%
    const logoOffset = 16 * (1 - logoProgress);   // 16px → 0px
    homeLogoContainer.style.width  = `${logoSize}%`;
    homeLogoContainer.style.height = `${logoSize}%`;
    homeLogoContainer.style.left   = `${logoOffset}px`;
    homeLogoContainer.style.bottom = `${logoOffset}px`;
  }

  // Compensate gridlines for scale
  horizontalTileLines.forEach(line => {
    line.style.transform = `translateX(50%) scaleY(${1 / scale})`;
  });
  verticalTileLines.forEach(line => {
    line.style.transform = `translateY(-50%) scaleX(${1 / scale})`;
  });

  // Button title transitions
  if (animated) {
    navButtonTitle1.style.transition = 'opacity 0.2s cubic-bezier(.2,.5,.5,1) 0.1s';
    navButtonTitle2.style.transition = 'opacity 0.2s cubic-bezier(.2,.5,.5,1) 0.1s';
  } else {
    navButtonTitle1.style.transition = 'initial';
    navButtonTitle2.style.transition = 'initial';
  }

  // ── State 1: Big button ──────────────────────────────────
  if (eased <= firstNavButtonBreakpoint) {
    if (animated) {
      navButton.style.transition      = '0.6s cubic-bezier(.5,0,.2,1)';
      navButtonGridline.style.transition = '0.6s cubic-bezier(.5,0,.2,1)';
    } else {
      navButton.style.transition      = 'initial';
      navButtonGridline.style.transition = 'initial';
    }

    if (currentMenuTileState !== 1) {
      currentMenuTileState = 1;
      scrollingFromState1  = true;
      navButton.style.color = '#1A1612';
      // Background + shadow only after the intro reveals them at corner-move
      if (cardRevealed) {
        navButton.style.background = CARD_BG;
        navButton.style.boxShadow = CARD_SHADOW;
      }
      // Only show title-1 after the initial text animation has started
      if (textAnimationStarted) navButtonTitle1.style.opacity = '1';
      navButtonTitle2.style.opacity = '0';
    }

    const size = 'min(800px, calc(min(100vw, 100vh) - 64px))';
    navButton.style.width          = `calc(${size} - 2px)`;
    navButton.style.height         = `calc(${size} - 2px)`;
    navButtonGridline.style.width  = size;
    navButtonGridline.style.height = size;
    navButtonTitle1.style.transform = 'scale(1)';
    navButtonTitle2.style.transform = 'scale(1)';

  // ── State 2: Medium button ───────────────────────────────
  } else if (eased < secondNavButtonBreakpoint) {
    if (animated && scrollingFromState1) {
      navButton.style.transition      = '0.6s cubic-bezier(.5,0,.2,1)';
      navButtonGridline.style.transition = '0.6s cubic-bezier(.5,0,.2,1)';
      scrollChevronsEl.style.transition = '0.6s cubic-bezier(.5,0,.2,1)';
    } else {
      navButton.style.transition      = 'initial';
      navButtonGridline.style.transition = 'initial';
    }

    // Always enforce color/background in state 2 — amber button, ink text
    navButton.style.color = '#1A1612';
    navButton.style.backgroundColor = '#FF9500';

    if (currentMenuTileState !== 2) {
      currentMenuTileState = 2;
      shouldSmoothlyTransitionToState3 = true;
      clearTimeout(transitionTimeout);
      transitionTimeout = setTimeout(() => { shouldSmoothlyTransitionToState3 = false; }, 650);
      navButton.style.boxShadow = CARD_SHADOW; // shadow carries through the amber state
      navButtonTitle1.style.opacity = '0';
      navButtonTitle2.style.opacity = '1';
      scrollChevronsEl.style.opacity = '0';
    }

    const size = 'min(500px, calc(min(100vw, 100vh) - 64px))';
    navButton.style.width          = size;
    navButton.style.height         = size;
    navButtonGridline.style.width  = size;
    navButtonGridline.style.height = size;
    navButtonTitle1.style.transform = 'scale(1)';
    navButtonTitle2.style.transform = 'scale(1)';

  // ── State 3: Small button ────────────────────────────────
  } else {
    const shrinkP = (eased - secondNavButtonBreakpoint) / (1 - secondNavButtonBreakpoint);

    if (animated && shouldSmoothlyTransitionToState3 && eased < secondNavButtonBreakpoint + 0.1) {
      navButton.style.transition      = '0.3s cubic-bezier(0,.8,.4,1)';
      navButtonGridline.style.transition = '0.3s cubic-bezier(0,.8,.4,1)';
    } else {
      navButton.style.transition      = 'initial';
      navButtonGridline.style.transition = 'initial';
    }

    // Compute the shrink numerically. (A CSS calc of the form
    // `number * calc(min(...))` is mis-evaluated to 0 by some engines, which
    // collapsed the button to ~0px at the end of the scroll.)
    const buttonSizePx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--button-size')) || 90;
    const baseSizePx = Math.min(500, Math.min(window.innerWidth, window.innerHeight) - 64);
    const sizePx = baseSizePx - shrinkP * (baseSizePx - buttonSizePx);
    const size = `${sizePx}px`;
    navButton.style.width          = size;
    navButton.style.height         = size;
    navButtonGridline.style.width  = size;
    navButtonGridline.style.height = size;

    // Always enforce color/background in state 3 — amber button, ink text
    navButton.style.color = '#1A1612';
    navButton.style.backgroundColor = '#FF9500';

    if (currentMenuTileState !== 3) {
      currentMenuTileState = 3;
      scrollingFromState1 = false;
      navButton.style.border = '1px solid transparent';
      navButton.style.boxShadow = CARD_SHADOW; // keep the shadow in the final state
      navButtonTitle1.style.opacity = '0';
      navButtonTitle2.style.opacity = '0';
    }

    navButtonTitle1.style.transform = `scale(${1 - shrinkP * 0.9})`;
    navButtonTitle2.style.transform = `scale(${1 - shrinkP * 0.9})`;
    navWrapperGridlines.style.transition = 'initial';

    // Reveal outro & enable tile interaction near end
    if (eased > 0.95) {
      const opacityP = (eased - 0.95) / 0.05;
      navWrapperGridlines.style.opacity = String(0.4 - opacityP * 0.4);
      navTiles.forEach(t => { t.style.pointerEvents = 'auto'; });
      navEl.removeAttribute('inert');
      partnerInfoButton.style.opacity = String(Math.min(opacityP * 2, 1));
      outroPage.style.opacity = String(Math.min(opacityP * 2, 1));
      outroPage.style.pointerEvents = 'auto';
    } else {
      navWrapperGridlines.style.opacity = '0.4';
      navTiles.forEach(t => { t.style.pointerEvents = 'none'; });
      navEl.setAttribute('inert', '');
      partnerInfoButton.style.opacity = '0';
      outroPage.style.opacity = '0';
      outroPage.style.pointerEvents = 'none';
    }
  }
}

// ── TILE INTERACTIONS: open-page button + lightbox ────────
function openProject(url) {
  window.open(url, '_blank', 'noopener');
}

// Per-project copy shown in the lightbox bottom-left pocket
const PROJECT_COPY = {
  pieminder: {
    title: 'Home pizza dough made easy',
    body: 'Built for home pizza makers who want to enjoy the process. Real-time ingredient math, a step-by-step walkthrough, timers that live in your Dynamic Island, and best of all <b>no ads or premium plans</b>.'
  }
};

const LB_EASE_OPEN  = 'cubic-bezier(.2,.8,.2,1)';
const LB_EASE_CLOSE = 'cubic-bezier(.4,0,.2,1)';
const LB_DUR = 450;
let lightboxTile = null;     // the originating tile (hidden while open)
let lightboxAnimating = false;

// Centered target rect for the expanded card. Mobile: a tall 80dvh sheet
// (drops the aspect ratio to show more image + give the copy room to breathe).
// Desktop: landscape aspect, capped to fit the viewport.
function lightboxTargetRect() {
  const vw = window.innerWidth, vh = window.innerHeight;
  if (vw <= 744) {
    const w = vw * 0.92;
    const h = vh * 0.8;                 // 80dvh
    return { left: (vw - w) / 2, top: (vh - h) / 2, width: w, height: h };
  }
  let w = Math.min(720, vw * 0.92);
  let h = w * (322 / 508);
  const maxH = vh * 0.9;
  if (h > maxH) { h = maxH; w = h * (508 / 322); }
  if (w > vw * 0.92) { w = vw * 0.92; h = w * (322 / 508); }
  return { left: (vw - w) / 2, top: (vh - h) / 2, width: w, height: h };
}

function placeCard(r, withTransition, ease) {
  lightboxCardEl.style.transition = withTransition
    ? `left ${LB_DUR}ms ${ease}, top ${LB_DUR}ms ${ease}, width ${LB_DUR}ms ${ease}, height ${LB_DUR}ms ${ease}`
    : 'none';
  lightboxCardEl.style.left = r.left + 'px';
  lightboxCardEl.style.top = r.top + 'px';
  lightboxCardEl.style.width = r.width + 'px';
  lightboxCardEl.style.height = r.height + 'px';
}

// Add the lightbox-only corners (close ✕ top-right, copy bottom-left) to a clone
function injectLightboxExtras(clone) {
  const media = clone.querySelector('.pmcard__media');
  if (!media) return;

  const tr = document.createElement('div');
  tr.className = 'pmcard__cluster pmcard__cluster--tr';
  tr.innerHTML =
    '<div class="pmcard__pocket"><span class="pmcard__pill pmcard__btn" role="button" tabindex="0" data-close aria-label="Close preview">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
    '</span></div>';
  media.appendChild(tr);

  const key = [...clone.classList].find(c => PROJECT_COPY[c]);
  const copy = key && PROJECT_COPY[key];
  if (copy) {
    const bl = document.createElement('div');
    bl.className = 'pmcard__cluster pmcard__cluster--bl';
    bl.innerHTML =
      '<div class="pmcard__pocket pmcard__pocket--copy"><div class="pmcard__copy">' +
      `<p class="pmcard__copy-title">${copy.title}</p>` +
      `<p class="pmcard__copy-body">${copy.body}</p>` +
      '</div></div>';
    media.appendChild(bl);
  }
}

function openLightbox(tile) {
  if (lightboxAnimating || lightboxTile) return;
  lightboxAnimating = true;
  lightboxTile = tile;

  // Measure from the untilted tile so the morph starts from its true rect
  tile.style.transform = 'none';
  const start = tile.getBoundingClientRect();

  // Build the enlarged clone
  const clone = tile.cloneNode(true);
  clone.removeAttribute('href');
  clone.classList.remove('disabled');
  clone.style.transform = '';
  clone.style.transition = 'none';
  injectLightboxExtras(clone);
  lightboxCardEl.replaceChildren(clone);
  lightboxCardEl.classList.remove('is-expanded');

  // Start at the tile's exact rect, then expand to centered target
  placeCard(start, false);
  lightboxEl.classList.add('open');
  lightboxEl.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  tile.style.visibility = 'hidden';

  const end = lightboxTargetRect();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    placeCard(end, true, LB_EASE_OPEN);
    lightboxCardEl.classList.add('is-expanded');
    setTimeout(() => { lightboxAnimating = false; }, LB_DUR);
  }));
}

function closeLightbox() {
  if (!lightboxTile || lightboxAnimating) return;
  lightboxAnimating = true;
  const tile = lightboxTile;

  lightboxCardEl.classList.remove('is-expanded'); // fade the extra corners out
  lightboxEl.classList.remove('open');            // fade the backdrop out
  placeCard(tile.getBoundingClientRect(), true, LB_EASE_CLOSE); // morph back to the tile

  setTimeout(() => {
    lightboxEl.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    tile.style.visibility = '';
    tile.style.transform = '';
    lightboxCardEl.replaceChildren();
    lightboxCardEl.removeAttribute('style');
    lightboxTile = null;
    lightboxAnimating = false;
  }, LB_DUR);
}

// Keep an open lightbox centered if the viewport changes
window.addEventListener('resize', () => {
  if (lightboxTile && !lightboxAnimating) placeCard(lightboxTargetRect(), false);
});

// Delegated clicks: the orange "open page" button wins; otherwise the tile
// opens its lightbox. Disabled tiles are pointer-events:none, so never match.
document.addEventListener('click', e => {
  const opener = e.target.closest('[data-open]');
  if (opener) {
    e.preventDefault();
    e.stopPropagation();
    openProject(opener.dataset.open);
    return;
  }
  if (e.target.closest('[data-close]')) {
    closeLightbox();
    return;
  }
  const tile = e.target.closest('.nav-wrapper:first-child .tile:not(.disabled)');
  if (tile) {
    e.preventDefault();
    openLightbox(tile);
  }
});

// Keyboard: activate the open-page button (role="button") with Enter/Space
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && lightboxEl.classList.contains('open')) {
    closeLightbox();
    return;
  }
  const active = document.activeElement;
  if ((e.key === 'Enter' || e.key === ' ') && active) {
    if (active.hasAttribute('data-open')) {
      e.preventDefault();
      openProject(active.dataset.open);
    } else if (active.hasAttribute('data-close')) {
      e.preventDefault();
      closeLightbox();
    }
  }
});

// ── TILE TILT (enabled/real-app tiles) ───────────────────
function initTileTilt() {
  // Pointer/hover devices only — skip touch
  if (!window.matchMedia('(hover: hover)').matches) return;

  const MAX_TILT = 3.5;   // max rotation in degrees
  const enabledTiles = document.querySelectorAll('.nav-wrapper:first-child .tile:not(.disabled)');

  enabledTiles.forEach(tile => {
    tile.addEventListener('mousemove', e => {
      const rect = tile.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;   // 0 → 1 (left → right)
      const py = (e.clientY - rect.top)  / rect.height;  // 0 → 1 (top → bottom)
      const rotateY = (px - 0.5) * 2 * MAX_TILT;
      const rotateX = -(py - 0.5) * 2 * MAX_TILT;
      // Track the cursor instantly; only the shadow eases
      tile.style.transition = 'box-shadow 0.35s cubic-bezier(0.16,1,0.3,1)';
      tile.style.transform =
        `perspective(900px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
    });

    tile.addEventListener('mouseleave', () => {
      // Smoothly settle back to flat
      tile.style.transition =
        'transform 0.5s cubic-bezier(0.16,1,0.3,1), box-shadow 0.35s cubic-bezier(0.16,1,0.3,1)';
      tile.style.transform = '';
    });
  });
}

// ── SCROLL CHEVRONS ───────────────────────────────────────
function pulseScrollChevrons() {
  document.querySelectorAll('.scroll-chevron').forEach((chevron, i) => {
    setTimeout(() => {
      chevron.classList.add('activated');
      setTimeout(() => chevron.classList.remove('activated'), 800);
    }, i * 75);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  scrollChevronsEl.style.display = 'block';
  setTimeout(() => { scrollChevronsContainer.classList.add('visible'); }, 2500);
  setTimeout(() => {
    pulseScrollChevrons();
    setInterval(pulseScrollChevrons, 2500);
  }, 3000);
});

// ── INIT ──────────────────────────────────────────────────
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

document.body.style.overflow = 'hidden';
window.scrollTo(0, 0);
outroPage.setAttribute('inert', '');
partnerInfoButton.setAttribute('inert', '');
navEl.setAttribute('inert', '');

prepareLogoPathForLoadIn();
initTileTilt();

document.addEventListener('DOMContentLoaded', animateInHome);

handleIntroResize(false);
window.addEventListener('load', () => handleIntroResize(false));
window.addEventListener('resize', () => handleIntroResize(false));
window.addEventListener('scroll', () => handleIntroScroll(true), { passive: true });

// Force GPU layer
navEl.style.transform = 'translateX(0px)';

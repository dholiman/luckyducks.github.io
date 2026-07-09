/* ============================================================
   PieMinder Pro — app.js
   All percentages are baker's percentages (relative to flour)
   ============================================================ */

'use strict';

// ── Formula Constants ─────────────────────────────────────────
const BASE_PIZZA_SIZE = 16;
const BASE_QUANTITY   = 6;
const BASE_THICKNESS  = 2.11;  // Regular

// Calibrated base flour (regular): gives ~480g/ball at 6×16" regular
const BASE_FLOUR_REGULAR = 1509.797685 * (480 / 425);
// Calibrated base flour (gluten-free)
const BASE_FLOUR_GF      = 333 * 6;

// Numeric thickness values for each discrete option
const THICKNESS_VALUES = {
  thin:    1.8,
  regular: 2.11,
  thick:   2.75,
};

// Baker's percentages (water is now dynamic via slider)
const YEAST_PCT    = 0.004;
const SALT_PCT     = 0.025;
const SUGAR_PCT    = 0.02;   // 2%
const OIL_PCT      = 0.033;

// ── Quantity Limits (declared early for use in loadState) ─────
const QTY_MIN = 1;
const QTY_MAX = 12;

// ── State ─────────────────────────────────────────────────────
const state = {
  glutenFree:  false,
  quantity:    4,
  size:        12,    // inches
  thickness:   'regular',
  hydration:   65,    // regular: 60–70%, default 65
  gfHydration: 75,    // default 75
};

// ── Persistence ───────────────────────────────────────────────
const STORAGE_KEY = 'pieminderState';

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      quantity:    state.quantity,
      size:        state.size,
      thickness:   state.thickness,
      glutenFree:  state.glutenFree,
      hydration:   state.hydration,
      gfHydration: state.gfHydration,
      wtStep:      wtIsOpen ? wtStep : null,
      timer:       activeTimer ? {
        stepIndex: activeTimer.stepIndex,
        endTime:   activeTimer.endTime,
        label:     activeTimer.label,
      } : null,
    }));
  } catch (e) { /* storage unavailable */ }
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return null;
    if (saved.quantity    != null) state.quantity    = Math.min(Math.max(Number(saved.quantity), QTY_MIN), QTY_MAX);
    if (saved.size        != null) state.size        = Number(saved.size);
    if (saved.thickness   != null) state.thickness   = saved.thickness;
    if (saved.glutenFree  != null) state.glutenFree  = Boolean(saved.glutenFree);
    if (saved.hydration   != null) state.hydration   = Number(saved.hydration);
    if (saved.gfHydration != null) state.gfHydration = Number(saved.gfHydration);

    // Restore an in-flight timer if it hasn't expired yet. Expired timers
    // are dropped silently — browser autoplay policies block firing a chime
    // before the user interacts, so we can't honor a "completed while you
    // were gone" cue without a real user gesture.
    if (saved.timer && Number(saved.timer.endTime) > Date.now()) {
      activeTimer = {
        stepIndex: Number(saved.timer.stepIndex),
        endTime:   Number(saved.timer.endTime),
        label:     String(saved.timer.label || ''),
      };
      timerIntervalId = setInterval(tickTimer, 250);
    }

    return (saved.wtStep != null) ? Number(saved.wtStep) : null;
  } catch (e) {
    return null;
  }
}

// ── DOM References ─────────────────────────────────────────────
const els = {
  // Controls
  gfToggle:    document.getElementById('gf-toggle'),
  qtyDec:      document.getElementById('qty-dec'),
  qtyInc:      document.getElementById('qty-inc'),
  qtyDisplay:  document.getElementById('qty-display'),
  sizeSlider:       document.getElementById('size-slider'),
  sizeOutput:       document.getElementById('size-output'),
  sizeFill:         document.getElementById('size-fill'),
  sizeThumb:        document.getElementById('size-thumb'),
  thickGroup:       document.getElementById('thickness-group'),
  segIndicator:     document.getElementById('seg-indicator'),
  hydrationSlider:  document.getElementById('hydration-slider'),
  hydrationOutput:  document.getElementById('hydration-output'),
  hydrationFill:    document.getElementById('hydration-fill'),
  hydrationThumb:   document.getElementById('hydration-thumb'),
  hydrationLabels:  document.getElementById('hydration-labels'),

  // Results
  totalG:            document.getElementById('total-g'),
  ballWt:            document.getElementById('ball-weight'),
  largeBatchWarning: document.getElementById('large-batch-warning'),
  flourG:   document.getElementById('flour-g'),
  flourOz:  document.getElementById('flour-oz'),
  waterG:   document.getElementById('water-g'),
  waterOz:  document.getElementById('water-oz'),
  saltG:    document.getElementById('salt-g'),
  saltOz:   document.getElementById('salt-oz'),
  yeastG:   document.getElementById('yeast-g'),
  yeastOz:  document.getElementById('yeast-oz'),
  oilG:     document.getElementById('oil-g'),
  oilOz:    document.getElementById('oil-oz'),
  sugarG:   document.getElementById('sugar-g'),
  sugarOz:  document.getElementById('sugar-oz'),

  // Instruction step values
  svWater: document.getElementById('sv-water'),
  svYeast: document.getElementById('sv-yeast'),
  svFlour: document.getElementById('sv-flour'),
  svOil:   document.getElementById('sv-oil'),
  svSugar: document.getElementById('sv-sugar'),
  svSalt:  document.getElementById('sv-salt'),
  svQty:   document.getElementById('sv-qty'),
  svBall:  document.getElementById('sv-ball'),

  // Walkthrough
  openWalkthrough: document.getElementById('open-walkthrough'),
  walkthrough:     document.getElementById('walkthrough'),
  wtSlide:         document.getElementById('wt-slide'),
  wtClose:         document.getElementById('wt-close'),
  wtBack:          document.getElementById('wt-back'),
  wtNext:          document.getElementById('wt-next'),
  wtTitle:         document.getElementById('wt-title'),
  wtBody:          document.getElementById('wt-body'),
  wtTimer:         document.getElementById('wt-timer'),
  wtIllustration:  document.getElementById('wt-illustration'),
  wtDots:          document.getElementById('wt-dots'),
  wtCount:         document.getElementById('wt-count'),

  // Tip Modal
  openTipModal: document.getElementById('open-tip-modal'),
  tipOverlay:   document.getElementById('tip-overlay'),
  tipClose:     document.getElementById('tip-close'),

  // Share
  shareBtn: document.getElementById('share-btn'),
};

// ── Calculation Engine ─────────────────────────────────────────
function calculate() {
  const { glutenFree, quantity, size, thickness } = state;

  const pizzaThickness = THICKNESS_VALUES[thickness];
  const baseFlour      = glutenFree ? BASE_FLOUR_GF : BASE_FLOUR_REGULAR;
  const waterPct       = (glutenFree ? state.gfHydration : state.hydration) / 100;

  const sizeScale      = Math.pow(size / BASE_PIZZA_SIZE, 2);
  const qtyScale       = quantity / BASE_QUANTITY;
  const thicknessScale = pizzaThickness / BASE_THICKNESS;

  const flour = baseFlour * sizeScale * qtyScale * thicknessScale;
  const water = flour * waterPct;
  const yeast = flour * YEAST_PCT;
  const salt  = flour * SALT_PCT;
  const sugar = flour * SUGAR_PCT;
  const oil   = flour * OIL_PCT;

  const totalDough = roundTen(flour) + roundTen(water) + roundYeast(yeast) + roundWhole(salt) + roundWhole(oil) + roundWhole(sugar);
  const ballWeight = totalDough / quantity;

  return { totalDough, ballWeight, flour, water, yeast, salt, oil, sugar };
}

// ── Formatting Helpers ─────────────────────────────────────────
// Flour & water: nearest 10g
function roundTen(val)   { return Math.round(val / 10) * 10; }
function fmtTen(val)     { return String(roundTen(val)); }

// Salt, oil, sugar: nearest whole gram
function roundWhole(val) { return Math.round(val); }
function fmtWhole(val)   { return String(roundWhole(val)); }

// Yeast: round up if fractional part ≥ 0.3, down if < 0.3
function roundYeast(val) { return Math.floor(val) + (val % 1 >= 0.3 ? 1 : 0); }
function fmtYeast(val)   { return String(roundYeast(val)); }

function toOz(g) {
  return (g * 0.03527).toFixed(1) + ' oz';
}

function formatBallWeight(g) {
  return `${Math.round(g)}g per ball · ${(g * 0.03527).toFixed(1)} oz`;
}

// ── UI Update ──────────────────────────────────────────────────
function updateUI(results) {
  const { totalDough, ballWeight, flour, water, yeast, salt, oil, sugar } = results;

  // Helper: set text and trigger pop animation
  function set(el, text) {
    if (!el) return;
    const prev = el.textContent;
    if (prev === text) return;
    el.textContent = text;
    el.classList.remove('value-updated');
    // Force reflow to restart animation
    void el.offsetWidth;
    el.classList.add('value-updated');
  }

  set(els.totalG,  String(Math.round(totalDough)));
  set(els.ballWt,  formatBallWeight(ballWeight));

  // Large batch warning (> 1600g total)
  els.largeBatchWarning.style.display = totalDough > 1600 ? 'flex' : 'none';

  set(els.flourG,  fmtTen(flour));
  set(els.flourOz, toOz(roundTen(flour)));

  set(els.waterG,  fmtTen(water));
  set(els.waterOz, toOz(roundTen(water)));

  set(els.saltG,   fmtWhole(salt));
  set(els.saltOz,  toOz(roundWhole(salt)));

  set(els.yeastG,  fmtYeast(yeast));
  set(els.yeastOz, toOz(roundYeast(yeast)));

  set(els.oilG,    fmtWhole(oil));
  set(els.oilOz,   toOz(roundWhole(oil)));

  set(els.sugarG,  fmtWhole(sugar));
  set(els.sugarOz, toOz(roundWhole(sugar)));

  // Instruction step values
  if (els.svWater) els.svWater.textContent = `${fmtTen(water)}g`;
  if (els.svYeast) els.svYeast.textContent = `${fmtYeast(yeast)}g`;
  if (els.svFlour) els.svFlour.textContent = `${fmtTen(flour)}g`;
  if (els.svOil)   els.svOil.textContent   = `${fmtWhole(oil)}g`;
  if (els.svSugar) els.svSugar.textContent = `${fmtWhole(sugar)}g`;
  if (els.svSalt)  els.svSalt.textContent  = `${fmtWhole(salt)}g`;
  if (els.svQty)   els.svQty.textContent   = `${state.quantity}`;
  if (els.svBall)  els.svBall.textContent  = `${Math.round(ballWeight)}g`;

  // Re-render walkthrough if open
  if (wtIsOpen) renderStep();
}

function recalculate() {
  const results = calculate();
  updateUI(results);
}

// ── Slider Sync ────────────────────────────────────────────────
function syncSlider() {
  const slider = els.sizeSlider;
  const min    = Number(slider.min);
  const max    = Number(slider.max);
  const val    = Number(slider.value);
  const pct    = (val - min) / (max - min);

  els.sizeFill.style.width  = `${pct * 100}%`;
  els.sizeThumb.style.left  = `${pct * 100}%`;
  els.sizeOutput.textContent = `${val}"`;

  // Update ARIA
  slider.setAttribute('aria-valuenow',  val);
  slider.setAttribute('aria-valuetext', `${val} inches`);
}

// ── Hydration Slider ───────────────────────────────────────────
function syncHydrationSlider() {
  const slider = els.hydrationSlider;
  const min    = Number(slider.min);
  const max    = Number(slider.max);
  const val    = Number(slider.value);
  const pct    = (val - min) / (max - min);

  els.hydrationFill.style.width   = `${pct * 100}%`;
  els.hydrationThumb.style.left   = `${pct * 100}%`;
  els.hydrationOutput.textContent = `${val}%`;

  slider.setAttribute('aria-valuenow',  val);
  slider.setAttribute('aria-valuetext', `${val} percent`);
}

// Updates slider value + recommended label when mode or value changes
function updateHydrationSlider() {
  const slider      = els.hydrationSlider;
  const recommended = state.glutenFree ? 75 : 65;

  slider.value = String(state.glutenFree ? state.gfHydration : state.hydration);

  // Position the middle label so the number sits directly under the thumb.
  // Slider runs 60–80 (range = 20), so: pct = (value − 60) / 20 × 100
  // Regular (65 → 25%): label left-anchored at dot, "(recommended)" trails right.
  // GF     (75 → 75%): label right-anchored at dot, "(recommended)" leads left.
  const recLeft  = (recommended - 60) / 20 * 100; // 65 → 25%, 75 → 75%
  const labels   = Array.from(els.hydrationLabels.querySelectorAll('span'));
  labels[0].textContent = '60%';
  // Mirror-ghost technique: invisible duplicate on the opposite side makes the element
  // symmetric around the number, so translateX(-50%) centers the number on the dot.
  labels[1].style.left      = `${recLeft}%`;
  labels[1].style.transform = 'translateX(-50%)';
  if (state.glutenFree) {
    labels[1].innerHTML =
      `<small class="rec-label">(recommended) </small>` +
      `${recommended}%` +
      `<small class="rec-label" aria-hidden="true" style="visibility:hidden">(recommended) </small>`;
  } else {
    labels[1].innerHTML =
      `<small class="rec-label" aria-hidden="true" style="visibility:hidden"> (recommended)</small>` +
      `${recommended}%` +
      `<small class="rec-label"> (recommended)</small>`;
  }
  labels[2].textContent = '80%';

  syncHydrationSlider();
}

els.hydrationSlider.addEventListener('input', () => {
  const val = Number(els.hydrationSlider.value);
  if (state.glutenFree) {
    state.gfHydration = val;
  } else {
    state.hydration = val;
  }
  syncHydrationSlider();
  recalculate();
  saveState();
});

// ── Gluten Free Toggle ─────────────────────────────────────────
els.gfToggle.addEventListener('click', () => {
  state.glutenFree = !state.glutenFree;
  els.gfToggle.setAttribute('aria-checked', String(state.glutenFree));
  updateHydrationSlider(); // swap range + labels for GF / regular
  recalculate();
  saveState();
});

els.gfToggle.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    els.gfToggle.click();
  }
});

// ── Quantity Stepper ──────────────────────────────────────────
function updateQtyButtons() {
  els.qtyDec.disabled = state.quantity <= QTY_MIN;
  els.qtyInc.disabled = state.quantity >= QTY_MAX;
  els.qtyDec.setAttribute('aria-disabled', String(state.quantity <= QTY_MIN));
  els.qtyInc.setAttribute('aria-disabled', String(state.quantity >= QTY_MAX));
}

function setQuantity(val) {
  const clamped = Math.min(QTY_MAX, Math.max(QTY_MIN, val));
  if (clamped === state.quantity) return;
  state.quantity = clamped;

  // Bump animation on the value display
  els.qtyDisplay.textContent = String(clamped);
  els.qtyDisplay.classList.remove('bump');
  void els.qtyDisplay.offsetWidth;
  els.qtyDisplay.classList.add('bump');
  setTimeout(() => els.qtyDisplay.classList.remove('bump'), 300);

  updateQtyButtons();
  recalculate();
  saveState();
}

els.qtyDec.addEventListener('click', () => setQuantity(state.quantity - 1));
els.qtyInc.addEventListener('click', () => setQuantity(state.quantity + 1));

// Keyboard: hold down for rapid increment
let holdTimer = null;
let holdInterval = null;

function startHold(direction) {
  holdTimer = setTimeout(() => {
    holdInterval = setInterval(() => setQuantity(state.quantity + direction), 80);
  }, 400);
}

function stopHold() {
  clearTimeout(holdTimer);
  clearInterval(holdInterval);
  holdTimer = null;
  holdInterval = null;
}

[els.qtyDec, els.qtyInc].forEach((btn, i) => {
  const dir = i === 0 ? -1 : 1;
  btn.addEventListener('mousedown',  () => startHold(dir));
  btn.addEventListener('touchstart', () => startHold(dir), { passive: true });
  btn.addEventListener('mouseup',    stopHold);
  btn.addEventListener('mouseleave', stopHold);
  btn.addEventListener('touchend',   stopHold);
});

// ── Pizza Size Slider ──────────────────────────────────────────
els.sizeSlider.addEventListener('input', () => {
  state.size = Number(els.sizeSlider.value);
  syncSlider();
  recalculate();
  saveState();
});

// Arrow-key enhancement (native range already handles this,
// but we sync visual and state explicitly)
els.sizeSlider.addEventListener('keydown', (e) => {
  const step = e.shiftKey ? 2 : 1;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
    e.preventDefault();
    els.sizeSlider.value = Math.max(Number(els.sizeSlider.min), Number(els.sizeSlider.value) - step);
    els.sizeSlider.dispatchEvent(new Event('input'));
  }
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
    e.preventDefault();
    els.sizeSlider.value = Math.min(Number(els.sizeSlider.max), Number(els.sizeSlider.value) + step);
    els.sizeSlider.dispatchEvent(new Event('input'));
  }
});

// ── Thickness Segmented Control ────────────────────────────────
const segBtns = Array.from(els.thickGroup.querySelectorAll('.seg-btn'));

function positionIndicator() {
  const activeBtn = segBtns.find(b => b.dataset.value === state.thickness);
  if (!activeBtn || !els.segIndicator) return;
  els.segIndicator.style.width = `${activeBtn.offsetWidth}px`;
  // offsetLeft includes the 6px container padding; subtract so indicator sits at left:6px origin
  els.segIndicator.style.transform = `translateX(${activeBtn.offsetLeft - 6}px)`;
}

function setThickness(value) {
  if (state.thickness === value) return;
  state.thickness = value;
  segBtns.forEach((btn) => {
    const isActive = btn.dataset.value === value;
    btn.setAttribute('aria-checked', String(isActive));
    btn.classList.toggle('seg-btn--active', isActive);
    btn.tabIndex = isActive ? 0 : -1;
  });
  positionIndicator();
  recalculate();
  saveState();
}

segBtns.forEach(btn => btn.addEventListener('click', () => setThickness(btn.dataset.value)));

els.thickGroup.addEventListener('keydown', (e) => {
  const current = segBtns.findIndex(b => b.dataset.value === state.thickness);
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault();
    const next = segBtns[(current + 1) % segBtns.length];
    setThickness(next.dataset.value);
    next.focus();
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault();
    const next = segBtns[(current - 1 + segBtns.length) % segBtns.length];
    setThickness(next.dataset.value);
    next.focus();
  }
});

// ── Walkthrough ────────────────────────────────────────────────
const WALKTHROUGH_STEPS = [
  {
    img: 'assets/icons/Thermometer.png',
    title: 'Chill Your Water',
    getBody: (r) => `You need <strong>${fmtTen(r.water)}g</strong> of water cooled to below <strong>60°F (15°C)</strong>. Cold water slows yeast activity during mixing so the dough doesn't over-ferment. Use a thermometer if you have one — tap-cold is usually fine.`,
  },
  {
    img: 'assets/icons/Whisk.png',
    title: 'Dissolve the Yeast',
    getBody: (r) => `Pour your cold water into a bowl and sprinkle in <strong>${fmtYeast(r.yeast)}g</strong> of active dry yeast. Stir gently for about 30 seconds until dissolved. No blooming needed — it activates in the cold.`,
  },
  {
    img: 'assets/icons/FlourOil.png',
    title: 'Add Flour & Olive Oil',
    getBody: (r) => `Add <strong>${fmtTen(r.flour)}g</strong> of flour and <strong>${fmtWhole(r.oil)}g</strong> of olive oil to the water-yeast mixture. Mix on low for 2 minutes until a shaggy dough forms. Don't over-mix yet.`,
  },
  {
    img: 'assets/icons/SaltSugar.png',
    title: 'Add Sugar & Salt',
    getBody: (r) => `While still on low, sprinkle in <strong>${fmtWhole(r.sugar)}g</strong> of sugar and <strong>${fmtWhole(r.salt)}g</strong> of salt. Adding salt after the flour prevents it from directly contacting and killing the yeast.`,
  },
  {
    img: 'assets/icons/Mixer.png',
    title: 'Mix Until Smooth',
    getBody: () => `Increase to medium and mix for <strong>10 minutes</strong> until the dough is smooth, elastic, and pulls cleanly away from the sides. It should feel soft but not sticky. This builds the gluten structure.`,
    timers: [{ label: '10 Minute Timer', durationSec: 600 }],
  },
  {
    img: 'assets/icons/Rest.png',
    title: 'Rest the Dough',
    getBody: () => `Cover the bowl tightly with plastic wrap and let the dough rest at room temperature for <strong>1–3 hours</strong>. It will puff slightly. This first rest relaxes the gluten and improves extensibility.`,
    timers: [
      { label: '1 Hour',  durationSec: 3600 },
      { label: '2 Hours', durationSec: 7200 },
      { label: '3 Hours', durationSec: 10800 },
    ],
  },
  {
    img: 'assets/icons/Scale.png',
    title: 'Divide Into Balls',
    getBody: (r) => `Turn the dough onto a clean surface and divide evenly into <strong>${r.qty} pieces</strong>, each about <strong>${Math.round(r.ballWeight)}g</strong>. Use a kitchen scale for accuracy. Shape each piece into a tight ball by pulling the surface taut and pinching the seam underneath.`,
  },
  {
    img: 'assets/icons/Jar.png',
    title: 'Into Oiled Containers',
    getBody: () => `Place each dough ball into a lightly oiled container — a deli container or small bowl works great. Coat the top of each ball with a thin film of oil so it doesn't dry out, then cover tightly with a lid or plastic wrap.
      <div class="bonus-tip bonus-tip--accordion" role="button" tabindex="0" aria-expanded="false" style="margin-top:1rem;">
        <span class="bonus-tip__label"><img src="assets/icons/Lightbulb.png" alt="" class="tip-icon"> Freeze some for later?<span class="bonus-tip__toggle" aria-hidden="true">+</span></span>
        <p class="bonus-tip__text">Instead of a container, lightly oil each ball you want to freeze, wrap tightly in plastic wrap, and place in the freezer. When ready to use, remove the plastic wrap, place in a lightly oiled container, and move to the fridge for <strong>3 days</strong> before baking.</p>
      </div>`,
  },
  {
    img: 'assets/icons/Fridge.png',
    title: 'Cold Ferment',
    getBody: () => `Refrigerate for <strong>1–3 days</strong>. This slow cold ferment is where the magic happens — yeast develops complex flavor and the gluten relaxes for an open, airy crumb. <strong>3 days is the sweet spot.</strong>`,
  },
  {
    img: 'assets/icons/Bake.png',
    title: 'Ready to Bake',
    getBody: () => `Pull the dough out of the fridge and rest at room temperature for <strong>3–4 hours</strong> before baking — cold dough tears instead of stretches.
      <div class="bonus-tip bonus-tip--accordion" role="button" tabindex="0" aria-expanded="false" style="margin-top:1rem;">
        <span class="bonus-tip__label"><img src="assets/icons/Lightbulb.png" alt="" class="tip-icon"> Bake it like a pizzeria<span class="bonus-tip__toggle" aria-hidden="true">+</span></span>
        <p class="bonus-tip__text">Preheat a baking steel in your oven at <strong>525°F</strong> for at least 45 minutes. Bake for 6-8 minutes. Try switching to broil in the last minute or 2 for a charred, pizzeria-style top.</p>
      </div>`,
  },
];

let wtStep   = 0;
let wtIsOpen = false;

// ── Walkthrough Timer ─────────────────────────────────────────
// Runs entirely in-browser — no Service Worker, no notifications, just an
// interval and a Web Audio chime at zero. One timer at a time; starting a
// new one cancels the previous. State persists across page reload via the
// shared `pieminderState` localStorage key.

let activeTimer = null;     // { stepIndex, endTime, label }
let timerIntervalId = null;
let audioCtx = null;        // created on first user gesture (Start button)

function ensureAudioContext() {
  if (audioCtx) {
    // Resume in case the browser auto-suspended it (Safari does this).
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  audioCtx = new AC();
  return audioCtx;
}

function playChime() {
  const ctx = ensureAudioContext();
  if (!ctx) return;

  // Two-note chime: C5 → E5. Sine wave, quick attack, ~1.2s exponential
  // decay. Soft enough to be pleasant, loud enough to hear across a
  // kitchen. Wrapped in a `fire()` callback so a suspended context can
  // resume() first — Safari auto-suspends on inactive tabs.
  const fire = () => {
    const now = ctx.currentTime;
    [
      { freq: 523.25, start: 0.00 },
      { freq: 659.25, start: 0.18 },
    ].forEach(note => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = note.freq;
      gain.gain.setValueAtTime(0.0001, now + note.start);
      gain.gain.exponentialRampToValueAtTime(0.32,   now + note.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.start + 1.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + note.start);
      osc.stop(now  + note.start + 1.3);
    });
  };

  if (ctx.state === 'suspended') {
    ctx.resume().then(fire).catch(() => {});
  } else {
    fire();
  }
}

function formatRemaining(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = n => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function startTimer(stepIndex, durationSec, label) {
  ensureAudioContext();   // create + warm on this user-gesture frame
  if (timerIntervalId) clearInterval(timerIntervalId);
  activeTimer = {
    stepIndex,
    endTime: Date.now() + durationSec * 1000,
    label,
  };
  timerIntervalId = setInterval(tickTimer, 250);
  renderTimerSection(wtStep);
  saveState();
}

function cancelTimer(opts = { fireChime: false }) {
  if (timerIntervalId) {
    clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
  activeTimer = null;
  if (opts.fireChime) playChime();
  if (wtIsOpen) renderTimerSection(wtStep);
  saveState();
}

function tickTimer() {
  if (!activeTimer) return;
  const remaining = activeTimer.endTime - Date.now();

  if (remaining <= 0) {
    cancelTimer({ fireChime: true });
    return;
  }

  // Only patch the countdown text — no full re-render every 250ms.
  const node = document.getElementById('wt-timer-countdown');
  if (node) node.textContent = formatRemaining(remaining);
}

function renderTimerSection(stepIndex) {
  const step = WALKTHROUGH_STEPS[stepIndex];
  const wrap = els.wtTimer;
  if (!wrap) return;

  // Running on THIS step → countdown pill.
  if (activeTimer && activeTimer.stepIndex === stepIndex) {
    const remaining = formatRemaining(activeTimer.endTime - Date.now());
    wrap.innerHTML = `
      <div class="wt-timer-running" role="timer" aria-label="${activeTimer.label} remaining">
        <div class="wt-timer-info">
          <span class="wt-timer-countdown" id="wt-timer-countdown">${remaining}</span>
          <span class="wt-timer-meta">${activeTimer.label}</span>
        </div>
        <button class="wt-timer-cancel" id="wt-timer-cancel-btn" aria-label="Cancel timer">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>`;
    document
      .getElementById('wt-timer-cancel-btn')
      .addEventListener('click', () => cancelTimer());
    return;
  }

  // Step doesn't define any timers → empty slot (CSS hides via :empty).
  if (!step.timers || !step.timers.length) {
    wrap.innerHTML = '';
    return;
  }

  // Idle: 1 timer = full-width; >1 = inline choices row.
  if (step.timers.length === 1) {
    const t = step.timers[0];
    wrap.innerHTML = `
      <button class="wt-timer-btn" data-i="0">
        <span class="wt-timer-icon" aria-hidden="true">⏱</span>
        Start ${t.label}
      </button>`;
  } else {
    wrap.innerHTML = `
      <div class="wt-timer-choices">
        ${step.timers.map((t, i) => `
          <button class="wt-timer-btn wt-timer-btn--inline" data-i="${i}">
            <span class="wt-timer-icon" aria-hidden="true">⏱</span>
            ${t.label}
          </button>`).join('')}
      </div>`;
  }

  wrap.querySelectorAll('.wt-timer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = step.timers[Number(btn.dataset.i)];
      startTimer(stepIndex, t.durationSec, t.label);
    });
  });
}

// ── Animation constants ────────────────────────────────────────
const APP_EL    = document.getElementById('app');
const OPEN_DUR  = 380; // ms — matches CSS transition
const EXIT_DUR  = 220; // ms — matches CSS exit keyframe

// ── Focus Trap ────────────────────────────────────────────────
// Returns { activate, deactivate } for a given container element.
// Wraps Tab/Shift-Tab so keyboard focus stays within the container.
function createFocusTrap(containerEl) {
  const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

  function handleTab(e) {
    if (e.key !== 'Tab') return;
    const nodes = Array.from(containerEl.querySelectorAll(FOCUSABLE));
    if (!nodes.length) return;
    const first = nodes[0];
    const last  = nodes[nodes.length - 1];
    if (e.shiftKey) {
      if (!containerEl.contains(document.activeElement) || document.activeElement === first) {
        e.preventDefault(); last.focus();
      }
    } else {
      if (!containerEl.contains(document.activeElement) || document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }
  }

  return {
    activate()   { containerEl.addEventListener('keydown', handleTab); },
    deactivate() { containerEl.removeEventListener('keydown', handleTab); },
  };
}

const walkthroughTrap = createFocusTrap(els.walkthrough);
const tipTrap         = createFocusTrap(els.tipOverlay);

// ── Step rendering ─────────────────────────────────────────────
function renderStep() {
  const step = WALKTHROUGH_STEPS[wtStep];
  const r    = calculate(); // always live — never stale

  els.wtIllustration.innerHTML = `<img src="${step.img}" alt="" class="wt-illus-img">`;
  els.wtTitle.textContent = step.title;
  els.wtBody.innerHTML    = step.getBody({ ...r, qty: state.quantity });
  els.wtCount.textContent = `Step ${wtStep + 1} of ${WALKTHROUGH_STEPS.length}`;

  Array.from(els.wtDots.children).forEach((dot, i) => {
    dot.classList.toggle('is-active', i === wtStep);
  });

  // Back button: show "Close" + X on step 1, "Back" + chevron on all others
  if (wtStep === 0) {
    els.wtBack.setAttribute('aria-label', 'Close walkthrough');
    els.wtBack.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M1 1L13 13M13 1L1 13" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg> Close';
  } else {
    els.wtBack.setAttribute('aria-label', 'Previous step');
    els.wtBack.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M11 3.5L6 9L11 14.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg> Back';
  }
  els.wtNext.textContent = wtStep === WALKTHROUGH_STEPS.length - 1 ? 'Done' : 'Next';

  renderTimerSection(wtStep);
}

// ── Step transition (slide illustration + card; topbar stays) ──
function transitionStep(direction, callback) {
  const slide    = els.wtSlide;
  const exitAnim  = direction === 'next' ? 'exit-left'   : 'exit-right';
  const enterAnim = direction === 'next' ? 'enter-right' : 'enter-left';

  // Phase 1: animate exit
  slide.dataset.anim = exitAnim;

  setTimeout(() => {
    // Phase 2: swap content, then animate enter
    slide.removeAttribute('data-anim');
    callback();
    slide.dataset.anim = enterAnim;
    slide.addEventListener('animationend', () => {
      slide.removeAttribute('data-anim');
    }, { once: true });
  }, EXIT_DUR);
}

// ── Open / Close ───────────────────────────────────────────────
function openWalkthrough(startStep = 0) {
  // Opening the walkthrough is the natural user-gesture moment to unlock
  // audio output for the kitchen-side chime. Safari especially needs the
  // AudioContext to be created (or resumed) during a real gesture frame;
  // this is the most reliable single place to do it.
  ensureAudioContext();

  wtStep   = startStep;
  wtIsOpen = true;
  APP_EL.classList.add('app--pushed');
  APP_EL.inert = true;
  els.walkthrough.classList.add('is-open');
  els.walkthrough.removeAttribute('aria-hidden');
  renderStep();
  els.walkthrough.focus({ preventScroll: true });
  document.body.style.overflow = 'hidden';
  walkthroughTrap.activate();
}

function closeWalkthrough() {
  wtIsOpen = false;
  walkthroughTrap.deactivate();
  APP_EL.classList.remove('app--pushed');
  els.walkthrough.classList.remove('is-open');
  els.walkthrough.setAttribute('aria-hidden', 'true');
  // Delay restoring scroll + focus until slide-out animation completes
  setTimeout(() => {
    APP_EL.inert = false;
    document.body.style.overflow = '';
    els.openWalkthrough.focus();
  }, OPEN_DUR);
  saveState();
}

// ── Tip Modal ─────────────────────────────────────────────────
function openTipModal() {
  APP_EL.inert = true;
  els.tipOverlay.classList.add('is-open');
  els.tipOverlay.removeAttribute('aria-hidden');
  els.tipClose.focus();
  document.body.style.overflow = 'hidden';
  tipTrap.activate();
}

function closeTipModal() {
  tipTrap.deactivate();
  els.tipOverlay.classList.remove('is-open');
  els.tipOverlay.setAttribute('aria-hidden', 'true');
  APP_EL.inert = false;
  document.body.style.overflow = '';
  els.openTipModal.focus();
}

// Build dots once
(function buildDots() {
  WALKTHROUGH_STEPS.forEach((_, i) => {
    const dot = document.createElement('div');
    dot.className = 'wt-dot' + (i === 0 ? ' is-active' : '');
    els.wtDots.appendChild(dot);
  });
})();

els.openWalkthrough.addEventListener('click', () => openWalkthrough());
els.wtClose.addEventListener('click', closeWalkthrough);

els.wtNext.addEventListener('click', () => {
  if (wtStep < WALKTHROUGH_STEPS.length - 1) {
    transitionStep('next', () => { wtStep++; renderStep(); saveState(); });
  } else {
    closeWalkthrough();
  }
});

els.wtBack.addEventListener('click', () => {
  if (wtStep > 0) {
    transitionStep('back', () => { wtStep--; renderStep(); saveState(); });
  } else {
    closeWalkthrough();
  }
});

// Keyboard navigation
els.walkthrough.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeWalkthrough(); return; }
  if (e.key === 'ArrowRight' && wtStep < WALKTHROUGH_STEPS.length - 1) {
    transitionStep('next', () => { wtStep++; renderStep(); saveState(); });
  }
  if (e.key === 'ArrowLeft' && wtStep > 0) {
    transitionStep('back', () => { wtStep--; renderStep(); saveState(); });
  }
});

// Pro Tip accordion — click and keyboard (Enter/Space)
function toggleAccordion(tip) {
  const isOpen = tip.classList.toggle('is-open');
  tip.setAttribute('aria-expanded', String(isOpen));
  const toggle = tip.querySelector('.bonus-tip__toggle');
  if (toggle) toggle.textContent = isOpen ? '−' : '+';
}

document.addEventListener('click', (e) => {
  const tip = e.target.closest('.bonus-tip--accordion');
  if (tip) toggleAccordion(tip);
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const tip = e.target.closest('.bonus-tip--accordion');
  if (!tip) return;
  e.preventDefault();
  toggleAccordion(tip);
});

// Swipe navigation
let _swipeStartX = null;
els.walkthrough.addEventListener('touchstart', (e) => {
  _swipeStartX = e.touches[0].clientX;
}, { passive: true });

els.walkthrough.addEventListener('touchend', (e) => {
  if (_swipeStartX === null) return;
  const dx = e.changedTouches[0].clientX - _swipeStartX;
  _swipeStartX = null;
  if (Math.abs(dx) < 50) return;
  if      (dx < 0 && wtStep < WALKTHROUGH_STEPS.length - 1) { transitionStep('next', () => { wtStep++; renderStep(); saveState(); }); }
  else if (dx < 0 && wtStep === WALKTHROUGH_STEPS.length - 1) { closeWalkthrough(); }
  else if (dx > 0 && wtStep > 0)                              { transitionStep('back', () => { wtStep--; renderStep(); saveState(); }); }
  else if (dx > 0 && wtStep === 0)                            { closeWalkthrough(); }
}, { passive: true });

// ── Tip Modal Events ───────────────────────────────────────────
els.openTipModal.addEventListener('click', openTipModal);
els.tipClose.addEventListener('click', closeTipModal);

// Close on backdrop click (not on the modal card itself)
els.tipOverlay.addEventListener('click', (e) => {
  if (e.target === els.tipOverlay) closeTipModal();
});

// Close on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && els.tipOverlay.classList.contains('is-open')) {
    closeTipModal();
  }
});

// ── Share Recipe ───────────────────────────────────────────────
function buildShareUrl() {
  const base   = window.location.origin + window.location.pathname;
  const params = new URLSearchParams({
    qty:   state.quantity,
    size:  state.size,
    thick: state.thickness,
    hyd:   state.hydration,
    gfhyd: state.gfHydration,
    gf:    state.glutenFree ? '1' : '0',
  });
  return `${base}?${params}`;
}

async function shareRecipe() {
  const url  = buildShareUrl();
  const data = {
    title: 'PieMinder Pro — Pizza Dough Recipe',
    text:  `My dough settings: ${state.quantity}× ${state.size}" ${state.thickness} crust, ${state.glutenFree ? state.gfHydration : state.hydration}% hydration`,
    url,
  };

  if (navigator.share && navigator.canShare?.(data)) {
    try {
      await navigator.share(data);
    } catch (e) {
      // User cancelled (AbortError) — do nothing. Any other error falls through to clipboard.
      if (e.name !== 'AbortError') await copyUrlToClipboard(url);
    }
  } else {
    await copyUrlToClipboard(url);
  }
}

async function copyUrlToClipboard(url) {
  const btn         = els.shareBtn;
  const originalHTML = btn.innerHTML;

  try {
    await navigator.clipboard.writeText(url);
  } catch (e) {
    return; // clipboard unavailable — do nothing
  }

  btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M3 9l4.5 4.5L15 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Link Copied`;
  btn.classList.add('share-btn--copied');

  setTimeout(() => {
    btn.innerHTML = originalHTML;
    btn.classList.remove('share-btn--copied');
  }, 2500);
}

function loadFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (!params.size) return false;

  if (params.has('qty')) {
    const v = Number(params.get('qty'));
    if (!isNaN(v)) state.quantity = Math.min(Math.max(Math.round(v), QTY_MIN), QTY_MAX);
  }
  if (params.has('size')) {
    const v = Number(params.get('size'));
    if (!isNaN(v)) state.size = Math.min(Math.max(Math.round(v), 8), 20);
  }
  if (params.has('thick')) {
    const v = params.get('thick');
    if (['thin', 'regular', 'thick'].includes(v)) state.thickness = v;
  }
  if (params.has('hyd')) {
    const v = Number(params.get('hyd'));
    if (!isNaN(v)) state.hydration = Math.min(Math.max(Math.round(v), 60), 80);
  }
  if (params.has('gfhyd')) {
    const v = Number(params.get('gfhyd'));
    if (!isNaN(v)) state.gfHydration = Math.min(Math.max(Math.round(v), 60), 80);
  }
  if (params.has('gf')) {
    state.glutenFree = params.get('gf') === '1';
  }

  // Silently clean the URL — no page refresh, no flicker
  history.replaceState(null, '', window.location.pathname);
  return true;
}

els.shareBtn.addEventListener('click', shareRecipe);

// ── Init ───────────────────────────────────────────────────────
function init() {
  // localStorage first, then URL params override (shared links win)
  const savedWtStep = loadState();
  const fromUrl     = loadFromUrl();

  // Sync DOM inputs from (possibly restored) state
  els.sizeSlider.value = state.size;
  els.qtyDisplay.textContent = String(state.quantity);
  els.gfToggle.setAttribute('aria-checked', String(state.glutenFree));

  syncSlider();
  updateHydrationSlider();
  updateQtyButtons();
  // Fully sync segmented control & indicator from JS state (don't trust HTML initial attrs)
  segBtns.forEach((btn) => {
    const isActive = btn.dataset.value === state.thickness;
    btn.setAttribute('aria-checked', String(isActive));
    btn.classList.toggle('seg-btn--active', isActive);
    btn.tabIndex = isActive ? 0 : -1;
  });
  // Measure now, then re-measure after fonts load (Google Fonts changes button widths)
  positionIndicator();
  document.fonts.ready.then(positionIndicator);
  recalculate();

  // Restore walkthrough only if NOT opening from a shared link
  if (!fromUrl && savedWtStep !== null) {
    openWalkthrough(savedWtStep);
  }
}

// Reposition indicator if window is resized
window.addEventListener('resize', positionIndicator);

init();

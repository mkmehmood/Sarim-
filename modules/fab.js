// Floating action button: the data-entry card of each tab opens as a bottom sheet.
// The cards keep their ids and handlers (only re-parented), and the button follows
// whatever tab/mode logic shows or hides the tab, so app modes and device locks still apply.
const ENTRIES = [
  { tab: 'prod',     id: 'production-entry-section',  label: 'New production entry' },
  { tab: 'sales',    id: 'sales-entry-section',       label: 'New sale' },
  { tab: 'factory',  id: 'factory-entry-section',     label: 'New factory entry' },
  { tab: 'payments', id: 'payments-entry-section',    label: 'New transaction' },
  { tab: 'rep',      id: 'rep-new-transaction-card',  label: 'New rep transaction' },
];
const $ = (id) => document.getElementById(id);
let fab = null, openTab = null, lastSubmit = 0, queued = false;

function visible(el) {
  return !!el && !el.classList.contains('hidden') && el.style.display !== 'none' && getComputedStyle(el).display !== 'none';
}
function activeEntry() { return ENTRIES.find((e) => visible($('tab-' + e.tab))) || null; }
function sheetOf(e) { return $('fab-sheet-' + e.tab); }

function wrap(e) {
  const card = $(e.id);
  if (!card || card.dataset.fabWrapped) return;
  const sheet = document.createElement('div');
  sheet.className = 'fab-sheet';
  sheet.id = 'fab-sheet-' + e.tab;
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', e.label);
  sheet.innerHTML = '<div class="fab-sheet-backdrop"></div><div class="fab-sheet-panel"><div class="fab-sheet-grip"></div>' +
    '<button type="button" class="fab-sheet-close" aria-label="Close">\u00d7</button><div class="fab-sheet-body"></div></div>';
  card.parentNode.insertBefore(sheet, card);
  sheet.querySelector('.fab-sheet-body').appendChild(card);
  card.dataset.fabWrapped = '1';
  sheet.querySelector('.fab-sheet-backdrop').addEventListener('click', closeAll);
  sheet.querySelector('.fab-sheet-close').addEventListener('click', closeAll);
  // Remember a save attempt so a success toast right after it closes the sheet.
  card.addEventListener('click', (ev) => { if (ev.target.closest('button.btn-main')) lastSubmit = Date.now(); }, true);
}

function open(e) {
  const sheet = sheetOf(e);
  if (!sheet) return false;
  if (openTab && openTab !== e.tab) closeAll();
  sheet.classList.add('open');
  document.body.classList.add('fab-sheet-open');
  openTab = e.tab;
  const r = sheet.getBoundingClientRect();
  if (Math.abs(r.top) > 1 || Math.abs(r.left) > 1) document.body.appendChild(sheet); // an ancestor traps fixed positioning
  updateFab();
  return true;
}

function closeAll() {
  document.querySelectorAll('.fab-sheet.open').forEach((s) => s.classList.remove('open'));
  document.body.classList.remove('fab-sheet-open');
  openTab = null;
  updateFab();
}

function updateFab() {
  if (!fab) return;
  const e = activeEntry();
  const card = e && $(e.id);
  const ok = !!card && visible(card) && window.__appLocked !== true;
  if (openTab && (!e || e.tab !== openTab || !ok)) closeAll();
  fab.hidden = !ok;
  if (ok) { fab.setAttribute('aria-label', e.label); fab.title = e.label; }
}
function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; updateFab(); });
}

function init() {
  ENTRIES.forEach(wrap);
  fab = document.createElement('button');
  fab.id = 'fab-add';
  fab.type = 'button';
  fab.className = 'fab-add';
  fab.hidden = true;
  fab.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
  fab.addEventListener('click', () => { const e = activeEntry(); if (e) open(e); });
  document.body.appendChild(fab);

  const mo = new MutationObserver(schedule);
  const watch = (el) => el && mo.observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
  ENTRIES.forEach((e) => { watch($('tab-' + e.tab)); watch($(e.id)); });
  watch($('splash-screen'));
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && openTab) closeAll(); });
  document.addEventListener('visibilitychange', schedule);

  const baseToast = window.showToast;
  if (typeof baseToast === 'function') {
    window.showToast = function (msg, type) {
      const r = baseToast.apply(this, arguments);
      if (openTab && type === 'success' && Date.now() - lastSubmit < 4000) { lastSubmit = 0; setTimeout(closeAll, 350); }
      return r;
    };
  }
  schedule();
}

window.__fabOpenFor = (el) => {
  const sheet = el && el.closest && el.closest('.fab-sheet');
  const e = sheet && ENTRIES.find((x) => sheet.id === 'fab-sheet-' + x.tab);
  return e ? open(e) : false;
};
window.__fabCloseAll = closeAll;

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

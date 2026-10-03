/* ledger-ui.js - behaviour for the "stock ledger" design system.
   Presentation only: no business logic, data, sync or calculations. */

const byId = (id) => document.getElementById(id);

export function lgEsc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const STORE_VARS = ['var(--a)', 'var(--b)', 'var(--c)', 'var(--d)', 'var(--e)'];
export function lgStoreColor(index) {
  return STORE_VARS[index] || 'var(--mut)';
}

/* ---------- Ledger row ----------------------------------------------------
   All string arguments are HTML. Callers escape user data with lgEsc/esc.
   rows: [[label, valueHtml], ...]   (empty/falsy values are skipped)       */
export function ledgerRowInner(o) {
  const rows = (o.rows || []).filter((r) => r && r[1] !== '' && r[1] != null && r[1] !== false);
  const dl = rows.length
    ? `<dl class="lrow-dl">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`
    : '';
  const bar = o.progress != null
    ? `<div class="lrow-m"><i style="width:${Math.max(0, Math.min(100, o.progress)).toFixed(1)}%;background:${o.progressColor || 'var(--fg)'}"></i></div>`
    : '';
  return `<div class="lrow-t">${o.title || ''}</div>
<div class="lrow-n">${o.main == null ? '' : o.main}</div>
<button type="button" class="lrow-s" aria-expanded="false">${o.summary || ''}</button>
<div class="lrow-r ${o.sideClass || ''}">${o.side == null ? '' : o.side}</div>
${bar}
<div class="lrow-more"><div>${dl}${o.extra || ''}${o.actions || ''}</div></div>`;
}

export function toggleLedgerRow(row) {
  const open = row.classList.toggle('open');
  const b = row.querySelector(':scope > .lrow-s, :scope > div > .lrow-s');
  if (b) b.setAttribute('aria-expanded', open ? 'true' : 'false');
  return open;
}

document.addEventListener('click', (e) => {
  const row = e.target.closest && e.target.closest('.lrow, .who-row');
  if (!row) return;
  if (e.target.closest('.lrow-more')) return;           // taps inside the panel never collapse it
  if (e.target.closest('a, input, select, textarea, [data-no-toggle]')) return;
  toggleLedgerRow(row);
});

/* Sentence-case a store/rep name that was typed in capitals (display only) */
export function lgCase(v) {
  const t = String(v == null ? '' : v);
  return t === t.toUpperCase() && /[A-Z]/.test(t) ? t.charAt(0) + t.slice(1).toLowerCase() : t;
}

/* ---------- Number helpers ---------- */
const num = (t) => {
  const n = parseFloat(String(t == null ? '' : t).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
};
const f0 = (n) => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const f3 = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/* ---------- Production hero (#prod-stock-hero) -----------------------------
   stores: [{ name, remaining, produced }]  produced = production + returns   */
export function updateProdStockHero(stores, totalRemaining, totalIn) {
  const totalEl = byId('prod-hero-total');
  const bar = byId('prod-hero-bar');
  const key = byId('prod-hero-key');
  if (!totalEl || !bar || !key) return;
  totalEl.textContent = f3(totalRemaining);
  const base = Math.max(Number(totalIn) || 0, stores.reduce((s, x) => s + Math.max(0, x.remaining), 0)) || 1;
  bar.innerHTML = stores
    .map((s, i) => `<span style="width:${(Math.max(0, s.remaining) / base * 100).toFixed(2)}%;background:${lgStoreColor(i)}"></span>`)
    .join('') + '<span class="sold"></span>';
  key.innerHTML = stores
    .map((s, i) => `<span><b style="background:${lgStoreColor(i)}"></b>${lgEsc(s.name)}</span>`)
    .join('') + '<span>Hatched is sold</span>';
}

/* ---------- Sales hero (#sales-owe-hero) ---------- */
const MODE_WORD = { day: 'today', week: 'this week', month: 'this month', year: 'this year', all: 'all time' };
export function updateSalesOwed(total) {
  const el = byId('sales-hero-owed');
  if (el) el.textContent = f0(total);
}
export function updateSalesPaymentBar(mode, cash, credit) {
  const bar = byId('sales-hero-bar');
  const key = byId('sales-hero-key');
  if (!bar || !key) return;
  cash = Math.max(0, Number(cash) || 0);
  credit = Math.max(0, Number(credit) || 0);
  const t = cash + credit;
  const w = MODE_WORD[mode] || 'today';
  bar.innerHTML = t > 0
    ? `<span style="width:${(cash / t * 100).toFixed(2)}%;background:var(--pos)"></span><span style="flex:1;background:var(--a)"></span>`
    : '<span class="sold"></span>';
  key.innerHTML = `<span><b style="background:var(--pos)"></b>Cash ${w} ${f0(cash)}</span><span><b style="background:var(--a)"></b>Credit ${w} ${f0(credit)}</span>`;
}

/* ---------- Live figure on primary buttons ---------- */
function visible(el) {
  return !!el && el.offsetParent !== null && getComputedStyle(el).display !== 'none';
}
function refreshLive() {
  const pb = byId('btn-save-production');
  if (pb) {
    const net = num(byId('net-wt') && byId('net-wt').value);
    const ppk = num(byId('profit-per-kg') && byId('profit-per-kg').textContent);
    pb.dataset.live = visible(byId('prod-profit-block')) && net > 0 ? 'Profit ' + f0(net * ppk) : '';
  }
  const sb = byId('btn-save-cust-transaction');
  if (sb) {
    const coll = byId('cust-coll-inputs') && !byId('cust-coll-inputs').classList.contains('hidden');
    const v = coll ? num(byId('cust-amount-collected') && byId('cust-amount-collected').value)
      : num(byId('cust-total-value') && byId('cust-total-value').textContent);
    sb.dataset.live = v > 0 ? 'Rs ' + f0(v) : '';
  }
}

/* ---------- Page header: each tab owns its title, date and mode button ---------- */
function fillDates() {
  const t = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  document.querySelectorAll('.lg-date').forEach((d) => { d.textContent = t; });
}
export function syncLedgerHead() { fillDates(); updateFab(); }

/* ---------- Data-entry sheets + floating button ----------------------------
   Every .lg-entry card (production, sale, factory, payment, rep) is a bottom
   sheet. The card stays in the DOM, so all ids and handlers keep working.   */
const PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
let fab = null, scrim = null, openSheet = null, lastFocus = null;

function tabOf(card) { return card.closest('[id^="tab-"]'); }
function tabVisible(card) {
  const t = tabOf(card);
  return !!t && !t.classList.contains('hidden') && t.style.display !== 'none';
}
function activeCard() {
  return [...document.querySelectorAll('.lg-entry')].find((c) => tabVisible(c)) || null;
}
function updateFab() {
  if (!fab) return;
  if (openSheet && !tabVisible(openSheet)) { closeEntrySheet(true); return; }
  const card = activeCard();
  const show = !!card && !openSheet && window.__appLocked !== true && !document.querySelector('.standalone-screen.active, .standalone-screen.open, .standalone-screen[style*="display: block"], .standalone-screen[style*="display:block"]');
  fab.classList.toggle('show', show);
  fab.tabIndex = show ? 0 : -1;
  if (card) {
    const label = card.getAttribute('data-fab') || 'New entry';
    fab.querySelector('.lg-fab-t').textContent = label;
    fab.setAttribute('aria-label', label);
  }
}
export function openEntrySheet(card) {
  card = card || activeCard();
  if (!card) return;
  if (openSheet && openSheet !== card) closeEntrySheet(true);
  lastFocus = document.activeElement;
  openSheet = card;
  card.classList.add('open');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  scrim.classList.add('show');
  document.body.classList.add('lg-sheet-open');
  updateFab();
  card.scrollTop = 0;
}
export function closeEntrySheet(quiet) {
  if (!openSheet) return;
  const c = openSheet;
  openSheet = null;
  c.classList.remove('open');
  c.removeAttribute('aria-modal');
  scrim.classList.remove('show');
  document.body.classList.remove('lg-sheet-open');
  updateFab();
  if (!quiet && lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
}
/* Edit mode scrolls to a form field: make sure the sheet holding it is open */
export function openSheetFor(el) {
  const c = el && el.closest ? el.closest('.lg-entry') : null;
  if (c) openEntrySheet(c);
}

function initSheets() {
  scrim = document.createElement('div');
  scrim.id = 'lg-scrim';
  scrim.addEventListener('click', () => closeEntrySheet());
  document.body.appendChild(scrim);

  fab = document.createElement('button');
  fab.type = 'button';
  fab.id = 'lg-fab';
  fab.innerHTML = PLUS + '<span class="lg-fab-t">New entry</span>';
  fab.addEventListener('click', () => openEntrySheet());
  document.body.appendChild(fab);

  document.querySelectorAll('.lg-entry').forEach((card) => {
    const bar = document.createElement('div');
    bar.className = 'lg-sheet-bar';
    bar.innerHTML = '<span class="lg-grab" aria-hidden="true"></span><button type="button" class="lg-sheet-x" aria-label="Close">'
      + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
    bar.querySelector('.lg-sheet-x').addEventListener('click', () => closeEntrySheet());
    card.insertBefore(bar, card.firstChild);
  });

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openSheet && !document.querySelector('.glass-confirm-backdrop.show, .cdp-popover')) closeEntrySheet(); });

  /* a successful save shows a success toast: close the sheet behind it */
  new MutationObserver((muts) => {
    if (!openSheet) return;
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeType === 1 && n.classList && n.classList.contains('liquid-toast') && n.classList.contains('toast-success')) {
        setTimeout(() => closeEntrySheet(true), 450);
        return;
      }
    }
  }).observe(document.body, { childList: true, subtree: true });

  /* swipe the grab bar down to dismiss */
  let y0 = null;
  document.addEventListener('touchstart', (e) => { const t = e.target.closest && e.target.closest('.lg-sheet-bar'); y0 = t ? e.touches[0].clientY : null; }, { passive: true });
  document.addEventListener('touchend', (e) => { if (y0 != null && e.changedTouches[0].clientY - y0 > 70) closeEntrySheet(); y0 = null; }, { passive: true });

  const mo = new MutationObserver(updateFab);
  document.querySelectorAll('[id^="tab-"]').forEach((t) => mo.observe(t, { attributes: true, attributeFilter: ['class', 'style'] }));
  document.querySelectorAll('.standalone-screen').forEach((t) => mo.observe(t, { attributes: true, attributeFilter: ['class', 'style'] }));
  updateFab();
}

/* Every standalone screen gets the same page header: round back button, then the big title */
function initScreenHeaders() {
  document.querySelectorAll('.standalone-screen').forEach((scr) => {
    const bar = scr.querySelector(':scope > .screen-topbar');
    if (!bar || bar.querySelector('.lg-back')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lg-back';
    b.setAttribute('aria-label', 'Back');
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
    b.addEventListener('click', () => { if (typeof window.closeStandaloneScreen === 'function') window.closeStandaloneScreen(scr.id); });
    bar.insertBefore(b, bar.firstChild);
  });
}

function init() {
  fillDates();
  initSheets();
  initScreenHeaders();
  const lm = new MutationObserver(refreshLive);
  ['profit-per-kg', 'cust-total-value'].forEach((id) => {
    const t = byId(id);
    if (t) lm.observe(t, { childList: true, characterData: true, subtree: true });
  });
  document.addEventListener('input', refreshLive, true);
  document.addEventListener('click', () => requestAnimationFrame(refreshLive), true);
  refreshLive();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

window.LedgerUI = { openEntrySheet, closeEntrySheet, openSheetFor, lgCase, ledgerRowInner, toggleLedgerRow, updateProdStockHero, updateSalesOwed, updateSalesPaymentBar, syncLedgerHead, lgEsc, lgStoreColor, refreshLive };

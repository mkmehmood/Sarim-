import { getTimestamp } from './business.js';

function _reg() {
  if (!window.__editRegistry) window.__editRegistry = { handlers: {}, keep: {} };
  return window.__editRegistry;
}

export function registerEditHandler(kind, fn, opts = {}) {
  const r = _reg();
  r.handlers[kind] = fn;
  r.keep[kind] = opts.keepScreens || [];
}

export async function startEdit(kind, id) {
  const h = _reg().handlers[kind];
  if (!h) {
    if (window.showToast) window.showToast('Editing is not available for this entry.', 'warning');
    return;
  }
  try {
    document.querySelectorAll('.standalone-screen').forEach(s => {
      if (s.id && !(_reg().keep[kind] || []).includes(s.id) && getComputedStyle(s).display !== 'none' && typeof window.closeStandaloneScreen === 'function') window.closeStandaloneScreen(s.id);
    });
    await h(id);
  } catch (e) {
    console.warn('[edit] failed to start', kind, e);
    if (window.showToast) window.showToast('Could not open this entry for editing.', 'error');
  }
}

export function getEditCtx(kind) {
  const c = window._editCtx;
  return c && (!kind || c.kind === kind) ? c : null;
}

export function beginEditMode(kind, original, opts = {}) {
  endEditMode();
  window._editCtx = {
    kind,
    id: original.id,
    original: JSON.parse(JSON.stringify(original)),
    buttonId: opts.buttonId || null,
    cancelFn: opts.cancelFn || null,
  };
  const btn = opts.buttonId ? document.getElementById(opts.buttonId) : null;
  if (btn) {
    if (btn.dataset.editOrig === undefined) btn.dataset.editOrig = btn.textContent;
    btn.textContent = opts.label || 'Update';
    const banner = document.createElement('div');
    banner.id = 'edit-mode-banner';
    banner.className = 'edit-mode-banner';
    banner.setAttribute('role', 'status');
    banner.innerHTML = '<div class="emb-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></div><div class="emb-text"><b>Editing entry</b><span>Saving updates the original record.</span></div>';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.onclick = () => cancelEdit();
    banner.appendChild(cancel);
    btn.parentNode.insertBefore(banner, btn);
  }
  const anchor = (opts.anchorId && document.getElementById(opts.anchorId)) || btn;
  if (anchor && anchor.scrollIntoView) setTimeout(() => anchor.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
}

export function endEditMode() {
  const c = window._editCtx;
  const banner = document.getElementById('edit-mode-banner');
  if (banner) banner.remove();
  if (c && c.buttonId) {
    const btn = document.getElementById(c.buttonId);
    if (btn && btn.dataset.editOrig !== undefined) {
      btn.textContent = btn.dataset.editOrig;
      delete btn.dataset.editOrig;
    }
  }
  window._editCtx = null;
}

export function cancelEdit() {
  const c = window._editCtx;
  endEditMode();
  if (c && typeof c.cancelFn === 'function') {
    try { c.cancelFn(); } catch (_) {}
  }
}

export function stampEdit(rec, original) {
  rec.id = original.id;
  rec.createdAt = original.createdAt;
  rec.timestamp = original.timestamp || original.createdAt;
  rec.updatedAt = getTimestamp();
  rec.isEdited = true;
  rec.editedAt = new Date().toISOString();
  if (original.createdBy && !rec.createdBy) rec.createdBy = original.createdBy;
  return rec;
}

export function replaceRecord(arr, rec) {
  const i = arr.findIndex(r => r && String(r.id) === String(rec.id));
  if (i === -1) arr.push(rec);
  else arr[i] = rec;
  return i;
}

const _esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function editButtonHtml(kind, id) {
  return `<button class="tbl-action-btn edit" onclick="startEdit('${_esc(kind)}','${_esc(id)}')">Edit</button>`;
}

export function actionRowHtml(kind, id, deleteHtml) {
  if (!deleteHtml) return '';
  return `<div class="tbl-action-row">${editButtonHtml(kind, id)}${deleteHtml.replace(' u-w-full u-mt-8', '')}</div>`;
}

export function markEditedBadge(rec) {
  return rec && rec.isEdited ? '<span class="edited-badge">edited</span>' : '';
}

window.startEdit = startEdit;
window.cancelEdit = cancelEdit;

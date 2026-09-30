import { esc, fmtNum, sqliteStore, ensureArray } from './business.js';

const getStoreLabel = (s) => (typeof window.getStoreLabel === 'function' ? window.getStoreLabel(s) : s);

const MAX_PHOTOS = 6;
const _thumbCache = new Map();
let _picker = [];
const _selected = new Set();

function _toast(msg, type = 'info', ms = 3000) {
  if (window.showToast) window.showToast(msg, type, ms);
}

function _readFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

async function _compress(dataUrl, maxDim = 1400, quality = 0.82) {
  if (typeof window._compressPhoto === 'function') return window._compressPhoto(dataUrl, maxDim, quality);
  return dataUrl;
}

async function _photoStore() {
  const stored = await sqliteStore.get('person_photos');
  return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
}

async function _writePhotoKeys(setMap, deleteKeys) {
  const photos = await _photoStore();
  const ts = (await sqliteStore.get('person_photos_timestamps')) || {};
  const dirty = (await sqliteStore.get('person_photos_dirty_keys')) || [];
  const now = Date.now();
  for (const [k, v] of Object.entries(setMap)) {
    photos[k] = v;
    ts[k] = now;
    if (!dirty.includes(k)) dirty.push(k);
    _thumbCache.set(k, v);
  }
  for (const k of deleteKeys) {
    delete photos[k];
    delete ts[k];
    if (!dirty.includes(k)) dirty.push(k);
    _thumbCache.delete(k);
  }
  await sqliteStore.set('person_photos', photos);
  await sqliteStore.set('person_photos_timestamps', ts);
  await sqliteStore.set('person_photos_dirty_keys', dirty);
  await sqliteStore.set('person_photos_timestamp', now);
  if (typeof window.triggerAutoSync === 'function') { try { window.triggerAutoSync(); } catch (_) {} }
}

function _renderPicker() {
  const box = document.getElementById('prod-photo-thumbs');
  const count = document.getElementById('prod-photo-count');
  if (count) count.textContent = _picker.length ? `${_picker.length}/${MAX_PHOTOS}` : '';
  const dot = document.getElementById('prod-photo-dot');
  const btn = document.getElementById('prod-photo-btn');
  if (dot) dot.style.display = _picker.length ? '' : 'none';
  if (btn) btn.style.borderColor = _picker.length ? 'var(--accent)' : 'var(--glass-border)';
  if (!box) return;
  box.innerHTML = _picker.map((p, i) => `<div class="pp-thumb"><img src="${p.dataUrl}" alt="Product photo ${i + 1}" onclick="openPhotoLightbox(this.src)"><button type="button" class="pp-remove" aria-label="Remove photo" onclick="removeProdPhoto(${i})">&times;</button></div>`).join('');
}

export async function addProdPhotos(fileList) {
  const files = Array.from(fileList || []).filter(f => f && /^image\//.test(f.type));
  if (!files.length) return;
  const room = MAX_PHOTOS - _picker.length;
  if (room <= 0) { _toast(`You can attach up to ${MAX_PHOTOS} photos per entry.`, 'warning'); return; }
  const use = files.slice(0, room);
  if (files.length > room) _toast(`Only ${room} more photo${room === 1 ? '' : 's'} allowed — extra files skipped.`, 'warning');
  for (const f of use) {
    try {
      const raw = await _readFile(f);
      const small = await _compress(raw, 1400, 0.82);
      _picker.push({ key: null, dataUrl: small, isNew: true });
    } catch (e) {
      console.warn('[prod photo] read failed', e);
    }
  }
  _renderPicker();
}

export async function addProdPhotoDataUrl(dataUrl) {
  if (_picker.length >= MAX_PHOTOS) { _toast(`You can attach up to ${MAX_PHOTOS} photos per entry.`, 'warning'); return; }
  const small = await _compress(dataUrl, 1400, 0.82);
  _picker.push({ key: null, dataUrl: small, isNew: true });
  _renderPicker();
}

export function openProdPhotoCapture() {
  if (_picker.length >= MAX_PHOTOS) { _toast(`You can attach up to ${MAX_PHOTOS} photos per entry.`, 'warning'); return; }
  if (typeof window.openPhotoCapture === 'function') window.openPhotoCapture('prod');
}

export function removeProdPhoto(i) {
  _picker.splice(i, 1);
  _renderPicker();
}

export function resetProdPhotos() {
  _picker = [];
  const a = document.getElementById('prod-photo-file'); if (a) a.value = '';
  _renderPicker();
}

export async function loadProdPhotosForEdit(rec) {
  _picker = [];
  const keys = Array.isArray(rec && rec.photoKeys) ? rec.photoKeys : [];
  const photos = await _photoStore();
  keys.forEach(k => { if (photos[k]) _picker.push({ key: k, dataUrl: photos[k], isNew: false }); });
  _renderPicker();
}

export function getProdPhotoKeys(prodId) {
  const keep = [];
  const stamp = Date.now();
  _picker.forEach((p, i) => {
    if (!p.key) p.key = `prod:${prodId}:${stamp.toString(36)}${i}`;
    keep.push(p.key);
  });
  return keep;
}

export async function persistProdPhotos(prodId, previousKeys = []) {
  const setMap = {};
  _picker.forEach(p => { if (p.isNew && p.key) setMap[p.key] = p.dataUrl; });
  const keepSet = new Set(_picker.map(p => p.key));
  const del = (previousKeys || []).filter(k => !keepSet.has(k));
  if (Object.keys(setMap).length || del.length) await _writePhotoKeys(setMap, del);
  resetProdPhotos();
}

export async function deleteProdPhotos(rec) {
  const keys = Array.isArray(rec && rec.photoKeys) ? rec.photoKeys : [];
  if (keys.length) await _writePhotoKeys({}, keys);
}

const VIEW_SVG = '<svg width="11" height="11" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;"><rect x="3" y="7" width="30" height="22" rx="3" stroke="currentColor" stroke-width="1.8" fill="none"/><circle cx="18" cy="18" r="6" stroke="currentColor" stroke-width="1.6" fill="none"/><circle cx="18" cy="18" r="2.5" fill="currentColor"/><rect x="22" y="4" width="8" height="5" rx="1.5" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>';
const WA_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;"><path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M8.8 8.6c.2-.4.5-.4.7-.4l.5.9c.1.2 0 .4-.1.6l-.4.5c.6 1.2 1.6 2.1 2.8 2.7l.6-.7c.2-.2.4-.2.6-.1l1 .5c.2.1.2.3.1.6-.3.9-1.4 1.3-2.2 1.1-2.3-.6-4.2-2.5-4.7-4.6-.1-.5 0-.9.3-1.1z" fill="currentColor"/></svg>';

export function toggleProdPhotoPanel(btn, id) {
  const panel = document.getElementById('pp-panel-' + id);
  if (!panel) return;
  const open = panel.style.display === 'none' || !panel.style.display;
  panel.style.display = open ? 'block' : 'none';
  if (open) hydrateProdPhotoThumbs(panel);
}

export function prodPhotoStripHtml(item) {
  const keys = Array.isArray(item.photoKeys) ? item.photoKeys : [];
  if (!keys.length || item.isReturn || item.isTransfer) return '';
  const id = String(item.id).replace(/[^a-z0-9_-]/gi, '');
  const thumbs = keys.map(k => `<img class="pp-strip-img" data-photo-key="${esc(k)}" alt="Product photo" onclick="openProdPhoto('${esc(k)}')">`).join('');
  const checked = _selected.has(item.id) ? ' checked' : '';
  return `<div class="pp-actions"><button type="button" class="pp-badge" title="View photos" onclick="toggleProdPhotoPanel(this,'${id}')">${VIEW_SVG}Photo${keys.length > 1 ? ' \u00d7' + keys.length : ''}</button><label class="pp-select"><input type="checkbox" data-pp-select="${esc(item.id)}"${checked} onchange="toggleProdPhotoSelect('${esc(item.id)}', this.checked)"> Select</label><button type="button" class="pp-share-btn" title="Share on WhatsApp" aria-label="Share on WhatsApp" onclick="shareProdPhotos(['${esc(item.id)}'])">${WA_SVG}</button></div><div class="pp-strip" id="pp-panel-${id}" style="display:none;">${thumbs}</div>`;
}

export async function hydrateProdPhotoThumbs(root = document) {
  const imgs = Array.from(root.querySelectorAll('img[data-photo-key]:not([src])'));
  if (!imgs.length) return;
  const photos = await _photoStore();
  imgs.forEach(img => {
    const k = img.getAttribute('data-photo-key');
    const v = _thumbCache.get(k) || photos[k];
    if (v) { img.src = v; _thumbCache.set(k, v); } else { img.classList.add('pp-missing'); }
  });
}

export async function openProdPhoto(key) {
  const photos = await _photoStore();
  const v = photos[key];
  if (v && typeof window.openPhotoLightbox === 'function') window.openPhotoLightbox(v);
}

function _updateShareBar() {
  let bar = document.getElementById('pp-sharebar');
  if (_selected.size === 0) { if (bar) bar.remove(); return; }
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'pp-sharebar';
    bar.className = 'pp-sharebar';
    document.body.appendChild(bar);
  }
  bar.innerHTML = `<span><b>${_selected.size}</b> entr${_selected.size === 1 ? 'y' : 'ies'} selected</span><div><button type="button" class="pp-bar-clear" onclick="clearProdPhotoSelection()">Clear</button><button type="button" class="pp-bar-share" onclick="shareProdPhotos()">Share on WhatsApp</button></div>`;
}

export function toggleProdPhotoSelect(id, on) {
  if (on) _selected.add(id); else _selected.delete(id);
  _updateShareBar();
}

export function clearProdPhotoSelection() {
  _selected.clear();
  document.querySelectorAll('input[data-pp-select]').forEach(c => { c.checked = false; });
  _updateShareBar();
}

function _wrapText(ctx, text, maxWidth) {
  const words = String(text).split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxWidth && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

async function _captionedBlob(dataUrl, captionLines) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
  const W = Math.min(1280, img.width);
  const H = Math.round(img.height * (W / img.width));
  const pad = Math.round(W * 0.03);
  const fs = Math.max(20, Math.round(W * 0.034));
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `600 ${fs}px sans-serif`;
  const lines = captionLines.flatMap(l => _wrapText(measure, l, W - pad * 2));
  const bandH = pad * 2 + lines.length * Math.round(fs * 1.3);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H + bandH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, W, H);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, H, W, bandH);
  ctx.fillStyle = '#f8fafc';
  ctx.font = `600 ${fs}px sans-serif`;
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => {
    if (i > 0) ctx.font = `500 ${Math.round(fs * 0.9)}px sans-serif`;
    ctx.fillText(l, pad, H + pad + i * Math.round(fs * 1.3));
  });
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
}

export async function shareProdPhotos(ids) {
  const wanted = (ids && ids.length ? ids : Array.from(_selected));
  if (!wanted.length) { _toast('Select at least one entry with photos.', 'warning'); return; }
  _toast('Preparing photos…', 'info', 1500);
  const db = ensureArray(await sqliteStore.get('mfg_pro_pkr'));
  const photos = await _photoStore();
  const files = [];
  const textLines = [];
  for (const id of wanted) {
    const rec = db.find(r => r && r.id === id);
    if (!rec) continue;
    const keys = (rec.photoKeys || []).filter(k => photos[k]);
    if (!keys.length) continue;
    const store = getStoreLabel(rec.store) || rec.store || '';
    const head = `${store} • ${rec.date || ''}`;
    const detail = `Net ${fmtNum(rec.net || 0)} kg${rec.formulaUnits ? ` • ${fmtNum(rec.formulaUnits)} unit${rec.formulaUnits === 1 ? '' : 's'}` : ''}`;
    textLines.push(`${head} — ${detail}`);
    for (let i = 0; i < keys.length; i++) {
      try {
        const blob = await _captionedBlob(photos[keys[i]], [head, detail]);
        files.push(new File([blob], `production-${rec.date || 'entry'}-${store.replace(/\W+/g, '')}-${files.length + 1}.jpg`, { type: 'image/jpeg' }));
      } catch (e) { console.warn('[prod photo] caption failed', e); }
    }
  }
  if (!files.length) { _toast('No photos found for the selected entries.', 'warning'); return; }
  const text = textLines.join('\n');
  if (navigator.canShare && navigator.canShare({ files })) {
    try {
      await navigator.share({ files, title: 'Production photos', text });
      _toast(`Shared ${files.length} photo${files.length === 1 ? '' : 's'}`, 'success');
      clearProdPhotoSelection();
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') { _toast('Share cancelled', 'info'); return; }
      console.warn('[prod photo] Web Share failed, falling back', err);
    }
  }
  files.forEach((f, i) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(f);
    a.download = f.name;
    document.body.appendChild(a);
    setTimeout(() => { a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, i * 250);
  });
  _toast(`Saved ${files.length} photo${files.length === 1 ? '' : 's'} — opening WhatsApp…`, 'success', 4000);
  setTimeout(() => window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank'), files.length * 250 + 500);
  clearProdPhotoSelection();
}

Object.assign(window, {
  addProdPhotos, addProdPhotoDataUrl, openProdPhotoCapture, toggleProdPhotoPanel, removeProdPhoto, openProdPhoto, toggleProdPhotoSelect, clearProdPhotoSelection, shareProdPhotos, resetProdPhotos
});

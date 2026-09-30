const Cap = window.Capacitor;
export const isNative = !!(Cap && typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform());
const P = () => (window.Capacitor && window.Capacitor.Plugins) || {};

function toast(msg, type = 'info', ms = 3000) {
  if (typeof window.showToast === 'function') window.showToast(msg, type, ms);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function safeName(name) {
  return String(name || 'file').replace(/[^\w.\-() ]+/g, '_').slice(0, 80) || 'file';
}

async function writeCacheFile(name, blob) {
  const { Filesystem } = P();
  const path = `share/${Date.now().toString(36)}-${safeName(name)}`;
  const res = await Filesystem.writeFile({ path, data: await blobToBase64(blob), directory: 'CACHE', recursive: true });
  return res.uri;
}

export async function nativeShareFiles(files, { title, text } = {}) {
  const { Share } = P();
  const uris = [];
  for (const f of files) uris.push(await writeCacheFile(f.name, f));
  try {
    await Share.share({ title: title || undefined, text: text || undefined, files: uris, dialogTitle: title || 'Share' });
  } catch (e) {
    const msg = String((e && e.message) || e || '');
    if (/cancel/i.test(msg)) {
      const err = new Error('Share cancelled');
      err.name = 'AbortError';
      throw err;
    }
    throw e;
  }
}

function installShareBridge() {
  const canShare = (data) => !!(data && (data.files ? data.files.length > 0 : (data.text || data.url || data.title)));
  try {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: canShare });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data = {}) => {
        if (data.files && data.files.length) return nativeShareFiles(data.files, data);
        const { Share } = P();
        try {
          await Share.share({ title: data.title, text: data.text, url: data.url, dialogTitle: data.title || 'Share' });
        } catch (e) {
          if (/cancel/i.test(String((e && e.message) || e))) { const err = new Error('Share cancelled'); err.name = 'AbortError'; throw err; }
          throw e;
        }
      }
    });
  } catch (_) {}
}

async function saveAndShareBlob(blob, name) {
  try {
    await nativeShareFiles([new File([blob], name, { type: blob.type || 'application/octet-stream' })], { title: name });
    toast('File ready — choose where to save or send it.', 'success', 3500);
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    console.warn('[native] save failed', e);
    toast('Could not save the file on this device.', 'error');
  }
}

function installDownloadBridge() {
  const proto = HTMLAnchorElement.prototype;
  const origClick = proto.click;
  const origDispatch = proto.dispatchEvent;
  const intercept = (a) => {
    const href = a.href || '';
    if (!a.hasAttribute('download') || !(href.startsWith('blob:') || href.startsWith('data:'))) return false;
    const name = a.getAttribute('download') || 'download';
    fetch(href).then(r => r.blob()).then(b => saveAndShareBlob(b, name)).catch(e => console.warn('[native] download bridge', e));
    return true;
  };
  proto.click = function () { if (intercept(this)) return; return origClick.apply(this, arguments); };
  proto.dispatchEvent = function (ev) {
    if (ev && ev.type === 'click' && intercept(this)) return true;
    return origDispatch.apply(this, arguments);
  };
  document.addEventListener('click', (e) => {
    const a = e.target && e.target.closest ? e.target.closest('a[download]') : null;
    if (a && intercept(a)) e.preventDefault();
  }, true);
}

function installExternalLinks() {
  const open = (url) => {
    const { App } = P();
    if (App && typeof App.openUrl === 'function') return App.openUrl({ url }).catch(() => { window.location.href = url; });
    window.location.href = url;
  };
  window.open = function (url) {
    if (!url) return null;
    if (/^(https?:|tel:|mailto:|sms:|whatsapp:|geo:)/i.test(url)) open(url);
    return null;
  };
  document.addEventListener('click', (e) => {
    const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (/^(https?:\/\/|tel:|mailto:|sms:|whatsapp:)/i.test(href) && a.target === '_blank') { e.preventDefault(); open(a.href); }
  }, true);
}

function isVisible(el) {
  return !!el && getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0;
}

let lastBack = 0;
function handleBack() {
  const cam = document.getElementById('photo-capture-modal');
  if (cam && isVisible(cam) && typeof window.closePhotoCapture === 'function') { window.closePhotoCapture(); return; }
  const gc = document.querySelector('.glass-confirm-backdrop:not(.closing) .gc-cancel');
  if (gc) { gc.click(); return; }
  const lb = document.getElementById('photo-lightbox-modal');
  if (lb && isVisible(lb) && typeof window.closePhotoLightbox === 'function') { window.closePhotoLightbox(); return; }
  const banner = document.getElementById('edit-mode-banner');
  if (banner && typeof window.requestCancelEdit === 'function') {
    const openScreens = Array.from(document.querySelectorAll('.standalone-screen')).filter(isVisible);
    if (!openScreens.length) { window.requestCancelEdit(); return; }
  }
  const screens = Array.from(document.querySelectorAll('.standalone-screen')).filter(isVisible);
  if (screens.length) {
    const top = screens.sort((a, b) => (parseInt(getComputedStyle(b).zIndex) || 0) - (parseInt(getComputedStyle(a).zIndex) || 0))[0];
    if (typeof window.closeStandaloneScreen === 'function') { window.closeStandaloneScreen(top.id); return; }
  }
  const sidebar = document.querySelector('.sidebar.open, #sidebar.open, .side-menu.open');
  if (sidebar && typeof window.closeSidebar === 'function') { window.closeSidebar(); return; }
  const now = Date.now();
  if (now - lastBack < 2000) { const { App } = P(); if (App) App.exitApp(); return; }
  lastBack = now;
  toast('Press back again to exit', 'info', 1800);
}

function applyStatusBar() {
  const { StatusBar } = P();
  if (!StatusBar) return;
  const light = document.documentElement.getAttribute('data-theme') === 'light';
  try {
    StatusBar.setStyle({ style: 'DARK' });
    StatusBar.setBackgroundColor({ color: '#1D4ED8' });
  } catch (_) {}
}

function installHaptics() {
  const { Haptics } = P();
  if (!Haptics) return;
  document.addEventListener('click', (e) => {
    const t = e.target && e.target.closest ? e.target.closest('.btn, .tbl-action-btn, .toggle-opt, .glass-confirm-btn') : null;
    if (t) { try { Haptics.impact({ style: 'LIGHT' }); } catch (_) {} }
  }, { passive: true });
}

async function unregisterServiceWorkers() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) await r.unregister();
    }
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch (_) {}
}

if (isNative) {
  document.documentElement.classList.add('is-native', 'is-android');
  installShareBridge();
  installDownloadBridge();
  installExternalLinks();
  installHaptics();
  unregisterServiceWorkers();
  const { App, SplashScreen } = P();
  if (App && typeof App.addListener === 'function') App.addListener('backButton', handleBack);
  applyStatusBar();
  new MutationObserver(applyStatusBar).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.addEventListener('load', () => { if (SplashScreen) setTimeout(() => SplashScreen.hide().catch(() => {}), 150); });
}

window.__isNativeApp = isNative;
window.nativeShareFiles = nativeShareFiles;

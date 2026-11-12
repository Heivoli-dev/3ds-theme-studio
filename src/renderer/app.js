/* 3DS Theme Studio — interface
 * © heivoli-network.fr
 */
'use strict';

const TOP_W = 412, TOP_H = 240, BOT_W = 320, BOT_H = 240;
// Limites (identiques à src/lib/theme.js)
const LIMITS = { body: 0x150000, bgm: 0x337000, preview: 512 * 1024, total: 5 * 1024 * 1024 };
const MAX_IMAGE_SIDE = 2048; // les images importées sont réduites à 2048 px max
const fmtKo = (n) => (n >= 1024 * 1024 ? `${(n / 1048576).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo` : `${Math.ceil(n / 1024).toLocaleString('fr-FR')} Ko`);
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const defaultScreen = (c1, c2) => ({
  mode: 'gradient', color1: c1, color2: c2, angle: 135,
  image: null, fit: 'cover', zoom: 1, ox: 0, oy: 0,
  pattern: 'none', patternOpacity: 0.15, brightness: 0, vignette: 0,
  text: '', textColor: '#ffffff', textSize: 28, textPos: 'center',
});

// Photo de 2DS XL fournie par heivoli-network.fr, écrans calés au pixel
const DEFAULT_DEVICE = {
  photo: 'assets/2ds-xl.png',
  // coins réels des écrans (pixels de l'image 1400×1400) : haut-gauche, haut-droit, bas-droit, bas-gauche
  quads: {
    top: [[246.4, 88.2], [1153.0, 85.2], [1136.5, 636.4], [265.3, 638.9]],
    bottom: [[360.8, 833.6], [1044.7, 831.7], [1033.7, 1325.2], [373.6, 1326.4]],
  },
  top: { x: 18, y: 6, w: 64 }, bottom: { x: 26, y: 59, w: 49 },
};

let state = {
  top: defaultScreen('#ff4d5e', '#6a3cff'),
  bottom: defaultScreen('#1b1f2a', '#3a2a5c'),
  info: { title: 'Mon thème', description: 'Créé avec 3DS Theme Studio', author: 'heivoli-network.fr' },
  icon: { mode: 'auto', image: null },
  bgm: null, // { name, b64 }
  device: JSON.parse(JSON.stringify(DEFAULT_DEVICE)),
  overlay: true, shell: true,
};

let tab = 'top';
const screenOf = () => (tab === 'bottom' ? 'bottom' : 'top');

/* ---------- Canvases hors-écran (taille réelle du thème) ---------- */
const full = {
  top: Object.assign(document.createElement('canvas'), { width: TOP_W, height: TOP_H }),
  bottom: Object.assign(document.createElement('canvas'), { width: BOT_W, height: BOT_H }),
};

const imgCache = new Map();
function getImage(src) {
  if (!src) return null;
  let e = imgCache.get(src);
  if (!e) {
    e = new Image();
    e.onload = () => scheduleRender();
    e.src = src;
    imgCache.set(src, e);
  }
  return e.complete && e.naturalWidth ? e : null;
}

function drawPattern(ctx, w, h, kind, alpha) {
  if (kind === 'none' || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  if (kind === 'dots') {
    for (let y = 0; y < h + 16; y += 16) for (let x = (y / 16) % 2 ? 8 : 0; x < w + 16; x += 16) {
      ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill();
    }
  } else if (kind === 'stripes') {
    ctx.lineWidth = 6;
    for (let x = -h; x < w + h; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + h, h); ctx.stroke(); }
  } else if (kind === 'grid') {
    ctx.lineWidth = 1;
    for (let x = 0.5; x < w; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0.5; y < h; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  } else if (kind === 'checker') {
    for (let y = 0; y < h; y += 20) for (let x = 0; x < w; x += 20) if (((x + y) / 20) % 2 === 0) ctx.fillRect(x, y, 20, 20);
  } else if (kind === 'waves') {
    ctx.lineWidth = 3;
    for (let y = 10; y < h + 20; y += 22) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 4) ctx.lineTo(x, y + Math.sin(x / 18) * 6);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function renderScreen(which) {
  const cfg = state[which];
  const cv = full[which];
  const ctx = cv.getContext('2d');
  const w = cv.width, h = cv.height;
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = cfg.color1;
  ctx.fillRect(0, 0, w, h);

  if (cfg.mode === 'gradient') {
    const a = (cfg.angle * Math.PI) / 180;
    const r = Math.abs(w * Math.cos(a)) / 2 + Math.abs(h * Math.sin(a)) / 2;
    const cx = w / 2, cy = h / 2;
    const g = ctx.createLinearGradient(cx - Math.cos(a) * r, cy - Math.sin(a) * r, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    g.addColorStop(0, cfg.color1);
    g.addColorStop(1, cfg.color2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else if (cfg.mode === 'image') {
    const img = getImage(cfg.image);
    if (img) {
      const iw = img.naturalWidth, ih = img.naturalHeight;
      let dw, dh;
      if (cfg.fit === 'stretch') { dw = w; dh = h; }
      else {
        const s = cfg.fit === 'cover' ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih);
        dw = iw * s; dh = ih * s;
      }
      dw *= cfg.zoom; dh *= cfg.zoom;
      const dx = (w - dw) / 2 + (cfg.ox * Math.max(dw, w)) / 2;
      const dy = (h - dh) / 2 + (cfg.oy * Math.max(dh, h)) / 2;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, dx, dy, dw, dh);
    }
  }

  drawPattern(ctx, w, h, cfg.pattern, cfg.patternOpacity);

  if (cfg.brightness) {
    ctx.fillStyle = cfg.brightness > 0 ? `rgba(255,255,255,${cfg.brightness * 0.6})` : `rgba(0,0,0,${-cfg.brightness * 0.75})`;
    ctx.fillRect(0, 0, w, h);
  }
  if (cfg.vignette > 0) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.hypot(w, h) / 2);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${cfg.vignette * 0.85})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  if (cfg.text) {
    ctx.font = `800 ${cfg.textSize}px -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = cfg.textColor;
    ctx.shadowColor = 'rgba(0,0,0,.55)';
    ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    const y = cfg.textPos === 'top' ? cfg.textSize * 0.8 + 18 : cfg.textPos === 'bottom' ? h - cfg.textSize * 0.8 - 8 : h / 2;
    ctx.fillText(cfg.text, w / 2, y, w - 20);
  }
  ctx.restore();
}

function blit() {
  // L'écran du haut affiche 400 px au centre de l'image de 412 px
  for (const id of ['cvTop', 'cvTopPh']) $('#' + id).getContext('2d').drawImage(full.top, 6, 0, 400, 240, 0, 0, 400, 240);
  for (const id of ['cvBottom', 'cvBottomPh']) {
    const c = $('#' + id).getContext('2d');
    c.clearRect(0, 0, 320, 240);
    c.drawImage(full.bottom, 0, 0);
  }
  renderIcon($('#iconCanvas'), 48);
}

function renderIcon(cv, size) {
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingQuality = 'high';
  if (state.icon.mode === 'image' && getImage(state.icon.image)) {
    const img = getImage(state.icon.image);
    const s = Math.max(size / img.naturalWidth, size / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  } else {
    ctx.drawImage(full.top, (TOP_W - TOP_H) / 2, 0, TOP_H, TOP_H, 0, 0, size, size);
  }
}

let raf = 0;
function scheduleRender() {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    renderScreen('top');
    renderScreen('bottom');
    blit();
    scheduleMeasure();
  });
}

/* ---------- Panneau ---------- */
const SWATCHES = ['#ff4d5e', '#ff8a4c', '#ffd23f', '#3ddc97', '#1fb6ff', '#6a3cff', '#d63cff', '#ffffff',
  '#0e0f14', '#26303f', '#3b4a6b', '#1d5c4c', '#7a1f2b', '#f4b6c2', '#a8e6ff', '#c7b8ff'];

function syncPanel() {
  const isScreen = tab === 'top' || tab === 'bottom';
  $('#screenEditor').classList.toggle('hidden', !isScreen);
  $('#infoEditor').classList.toggle('hidden', tab !== 'info');
  $('#musicEditor').classList.toggle('hidden', tab !== 'music');
  $$('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  $$('.screen').forEach((s) => s.classList.toggle('selected', isScreen && s.dataset.screen === tab));

  if (isScreen) {
    const cfg = state[tab];
    $$('#screenEditor [data-k]').forEach((el) => {
      const v = cfg[el.dataset.k];
      if (el.type === 'range') el.value = v; else el.value = v ?? '';
    });
    $$('#screenEditor [data-o]').forEach((o) => {
      const k = o.dataset.o, v = cfg[k];
      o.textContent = k === 'angle' ? `${v}°` : k === 'zoom' ? `${(+v).toFixed(2)}×` : k === 'textSize' ? `${v}px` : `${Math.round(v * 100)}%`;
    });
    $$('#modeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.mode === cfg.mode));
    $$('#fitSeg button').forEach((b) => b.classList.toggle('on', b.dataset.fit === cfg.fit));
    $$('#textPosSeg button').forEach((b) => b.classList.toggle('on', b.dataset.tp === cfg.textPos));
    $$('#screenEditor [data-show]').forEach((el) => el.classList.toggle('hidden', !el.dataset.show.split(' ').includes(cfg.mode)));
    const drop = $('#drop');
    drop.classList.toggle('has-img', !!cfg.image);
    drop.style.backgroundImage = cfg.image ? `url("${cfg.image}")` : '';
    $('#dropHint').textContent = tab === 'top' ? 'Format idéal : 412 × 240 px' : 'Format idéal : 320 × 240 px';
    $('#btnCopyScreen').textContent = tab === 'top' ? "Copier ce fond vers l'écran du bas" : "Copier ce fond vers l'écran du haut";
  }
  $('#title').value = state.info.title;
  $('#description').value = state.info.description;
  $('#author').value = state.info.author;
  $$('#iconSeg button').forEach((b) => b.classList.toggle('on', b.dataset.icon === state.icon.mode));
  $('#bgmName').textContent = state.bgm ? `${state.bgm.name} (${(state.bgm.size / 1024 / 1024).toFixed(2)} Mo)` : 'Aucune musique — le thème sera silencieux';
  $('#dropBgm').classList.toggle('has-music', !!state.bgm);
  $('#optOverlay').checked = state.overlay;
  $('#optShell').checked = state.shell;
  document.body.classList.toggle('no-overlay', !state.overlay);
  $('#device').classList.toggle('bare', !state.shell);
  syncPhoto();
}

function setScreen(k, v) {
  state[screenOf()][k] = v;
  syncPanel();
  scheduleRender();
}

function initPanel() {
  $('#year').textContent = new Date().getFullYear();
  $$('#tabs button').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; syncPanel(); }));
  $$('#screenEditor [data-k]').forEach((el) => {
    el.addEventListener('input', () => setScreen(el.dataset.k, el.type === 'range' ? parseFloat(el.value) : el.value));
  });
  $$('#modeSeg button').forEach((b) => (b.onclick = () => setScreen('mode', b.dataset.mode)));
  $$('#fitSeg button').forEach((b) => (b.onclick = () => { setScreen('fit', b.dataset.fit); setScreen('zoom', 1); setScreen('ox', 0); setScreen('oy', 0); }));
  $$('#textPosSeg button').forEach((b) => (b.onclick = () => setScreen('textPos', b.dataset.tp)));
  const sw = $('#swatches');
  SWATCHES.forEach((c) => {
    const b = document.createElement('button');
    b.style.background = c;
    b.title = c;
    b.onclick = (e) => setScreen(e.shiftKey && state[screenOf()].mode === 'gradient' ? 'color2' : 'color1', c);
    sw.appendChild(b);
  });
  sw.title = 'Clic : couleur 1 — Maj + clic : couleur 2';

  setupDrop($('#drop'), $('#fileImage'), async (file) => {
    const url = await limitImage(await readAsDataURL(file));
    if (!url) return toast('Image illisible', true);
    Object.assign(state[screenOf()], { image: url, mode: 'image', zoom: 1, ox: 0, oy: 0 });
    syncPanel(); scheduleRender();
  });

  $('#btnCopyScreen').onclick = () => {
    const from = screenOf(), to = from === 'top' ? 'bottom' : 'top';
    state[to] = JSON.parse(JSON.stringify(state[from]));
    scheduleRender();
    toast('Fond copié');
  };

  $('#title').oninput = (e) => (state.info.title = e.target.value);
  $('#description').oninput = (e) => (state.info.description = e.target.value);
  $('#author').oninput = (e) => (state.info.author = e.target.value);
  $$('#iconSeg button').forEach((b) => (b.onclick = () => {
    if (b.dataset.icon === 'image') $('#fileIcon').click();
    else { state.icon.mode = 'auto'; syncPanel(); scheduleRender(); }
  }));
  $('#fileIcon').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    state.icon = { mode: 'image', image: await limitImage(await readAsDataURL(f), 512) };
    e.target.value = '';
    syncPanel(); scheduleRender();
  };

  setupDrop($('#dropBgm'), $('#fileBgm'), async (file) => {
    if (!/\.bcstm$/i.test(file.name)) return toast('Le fichier doit être au format .bcstm', true);
    if (file.size > LIMITS.bgm) return toast(`Musique trop lourde : ${fmtKo(file.size)} (maximum ${fmtKo(LIMITS.bgm)}). Raccourcissez-la ou baissez sa qualité.`, true);
    const buf = new Uint8Array(await file.arrayBuffer());
    state.bgm = { name: file.name, size: file.size, b64: bytesToB64(buf) };
    syncPanel(); scheduleMeasure();
  });
  $('#btnRemoveBgm').onclick = () => { state.bgm = null; syncPanel(); scheduleMeasure(); };

  $('#optOverlay').onchange = (e) => { state.overlay = e.target.checked; syncPanel(); };
  $('#optShell').onchange = (e) => { state.shell = e.target.checked; syncPanel(); };
}

function setupDrop(zone, input, onFile) {
  zone.onclick = () => input.click();
  input.onchange = () => { if (input.files[0]) onFile(input.files[0]); input.value = ''; };
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault(); e.stopPropagation(); zone.classList.remove('over');
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
    else if (zone.id !== 'dropBgm') imageFromTransfer(e.dataTransfer).then((u) => u && applyImage(screenOf(), u));
  });
}

/* ---------- Images depuis le web / le presse-papiers (sans téléchargement manuel) ---------- */
function urlFromTransfer(dt) {
  const html = dt.getData('text/html');
  const m = html && html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m) return m[1].replace(/&amp;/g, '&');
  const uri = (dt.getData('text/uri-list') || dt.getData('text/plain') || '').split('\n').find((l) => l && !l.startsWith('#'));
  return uri ? uri.trim() : null;
}
async function imageFromTransfer(dt) {
  const url = urlFromTransfer(dt);
  if (!url) return null;
  if (url.startsWith('data:image/')) return url;
  if (!/^https?:\/\//i.test(url)) return null;
  toast("Récupération de l'image…");
  try { return await window.studio.fetchImage(url); }
  catch (e) { toast(e.message, true); return null; }
}
async function applyImage(which, raw) {
  const url = await limitImage(raw);
  if (!url) return toast('Image illisible', true);
  if (tab === 'info') { state.icon = { mode: 'image', image: url }; syncPanel(); scheduleRender(); return toast('Icône mise à jour'); }
  tab = which;
  Object.assign(state[which], { image: url, mode: 'image', zoom: 1, ox: 0, oy: 0 });
  syncPanel(); scheduleRender();
  toast(which === 'top' ? "Image appliquée à l'écran du haut" : "Image appliquée à l'écran du bas");
}

document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', async (e) => {
  e.preventDefault();
  const scr = e.target.closest && e.target.closest('.screen');
  const which = scr ? scr.dataset.screen : screenOf();
  const f = e.dataTransfer.files[0];
  const url = f && f.type.startsWith('image/') ? await readAsDataURL(f) : await imageFromTransfer(e.dataTransfer);
  if (url) applyImage(which, url);
});
document.addEventListener('paste', async (e) => {
  if (e.target.matches && e.target.matches('input[type=text], textarea')) return;
  const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'));
  e.preventDefault();
  const url = item ? await readAsDataURL(item.getAsFile()) : await imageFromTransfer(e.clipboardData);
  if (url) applyImage(screenOf(), url);
  else toast("Copiez une image (clic droit → Copier l'image) puis recollez", true);
});

/** Réduit une image trop grande (côté max 2048 px) pour garder thèmes et projets légers. */
function limitImage(url, max = MAX_IMAGE_SIDE) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
      if (k === 1 && url.length < 4 * 1024 * 1024) return resolve(url);
      const cv = Object.assign(document.createElement('canvas'), { width: Math.round(w * k), height: Math.round(h * k) });
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      const png = /^data:image\/(png|gif|webp)/.test(url) ? cv.toDataURL('image/png') : null;
      resolve(png && png.length < 4 * 1024 * 1024 ? png : cv.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

const readAsDataURL = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = rej;
  r.readAsDataURL(file);
});
function bytesToB64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
function b64ToBytes(b64) {
  const s = atob(b64);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

/* ---------- Aperçu : sélection, glisser, zoom ---------- */
function initStage() {
  // grille d'icônes du menu HOME (schéma)
  const grid = $('#hmGrid');
  const tiles = ['#f2a65a', '#6cc3e8', '#9b8cf0', '#7fd18b', '#f07a8a'];
  for (let i = 0; i < 24; i++) {
    const c = document.createElement('i');
    if (i < tiles.length) c.style.setProperty('--c', tiles[i]); else c.className = 'empty';
    if (i === 0) c.classList.add('sel');
    grid.appendChild(c);
  }
  // copie des repères sur les écrans de la photo
  $('#phTop').appendChild($('.home-top').cloneNode(true));
  $('#phBottom').appendChild($('.home-bottom').cloneNode(true));

  const tick = () => {
    const d = new Date();
    const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    $$('.hm-clock').forEach((e) => (e.textContent = t.replace(':', ' ')));
    const day = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'][d.getDay()];
    $$('.hm-date').forEach((e) => (e.textContent = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} (${day})`));
  };
  tick(); setInterval(tick, 15000);

  $$('.screen').forEach((el) => {
    el.addEventListener('mousedown', (e) => {
      if (document.body.classList.contains('calibrating')) return;
      const which = el.dataset.screen;
      tab = which; syncPanel();
      const cfg = state[which];
      if (cfg.mode !== 'image' || !cfg.image) return;
      const rect = el.getBoundingClientRect();
      const sx = e.clientX, sy = e.clientY, ox = cfg.ox, oy = cfg.oy;
      el.style.cursor = 'grabbing';
      const move = (ev) => {
        cfg.ox = clamp(ox + ((ev.clientX - sx) / rect.width) * 2 / cfg.zoom, -1.5, 1.5);
        cfg.oy = clamp(oy + ((ev.clientY - sy) / rect.height) * 2 / cfg.zoom, -1.5, 1.5);
        scheduleRender();
      };
      const up = () => { el.style.cursor = ''; removeEventListener('mousemove', move); removeEventListener('mouseup', up); syncPanel(); };
      addEventListener('mousemove', move);
      addEventListener('mouseup', up);
    });
    el.addEventListener('wheel', (e) => {
      const cfg = state[el.dataset.screen];
      if (cfg.mode !== 'image') return;
      e.preventDefault();
      cfg.zoom = clamp(cfg.zoom * (e.deltaY < 0 ? 1.06 : 1 / 1.06), 0.5, 4);
      tab = el.dataset.screen;
      syncPanel(); scheduleRender();
    }, { passive: false });
  });

  // Mise à l'échelle du boîtier
  const wrap = $('#deviceWrap');
  new ResizeObserver(() => {
    const s = Math.min((wrap.clientWidth - 20) / 540, (wrap.clientHeight - 20) / 650, 1.5);
    $('#device').style.transform = `scale(${Math.max(0.4, s)})`;
  }).observe(wrap);

  // Photo de console fournie par l'utilisateur
  $('#btnPhoto').onclick = () => $('#filePhoto').click();
  $('#filePhoto').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    state.device.photo = await limitImage(await readAsDataURL(f), 2400);
    e.target.value = '';
    syncPanel();
    document.body.classList.add('calibrating');
    $('#btnCalib').textContent = 'Terminer le calage';
    toast('Déplacez et redimensionnez les deux cadres sur les écrans de votre photo');
  };
  $('#btnPhotoReset').onclick = () => { state.device.photo = null; document.body.classList.remove('calibrating'); syncPanel(); };
  $('#btnDefaultPhoto').onclick = () => { state.device = JSON.parse(JSON.stringify(DEFAULT_DEVICE)); document.body.classList.remove('calibrating'); syncPanel(); };
  $('#photoImg').addEventListener('load', syncPhoto);
  new ResizeObserver(() => syncPhoto()).observe($('#photoImg'));
  // Les repères du menu HOME suivent la taille des écrans de la photo
  for (const [id, w] of [['#phTop', 400], ['#phBottom', 320]]) {
    const el = $(id);
    new ResizeObserver(() => {
      const ov = el.querySelector('.overlay');
      if (!ov) return;
      Object.assign(ov.style, { width: w + 'px', height: '240px', inset: 'auto', left: '0', top: '0', transformOrigin: '0 0', transform: `scale(${el.clientWidth / w})` });
    }).observe(el);
  }
  $('#btnCalib').onclick = () => {
    const on = document.body.classList.toggle('calibrating');
    $('#btnCalib').textContent = on ? 'Terminer le calage' : 'Caler les écrans';
  };
  for (const [id, key] of [['#phTop', 'top'], ['#phBottom', 'bottom']]) {
    const el = $(id);
    el.addEventListener('mousedown', (e) => {
      if (!document.body.classList.contains('calibrating')) return;
      e.preventDefault();
      const box = $('#photoDevice').getBoundingClientRect();
      const d = state.device[key];
      const resize = e.target.classList.contains('calib-handle');
      const sx = e.clientX, sy = e.clientY, start = { ...d };
      const move = (ev) => {
        const dx = ((ev.clientX - sx) / box.width) * 100, dy = ((ev.clientY - sy) / box.height) * 100;
        if (resize) d.w = clamp(start.w + dx, 5, 100);
        else { d.x = clamp(start.x + dx, -20, 100); d.y = clamp(start.y + dy, -20, 100); }
        syncPhoto();
      };
      const up = () => { removeEventListener('mousemove', move); removeEventListener('mouseup', up); };
      addEventListener('mousemove', move);
      addEventListener('mouseup', up);
    });
  }
}

function syncPhoto() {
  const has = !!state.device.photo;
  $('#device').classList.toggle('hidden', has);
  $('#photoDevice').classList.toggle('hidden', !has);
  $('#btnPhotoReset').classList.toggle('hidden', !has);
  $('#btnDefaultPhoto').classList.toggle('hidden', state.device.photo === DEFAULT_DEVICE.photo);
  $('#btnCalib').classList.toggle('hidden', !has || state.device.photo === DEFAULT_DEVICE.photo);
  $('#optShell').parentElement.classList.toggle('hidden', has);
  if (!has) return;
  const img = $('#photoImg');
  if (img.getAttribute('src') !== state.device.photo) img.src = state.device.photo;
  const quads = state.device.photo === DEFAULT_DEVICE.photo ? DEFAULT_DEVICE.quads : null;
  const place = (el, d, ar, w, quad) => {
    if (quad && img.naturalWidth && img.clientWidth) {
      // perspective exacte : rectangle w×240 projeté sur les 4 coins de l'écran
      const k = img.clientWidth / img.naturalWidth;
      Object.assign(el.style, { left: '0', top: '0', width: w + 'px', height: '240px', aspectRatio: 'auto', transformOrigin: '0 0',
        transform: quadTransform(w, 240, quad.map(([x, y]) => [x * k, y * k])) });
      return;
    }
    Object.assign(el.style, { left: d.x + '%', top: d.y + '%', width: d.w + '%', height: 'auto', aspectRatio: ar, transform: 'none' });
  };
  place($('#phTop'), state.device.top, '400 / 240', 400, quads && quads.top);
  place($('#phBottom'), state.device.bottom, '320 / 240', 320, quads && quads.bottom);
}

// Homographie : rectangle (0,0)-(w,h) -> quadrilatère, en matrix3d CSS
function quadTransform(w, h, q) {
  const src = [[0, 0], [w, 0], [w, h], [0, h]];
  const A = [], B = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = q[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); B.push(v);
  }
  // élimination de Gauss
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [B[c], B[p]] = [B[p], B[c]];
    for (let r = 0; r < 8; r++) if (r !== c) {
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
      B[r] -= f * B[c];
    }
  }
  const H = B.map((b, i) => b / A[i][i]);
  return `matrix3d(${H[0]},${H[3]},0,${H[6]},${H[1]},${H[4]},0,${H[7]},0,0,1,0,${H[2]},${H[5]},0,1)`;
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------- Export ---------- */
function pixels(cv) {
  return new Uint8Array(cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data.buffer);
}
function iconPixels(size) {
  const cv = Object.assign(document.createElement('canvas'), { width: size, height: size });
  renderIcon(cv, size);
  return pixels(cv);
}
async function previewPng() {
  const cv = Object.assign(document.createElement('canvas'), { width: 412, height: 480 });
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 412, 480);
  ctx.drawImage(full.top, 0, 0);
  ctx.drawImage(full.bottom, 46, 240);
  const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

async function build() {
  if (!state.info.title.trim()) throw new Error('Donnez un nom à votre thème (onglet Infos)');
  return window.studio.buildTheme(await makePayload());
}

async function makePayload() {
  renderScreen('top'); renderScreen('bottom');
  return {
    top: pixels(full.top),
    bottom: pixels(full.bottom),
    icon48: iconPixels(48),
    icon24: iconPixels(24),
    preview: await previewPng(),
    bgm: state.bgm ? b64ToBytes(state.bgm.b64) : null,
    title: state.info.title.trim(),
    description: state.info.description.trim(),
    author: state.info.author.trim(),
  };
}

let measureTimer = 0, measureSeq = 0;
function scheduleMeasure() {
  clearTimeout(measureTimer);
  measureTimer = setTimeout(async () => {
    const seq = ++measureSeq;
    const r = await window.studio.measureTheme(await makePayload());
    if (seq === measureSeq) showSize(r);
  }, 700);
}
function showSize(r) {
  const m = $('#sizeMeter');
  if (!r) return;
  const s = r.sizes || {};
  const ratio = r.ok ? Math.max(s.body / LIMITS.body, s.bgm / LIMITS.bgm, s.total / LIMITS.total) : 1;
  m.classList.toggle('over', !r.ok);
  m.classList.toggle('warn', r.ok && ratio > 0.8);
  $('#sizeBar').style.width = `${Math.min(100, Math.max(2, ratio * 100))}%`;
  $('#sizeText').textContent = r.ok ? `${fmtKo(s.total)} / ${fmtKo(LIMITS.total)}` : 'Trop lourd';
  $('#sizeDetail').textContent = r.ok
    ? `Images ${fmtKo(s.body)} · Musique ${s.bgm ? fmtKo(s.bgm) : '—'} · Aperçu ${fmtKo(s.preview)}`
    : r.error;
}

function initActions() {
  $('#btnExport').onclick = async () => {
    try {
      await build();
      const r = await window.studio.saveTheme();
      if (r.ok) toast('Thème enregistré ✔ — copiez le .zip dans /Themes/ de la carte SD');
    } catch (e) { toast(e.message, true); }
  };

  const openQr = async (ip) => {
    try {
      const b = await build();
      const r = await window.studio.startQr(ip);
      $('#qrBox').innerHTML = r.svg;
      $('#qrUrl').textContent = r.url;
      const sel = $('#qrIp');
      sel.innerHTML = r.ips.map((i) => `<option value="${i.address}" ${i.address === r.ip ? 'selected' : ''}>${i.address} (${i.ifname})</option>`).join('');
      $('#qrStatus').textContent = `Serveur local actif — « ${b.name}.zip » (${(b.size / 1024).toFixed(0)} Ko). Gardez cette fenêtre ouverte.`;
      $('#qrModal').classList.remove('hidden');
    } catch (e) { toast(e.message, true); }
  };
  $('#btnQr').onclick = () => openQr();
  $('#qrIp').onchange = (e) => openQr(e.target.value);
  $('#qrClose').onclick = () => { $('#qrModal').classList.add('hidden'); window.studio.stopQr(); };
  window.studio.onDownloaded((d) => {
    $('#qrStatus').textContent = `✔ Thème téléchargé par la console (${String(d.from).replace('::ffff:', '')})`;
    toast('La 3DS a bien reçu le thème !');
  });

  $('#btnSaveProject').onclick = async () => {
    const ok = await window.studio.saveProject(JSON.stringify({ app: '3ds-theme-studio', version: 1, copyright: 'heivoli-network.fr', state }));
    if (ok) toast('Projet enregistré');
  };
  $('#btnOpen').onclick = async () => {
    const txt = await window.studio.openProject();
    if (!txt) return;
    try {
      const p = JSON.parse(txt);
      if (p.app !== '3ds-theme-studio') throw new Error();
      state = deepMerge(state, p.state);
      syncPanel(); scheduleRender();
      toast('Projet ouvert');
    } catch { toast('Fichier de projet invalide', true); }
  };
}

function deepMerge(base, over) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(over || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' ? deepMerge(base[k], v) : v;
  }
  return out;
}

let toastTimer;
function toast(msg, err = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('err', err);
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 3800);
}

/* ---------- Mises à jour ---------- */
function initUpdates() {
  let info = null;
  const skipped = () => { try { return localStorage.getItem('skipVersion'); } catch { return null; } };
  const show = (u) => {
    info = u;
    $('#updVersion').textContent = `v${u.latest}`;
    $('#updCurrent').textContent = `v${u.current}`;
    $('#updateBar').classList.remove('hidden');
    document.body.classList.add('has-update');
  };
  const hide = () => { $('#updateBar').classList.add('hidden'); document.body.classList.remove('has-update'); };
  window.studio.appVersion().then((v) => ($('#appVersion').textContent = `v${v}`));
  window.studio.onUpdate((u) => { if (skipped() !== u.latest) show(u); });
  $('#updDownload').onclick = () => { window.studio.openUpdate(info.url); toast('Téléchargement lancé dans votre navigateur. Installez la nouvelle version, puis relancez l’appli.'); };
  $('#updNotes').onclick = () => window.studio.openUpdate(info.page);
  $('#updLater').onclick = hide;
  $('#updSkip').onclick = () => { try { localStorage.setItem('skipVersion', info.latest); } catch {} hide(); };
  $('#btnCheckUpdate').onclick = async () => {
    toast('Recherche de mises à jour…');
    const r = await window.studio.checkUpdate();
    if (!r.ok) return toast(r.error, true);
    if (r.newer) { try { localStorage.removeItem('skipVersion'); } catch {} show(r); toast(`La version v${r.latest} est disponible !`); }
    else toast(`Vous avez la dernière version (v${r.current}) ✔`);
  };
}

initPanel();
initStage();
initActions();
initUpdates();
syncPanel();
scheduleRender();

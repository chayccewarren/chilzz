import { games as base } from './games.js';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const okUrl = u => { try { return ['http:', 'https:'].includes(new URL(u).protocol); } catch { return false; } };
/* ---- storage (versioned, corruption-safe) ---- */
const DEF = { v: 1, theme: 'dark', accent: '#6d7cff', wall: '', font: 'Inter, system-ui, sans-serif', size: 14, fast: false, name: 'Player', pin: '', fav: [], recent: [], imported: [], proxy: '', dim: 0, widget: true, align: 'center', auto: false, alpha: 0.85, tbh: 48, pos: {}, cbg: '', ctext: '', rad: 10, sound: false, pinned: ['games', 'proxy', 'settings', 'files'], notes: [] };
const load = () => { try { const o = JSON.parse(localStorage.getItem('chilzz') || '{}'); return { ...DEF, ...(o && o.v === 1 ? o : {}) }; } catch { return { ...DEF }; } };
let S = load();
const save = () => { try { localStorage.setItem('chilzz', JSON.stringify(S)); } catch { toast('Storage is full or blocked.'); } };
const idb = (m, k, v) => new Promise(res => { const r = indexedDB.open('chilzz', 1); r.onupgradeneeded = () => r.result.createObjectStore('a'); r.onerror = () => res(null);
  r.onsuccess = () => { const s = r.result.transaction('a', m).objectStore('a'); const q = m === 'readwrite' ? s.put(v, k) : s.get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }; });
function toast(t) { const d = document.createElement('div'); d.className = 'win'; d.style.cssText = 'right:16px;bottom:64px;left:auto;top:auto;padding:10px 14px;min-height:0;z-index:99999;resize:none'; d.textContent = t; document.body.append(d); setTimeout(() => d.remove(), 3000); }
/* ---- theme ---- */
async function applyTheme() {
  const r = document.documentElement; r.dataset.theme = S.theme; r.style.setProperty('--acc', S.accent); r.style.setProperty('--font', S.font); r.style.setProperty('--fs', S.size + 'px'); r.style.setProperty('--dim', S.dim); r.style.setProperty('--r', S.rad + 'px'); r.style.setProperty('--tba', S.alpha);
  for (const k of ['bg', 'text']) S['c' + k] ? r.style.setProperty('--' + k, S['c' + k]) : r.style.removeProperty('--' + k);
  const tb = $('#taskbar'); tb.style.height = S.tbh + 'px'; tb.classList.toggle('auto', S.auto); $('#tasks').style.justifyContent = S.align === 'left' ? 'flex-start' : 'center';
  let w = S.wall; if (w === 'idb') { const b = await idb('readonly', 'wall'); w = b ? URL.createObjectURL(b) : ''; }
  for (const el of [$('#desktop'), $('#login')]) el.style.backgroundImage = (w && okUrl(w)) || w.startsWith('blob:') ? `url("${w}")` : '';
}
/* ---- window manager ---- */
let z = 10, active = null; const wins = {};
function openWin(id, title, render, w = 820, h = 520) {
  if (wins[id]) { wins[id].classList.remove('min'); focus(id); return wins[id]; }
  const n = Object.keys(wins).length, el = document.createElement('div'); el.className = 'win';
  el.style.cssText = `left:${70 + n * 28}px;top:${40 + n * 28}px;width:${Math.min(w, innerWidth - 20)}px;height:${Math.min(h, innerHeight - 80)}px`;
  el.innerHTML = `<div class="tb"><b>${esc(title)}</b><span><button data-a="min" aria-label="Minimize">&minus;</button><button data-a="max" aria-label="Maximize">&#9633;</button><button data-a="x" aria-label="Close">&times;</button></span></div><div class="body"></div>`;
  el.dataset.title = title; wins[id] = el; $('#windows').append(el); render($('.body', el), el); focus(id);
  el.addEventListener('pointerdown', () => focus(id));
  $('.tb', el).addEventListener('click', e => { const a = e.target.dataset.a; if (a === 'min') { el.classList.add('min'); tasks(); } if (a === 'max') el.classList.toggle('max'); if (a === 'x') { el.remove(); delete wins[id]; tasks(); } });
  $('.tb', el).addEventListener('pointerdown', e => { if (e.target.closest('button') || el.classList.contains('max')) return; const dx = e.clientX - el.offsetLeft, dy = e.clientY - el.offsetTop;
    const mv = ev => { el.style.left = Math.max(0, ev.clientX - dx) + 'px'; el.style.top = Math.max(0, ev.clientY - dy) + 'px'; }; const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up); });
  return el;
}
function focus(id) { active = id; wins[id].style.zIndex = ++z; tasks(); }
function tasksOld() { $('#tasks').innerHTML = ''; for (const id in wins) { const b = document.createElement('button'); b.textContent = wins[id].dataset.title; b.className = 'run' + (id === active && !wins[id].classList.contains('min') ? ' on' : '');
  b.onclick = () => { const w = wins[id]; if (id === active && !w.classList.contains('min')) w.classList.add('min'); else w.classList.remove('min'); focus(id); }; $('#tasks').append(b); } }
/* ---- Chilzz Games ---- */
const allGames = () => [...base.filter(g => g.enabled && okUrl(g.url)), ...S.imported];
function gamesApp(body) {
  let view = 'lib', q = '', cat = '', editId = null;
  const importForm = () => `<form id="imp" class="set"><h3>${editId ? 'Edit' : 'Import'} game</h3>${['title', 'url', 'description', 'cover', 'category'].map(k => `<label>${k[0].toUpperCase() + k.slice(1)}<input name="${k}" value="${esc(S.imported.find(g => g.id === editId)?.[k])}" ${k === 'title' || k === 'url' ? 'required' : ''}></label>`).join('')}<button>Save game</button></form>`;
  const draw = () => {
    let list = allGames(); if (view === 'fav') list = list.filter(g => S.fav.includes(g.id)); if (view === 'recent') list = S.recent.map(i => list.find(g => g.id === i)).filter(Boolean);
    if (q) list = list.filter(g => (g.title + g.description + g.category).toLowerCase().includes(q.toLowerCase())); if (cat) list = list.filter(g => g.category === cat);
    if (view !== 'recent') list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    const cats = [...new Set(allGames().map(g => g.category))];
    body.innerHTML = `<div class="layout"><nav class="side">${[['lib', 'Library'], ['fav', 'Favorites'], ['recent', 'Recently played'], ['imp', 'Import game']].map(([k, l]) => `<button data-v="${k}" class="${view === k ? 'on' : ''}">${l}</button>`).join('')}</nav><div class="main">${view === 'imp' ? importForm() :
      `<div class="row"><input id="gq" placeholder="Search games" value="${esc(q)}" aria-label="Search games"><select id="gc" aria-label="Category"><option value="">All categories</option>${cats.map(c => `<option ${c === cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>` +
      (list.length ? `<div class="grid">${list.map(g => `<div class="card"><div class="cv">${g.cover && okUrl(g.cover) ? `<img loading="lazy" decoding="async" referrerpolicy="no-referrer" src="${esc(g.cover)}" alt="">` : esc(g.title[0])}</div><div class="t"><h4>${esc(g.title)}</h4><p>${esc(g.category)} &middot; ${esc(g.description)}</p><div class="row"><button data-p="${esc(g.id)}">Play</button><button class="ghost" data-f="${esc(g.id)}">${S.fav.includes(g.id) ? 'Unfavorite' : 'Favorite'}</button>${g.imported ? `<button class="ghost" data-e="${esc(g.id)}">Edit</button><button class="ghost" data-d="${esc(g.id)}">Remove</button>` : ''}</div></div></div>`).join('')}</div>`
        : `<div class="empty">No games here yet. Enable a slot in js/games.js, or use Import game.</div>`)}</div></div>`;
    body.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { view = b.dataset.v; editId = null; draw(); });
    const gq = $('#gq', body); if (gq) { gq.oninput = () => { q = gq.value; draw(); const n = $('#gq', body); n.focus(); n.setSelectionRange(q.length, q.length); }; $('#gc', body).onchange = e => { cat = e.target.value; draw(); }; }
    body.querySelectorAll('[data-p]').forEach(b => b.onclick = () => play(b.dataset.p)); body.querySelectorAll('[data-e]').forEach(b => b.onclick = () => { editId = b.dataset.e; view = 'imp'; draw(); });
    body.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { const i = b.dataset.f; S.fav = S.fav.includes(i) ? S.fav.filter(x => x !== i) : [...S.fav, i]; save(); draw(); });
    body.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { if (confirm('Remove this imported game?')) { S.imported = S.imported.filter(g => g.id !== b.dataset.d); save(); draw(); } });
    const f = $('#imp', body); if (f) f.onsubmit = e => { e.preventDefault(); const d = Object.fromEntries(new FormData(f)); if (!okUrl(d.url) || (d.cover && !okUrl(d.cover))) return toast('Enter a valid http(s) URL.');
      if (editId) { Object.assign(S.imported.find(g => g.id === editId), { title: d.title.trim() || 'Untitled', url: d.url, description: d.description, category: d.category || 'Other', cover: d.cover }); editId = null; save(); view = 'lib'; return draw(); } let id; do id = 'imp-' + Math.random().toString(36).slice(2, 8); while (allGames().some(g => g.id === id)); S.imported.push({ id, imported: true, title: d.title.trim() || 'Untitled', url: d.url, description: d.description, category: d.category || 'Other', cover: d.cover }); save(); view = 'lib'; draw(); };
  };
  draw();
}
function play(id) {
  const g = allGames().find(x => x.id === id); if (!g) return; notify('Launched ' + g.title); S.recent = [id, ...S.recent.filter(x => x !== id)].slice(0, 12); save();
  openWin('play-' + id, g.title, b => { b.innerHTML = `<div class="col"><div class="row"><button class="ghost" id="rl">Reload</button><button class="ghost" id="fs">Fullscreen</button><a href="${esc(g.url)}" target="_blank" rel="noopener noreferrer" style="color:var(--acc)">Open in new tab</a></div>
    <div class="err" style="font-size:12px">Loading ${esc(new URL(g.url).host)}. If this stays blank, the site blocks embedding (X-Frame-Options or CSP). Use Open in new tab. Browsers don't let Chilzz detect this reliably.</div><iframe sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-popups" allow="fullscreen; gamepad" referrerpolicy="no-referrer" src="${esc(g.url)}" title="${esc(g.title)}"></iframe></div>`;
    $('#rl', b).onclick = () => { const f = $('iframe', b); f.src = f.src; }; $('#fs', b).onclick = () => $('iframe', b).requestFullscreen?.(); }, 900, 600);
}
/* ---- Chilzz Proxy: independent of games; only talks to server/ ---- */
function proxyApp(body) {
  const hist = []; let at = -1;
  body.innerHTML = `<div class="col"><div class="row"><button class="ghost" id="pb">Back</button><button class="ghost" id="pf">Forward</button><button class="ghost" id="pr">Reload</button><input id="pu" style="flex:1" placeholder="https://allowed-site.example" aria-label="Address"><button id="pg">Go</button></div><div id="ps" class="empty">Checking server&hellip;</div><iframe id="pv" sandbox="" title="Proxied page" hidden></iframe></div>`;
  const st = $('#ps', body), fr = $('#pv', body);
  fetch(S.proxy + '/health').then(r => r.json()).then(j => { st.textContent = `Server online. Allowed hosts: ${j.allowed.join(', ') || 'none'}. Pages render without scripts.`; }).catch(() => { st.innerHTML = 'Chilzz Proxy can't reach its server. Run Chilzz with <code>npm start</code> (it serves the desktop and the proxy together), or set a separate server URL in Settings.'; });
  const go = async (u, push = true) => { st.hidden = false; if (!okUrl(u)) { st.className = 'err'; st.textContent = 'Enter a valid http or https address.'; return; }
    st.className = 'empty'; st.textContent = 'Loading…'; fr.hidden = true;
    try { const r = await fetch(`${S.proxy}/api/fetch?url=${encodeURIComponent(u)}`); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status); fr.srcdoc = j.body; fr.hidden = false; st.hidden = true; $('#pu', body).value = u; if (push) { hist.splice(at + 1); hist.push(u); at = hist.length - 1; } }
    catch (e) { st.className = 'err'; st.textContent = `Couldn't load this page: ${e.message}. The site may not be on the server's allowlist, or it needs scripts, login or WebSockets that a basic proxy can't provide.`; } };
  $('#pg', body).onclick = () => go($('#pu', body).value.trim()); $('#pu', body).onkeydown = e => e.key === 'Enter' && go(e.target.value.trim());
  $('#pb', body).onclick = () => at > 0 && go(hist[--at], false); $('#pf', body).onclick = () => at < hist.length - 1 && go(hist[++at], false); $('#pr', body).onclick = () => hist[at] && go(hist[at], false);
}
/* ---- Settings ---- */
function settingsApp(body) {
  const fonts = { Inter: 'Inter, system-ui, sans-serif', Arial: 'Arial, sans-serif', 'Segoe UI': '"Segoe UI", system-ui, sans-serif', Roboto: 'Roboto, sans-serif', System: 'system-ui, sans-serif', Monospace: 'ui-monospace, monospace', Pixel: '"ChilzzPixel", monospace' };
  body.innerHTML = `<div class="set"><h3>Personalization</h3>
  <label>Theme<select id="st">${[['dark', 'Dark'], ['light', 'Light'], ['midnight', 'Midnight'], ['purple', 'Purple gaming'], ['contrast', 'High contrast']].map(([v, l]) => `<option value="${v}" ${S.theme === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
  <label>Accent<input type="color" id="sa" value="${S.accent}"></label><label>Wallpaper URL<input id="sw" placeholder="https://…" value="${S.wall.startsWith('http') ? esc(S.wall) : ''}"></label>
  <label>Wallpaper file<input type="file" id="sf" accept="image/*"></label><label>Dim wallpaper<input type="range" id="sd" min="0" max="0.8" step="0.05" value="${S.dim}"></label>
  <label>Font<select id="sn">${Object.entries(fonts).map(([k, v]) => `<option value="${esc(v)}" ${S.font === v ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
  <label>Import font file<input type="file" id="sx" accept=".woff,.woff2,.ttf,.otf"></label><label>Text size<input type="range" id="ss" min="12" max="20" value="${S.size}"></label>
  <h3>Custom theme</h3><label>Background<input type="color" id="cb" value="${S.cbg || '#15171c'}"></label><label>Text<input type="color" id="ct" value="${S.ctext || '#f2f3f5'}"></label><label>Corner radius<input type="range" id="cr" min="0" max="24" value="${S.rad}"></label><button class="ghost" id="cres">Reset custom colors</button>
  <h3>Taskbar and desktop</h3><label>Alignment<select id="tal"><option value="center" ${S.align === 'center' ? 'selected' : ''}>Center</option><option value="left" ${S.align === 'left' ? 'selected' : ''}>Left</option></select></label><label>Opacity<input type="range" id="tba" min="0.3" max="1" step="0.05" value="${S.alpha}"></label><label>Height<input type="range" id="tbh" min="40" max="64" value="${S.tbh}"></label><label>Auto-hide<input type="checkbox" id="tau" ${S.auto ? 'checked' : ''}></label><label>Desktop widget<input type="checkbox" id="wd" ${S.widget ? 'checked' : ''}></label>
  ${Object.keys(APPS).map(k => `<label>Pin ${APPS[k][0]}<input type="checkbox" data-pin="${k}" ${S.pinned.includes(k) ? 'checked' : ''}></label>`).join('')}
  <h3>Startup and profile</h3><label>Startup sound<input type="checkbox" id="snd" ${S.sound ? 'checked' : ''}></label><label>Fast startup (skip boot)<input type="checkbox" id="sq" ${S.fast ? 'checked' : ''}></label><label>Display name<input id="sm" value="${esc(S.name)}"></label>
  <label>Local PIN (convenience only, not secure)<input id="sp" type="password" maxlength="8" value="${esc(S.pin)}"></label><label>Proxy server URL (blank = same server as Chilzz)<input id="sv" value="${esc(S.proxy)}"></label>
  <h3>Data</h3><div class="row"><button id="ex">Export</button><label>Import<input type="file" id="im" accept=".json"></label><button class="ghost" id="rc">Clear recent games</button><button class="ghost" id="ri">Reset imported games</button><button class="ghost" id="rs">Reset everything</button></div></div>`;
  const on = (id, ev, fn) => $('#' + id, body).addEventListener(ev, fn), set = (k, v) => { S[k] = v; save(); applyTheme(); };
  on('st', 'change', e => set('theme', e.target.value)); on('sa', 'input', e => set('accent', e.target.value)); on('sd', 'input', e => set('dim', +e.target.value)); on('sn', 'change', e => set('font', e.target.value)); on('ss', 'input', e => set('size', +e.target.value));
  on('sw', 'change', e => { const v = e.target.value.trim(); if (!v || okUrl(v)) set('wall', v); else toast('Invalid URL.'); });
  on('sf', 'change', async e => { const f = e.target.files[0]; if (f?.type.startsWith('image/')) { await idb('readwrite', 'wall', f); set('wall', 'idb'); } });
  on('sx', 'change', async e => { const f = e.target.files[0]; if (!f) return; try { const ff = new FontFace('ChilzzPixel', await f.arrayBuffer()); await ff.load(); document.fonts.add(ff); set('font', '"ChilzzPixel", monospace'); toast('Font applied for this session only.'); } catch { toast('That font file could not be loaded.'); } });
  on('sq', 'change', e => set('fast', e.target.checked)); on('sm', 'change', e => set('name', e.target.value.slice(0, 24) || 'Player')); on('sp', 'change', e => set('pin', e.target.value)); on('sv', 'change', e => !e.target.value.trim() || okUrl(e.target.value) ? set('proxy', e.target.value.replace(/\/$/, '')) : toast('Invalid URL.'));
  on('ex', 'click', () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' })); a.download = 'chilzz-settings.json'; a.click(); });
  on('im', 'change', async e => { try { const o = JSON.parse(await e.target.files[0].text()); if (o?.v !== 1 || !Array.isArray(o.imported) || !o.imported.every(g => g && okUrl(g.url) && typeof g.id === 'string')) throw 0; S = { ...DEF, ...o }; save(); location.reload(); } catch { toast('Not a valid Chilzz settings file.'); } });
  on('rc', 'click', () => { S.recent = []; save(); toast('Recent games cleared.'); }); on('ri', 'click', () => { if (confirm('Remove all imported games? The 50 slots in games.js are not affected.')) { S.imported = []; save(); } });
  on('cb', 'input', e => set('cbg', e.target.value)); on('ct', 'input', e => set('ctext', e.target.value)); on('cr', 'input', e => set('rad', +e.target.value));
  on('tba', 'input', e => set('alpha', +e.target.value)); on('tbh', 'input', e => set('tbh', +e.target.value)); on('tal', 'change', e => set('align', e.target.value));
  on('tau', 'change', e => set('auto', e.target.checked)); on('wd', 'change', e => { set('widget', e.target.checked); drawW(); }); on('snd', 'change', e => set('sound', e.target.checked));
  on('cres', 'click', () => { S.cbg = ''; S.ctext = ''; S.rad = 10; save(); applyTheme(); });
  body.querySelectorAll('[data-pin]').forEach(c => c.onchange = () => { S.pinned = c.checked ? [...S.pinned, c.dataset.pin] : S.pinned.filter(x => x !== c.dataset.pin); save(); tasks(); });
  on('rs', 'click', () => { if (confirm('Reset all Chilzz data?')) { localStorage.removeItem('chilzz'); location.reload(); } });
}
function filesApp(body) {
  const folders = ['Home', 'Downloads', 'Documents', 'Images', 'Chilzz Assets', 'Settings Exports'], files = Object.fromEntries(folders.map(f => [f, []])); let cur = 'Home';
  const draw = () => { body.innerHTML = `<div class="layout"><nav class="side">${folders.map(f => `<button data-f="${f}" class="${f === cur ? 'on' : ''}">${f}</button>`).join('')}</nav><div class="main"><div class="row"><input type="file" id="fp" multiple aria-label="Import files"></div><p style="color:var(--mute)">Virtual folders. Picked files stay in memory for this session only; Chilzz can't see your real filesystem.</p>${files[cur].map(f => `<div>${esc(f.name)} (${Math.ceil(f.size / 1024)} KB)</div>`).join('') || '<div class="empty">This folder is empty.</div>'}</div></div>`;
    body.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { cur = b.dataset.f; draw(); }); $('#fp', body).onchange = e => { files[cur].push(...e.target.files); draw(); }; };
  draw();
}
const aboutApp = b => b.innerHTML = `<h3>Chilzz</h3><p>A browser-based desktop. Sign-in is a local convenience, not secure authentication. External sites you open may collect data, and proxied requests expose metadata to the server operator.</p>`;
const APPS = { games: ['Chilzz Games', gamesApp, 'G'], proxy: ['Chilzz Proxy', proxyApp, 'P'], settings: ['Settings', settingsApp, 'S'], files: ['File Manager', filesApp, 'F'], about: ['About Chilzz', aboutApp, 'i'] };
const open = k => { $('#start').hidden = true; openWin(k, APPS[k][0], APPS[k][1], k === 'settings' ? 640 : 860); };
/* ---- start / search ---- */
function search(q = '') { const t = q.toLowerCase(); const r = [...Object.entries(APPS).map(([k, a]) => ({ l: a[0], s: 'App', f: () => open(k) })), ...allGames().map(g => ({ l: g.title, s: 'Game · ' + g.category, f: () => { $('#start').hidden = true; play(g.id); } }))].filter(x => x.l.toLowerCase().includes(t) || x.s.toLowerCase().includes(t));
  $('#sres').innerHTML = ''; r.forEach((x, i) => { const b = document.createElement('button'); b.className = 'res' + (i ? '' : ' sel'); b.innerHTML = `${esc(x.l)} <small>${esc(x.s)}</small>`; b.onclick = x.f; $('#sres').append(b); }); return r; }
function toggleStart(force) { const s = $('#start'); s.hidden = force ?? !s.hidden; if (!s.hidden) { $('#sq').value = ''; search(); $('#sq').focus(); } }
/* ---- boot / login / desktop ---- */
const tick = () => { $('#lclock').textContent = new Date().toLocaleString([], { weekday: 'long', hour: '2-digit', minute: '2-digit' }); $('#tray').textContent = new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); };
function showLogin() { $('#boot').hidden = true; $('#login').hidden = false; $('#lname').textContent = S.name; $('#lav').textContent = S.name[0].toUpperCase(); }
function enter(guest) { if (!guest && S.pin && $('#pin').value !== S.pin) return toast('Wrong PIN.'); chime(); $('#login').hidden = true; $('#desktop').hidden = false; $('#uname').textContent = guest ? 'Guest' : S.name; }
$('#startbtn').onclick = () => toggleStart(); $('#signin').onclick = () => enter(false); $('#guest').onclick = () => enter(true); $('#restart').onclick = () => location.reload();
$('#sq').oninput = e => search(e.target.value); $('#sq').onkeydown = e => { if (e.key === 'Enter') $('.res', $('#sres'))?.click(); };
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'k' && !$('#desktop').hidden) { e.preventDefault(); toggleStart(true); } if (e.key === 'Escape') toggleStart(true); });
$('#desktop').addEventListener('contextmenu', e => { if (e.target.id === 'desktop' || e.target.id === 'icons') { e.preventDefault(); open('settings'); } });
/* ---- icons, taskbar pins, notifications, widget, sound ---- */
const IC = { games: 'M6 12h4|M8 10v4|M15 13h.01|M18 11h.01|M17.3 5H6.7a4 4 0 0 0-3.9 3.1l-1.5 6.5a2.5 2.5 0 0 0 4.5 2.7L7 16h10l1.2 1.3a2.5 2.5 0 0 0 4.5-2.7l-1.5-6.5A4 4 0 0 0 17.3 5z', proxy: 'M2 12a10 10 0 1 0 20 0 10 10 0 1 0-20 0|M2 12h20|M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20', settings: 'M4 21v-7|M4 10V3|M12 21v-9|M12 8V3|M20 21v-5|M20 12V3|M1 14h6|M9 8h6|M17 16h6', files: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', about: 'M2 12a10 10 0 1 0 20 0 10 10 0 1 0-20 0|M12 16v-4|M12 8h.01', bin: 'M3 6h18|M8 6V4h8v2|M6 6l1 14h10l1-14', bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9|M10 21h4' };
const ic = (k, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k].split('|').map(d => `<path d="${d}"/>`).join('')}</svg>`;
const chime = () => { if (!S.sound) return; try { const c = new AudioContext(); [523, 659, 784].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + i * .15; o.frequency.value = f; o.connect(g); g.connect(c.destination); g.gain.setValueAtTime(.08, t); g.gain.exponentialRampToValueAtTime(.001, t + .4); o.start(t); o.stop(t + .4); }); } catch { } };
function tasks() { tasksOld(); const t = $('#tasks'); [...S.pinned].reverse().forEach(k => { if (!APPS[k] || wins[k]) return; const b = document.createElement('button'); b.innerHTML = ic(k); b.title = APPS[k][0]; b.setAttribute('aria-label', APPS[k][0]); b.onclick = () => open(k); t.prepend(b); }); }
const keys = [...Object.keys(APPS), 'bin'];
$('#icons').innerHTML = keys.map((k, i) => { const p = S.pos[k] || [12 + Math.floor(i / 6) * 92, 12 + (i % 6) * 96]; return `<button class="ico" data-k="${k}" style="left:${p[0]}px;top:${p[1]}px"><b>${ic(k)}</b>${k === 'bin' ? 'Recycle Bin' : APPS[k][0]}</button>`; }).join('');
$('#icons').addEventListener('pointerdown', e => { const el = e.target.closest('.ico'); if (!el) return; const sx = e.clientX - el.offsetLeft, sy = e.clientY - el.offsetTop; let moved = false;
  const mv = ev => { if (Math.abs(ev.clientX - e.clientX) + Math.abs(ev.clientY - e.clientY) > 5) moved = true; if (moved) { el.style.left = Math.max(0, ev.clientX - sx) + 'px'; el.style.top = Math.max(0, ev.clientY - sy) + 'px'; } };
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); if (moved) { S.pos[el.dataset.k] = [el.offsetLeft, el.offsetTop]; save(); el.dataset.moved = 1; setTimeout(() => delete el.dataset.moved, 0); } };
  addEventListener('pointermove', mv); addEventListener('pointerup', up); });
$('#icons').onclick = e => { const el = e.target.closest('.ico'); if (!el || el.dataset.moved) return; el.dataset.k === 'bin' ? toast('Recycle Bin is a placeholder.') : open(el.dataset.k); };
const bell = document.createElement('button'); bell.className = 'ghost'; bell.innerHTML = ic('bell', 18); bell.setAttribute('aria-label', 'Notifications and quick settings'); $('#tray').before(bell);
const nc = document.createElement('div'); nc.id = 'nc'; nc.hidden = true; $('#desktop').append(nc);
const drawNc = () => { nc.innerHTML = `<h4>Quick settings</h4><div class="row"><button class="ghost" id="qt">Light/dark</button><button class="ghost" id="qw">Widget</button></div><h4>Notifications</h4>${S.notes.map(n => `<div>${esc(n)}</div>`).join('') || '<div class="empty">No notifications.</div>'}<button class="ghost" id="qc">Clear</button>`;
  $('#qt', nc).onclick = () => { S.theme = S.theme === 'light' ? 'dark' : 'light'; save(); applyTheme(); }; $('#qw', nc).onclick = () => { S.widget = !S.widget; save(); drawW(); }; $('#qc', nc).onclick = () => { S.notes = []; save(); drawNc(); }; };
bell.onclick = () => { nc.hidden = !nc.hidden; if (!nc.hidden) drawNc(); };
const notify = m => { S.notes = [m, ...S.notes].slice(0, 20); save(); toast(m); };
const wd = document.createElement('div'); wd.id = 'widget'; $('#desktop').append(wd);
const drawW = () => { wd.hidden = !S.widget; const d = new Date(), rg = S.recent.map(i => allGames().find(g => g.id === i)).find(Boolean);
  wd.innerHTML = `<div style="font-size:32px">${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div><div>${d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</div><small>${rg ? 'Last played: ' + esc(rg.title) : 'No games played yet'}</small>`; };
drawW(); setInterval(drawW, 30000);
applyTheme(); tick(); setInterval(tick, 30000); $('#boot').onclick = showLogin; S.fast ? showLogin() : setTimeout(showLogin, 1800);

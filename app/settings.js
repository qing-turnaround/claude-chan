// Settings window. Every change goes straight to the main process (apply() in main.js), which sends the new
// state back; the page is re-rendered from that, so the menu and this window never disagree.
const api = window.settingsAPI;
const $ = (id) => document.getElementById(id);
const COLORS = { red: '#D2693F', pink: '#F2B4CC' };

// Clawd drawn small: box body, four legs, arm nubs, ^ ^ eyes (the pink one has its flower)
function clawd(x, color, flower) {
  return `<g transform="translate(${x} 0)" stroke="#2B2220" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">
    ${[6, 15, 24, 33].map((lx) => `<rect x="${lx}" y="40" width="6" height="12" fill="${color}"/>`).join('')}
    <rect x="-5" y="22" width="7" height="9" fill="${color}"/><rect x="43" y="22" width="7" height="9" fill="${color}"/>
    <rect x="0" y="12" width="45" height="31" fill="${color}"/>
    <path d="M10 27 l4 -4 l4 4 M27 27 l4 -4 l4 4 M19 32 q3.5 3 7 0" fill="none"/>
    ${flower ? '<circle cx="9" cy="10" r="5" fill="#F6C445" stroke-width="1.6"/><circle cx="9" cy="10" r="2" fill="#E8892B" stroke-width="1.2"/>' : ''}
  </g>`;
}
const CLAWD_CARD = `<svg viewBox="-8 0 122 56">${clawd(0, COLORS.red)}${clawd(60, COLORS.pink, true)}</svg>`;
const CLAWD_CHIP = (k) => `<svg viewBox="-6 0 57 56">${clawd(0, COLORS[k], k === 'pink')}</svg>`;

let st = null, dragging = false, pending = null;

function paintSlider() {
  const s = $('size'), p = ((s.value - s.min) / (s.max - s.min)) * 100;
  s.style.setProperty('--p', p + '%');
  $('sizeOut').textContent = Math.round(s.value * 100) + '%';
}

function render(s) {
  st = s;
  const T = s.T;
  document.title = T.title;
  $('ver').textContent = 'v' + s.version;
  for (const [id, text] of [['secLook', T.secLook], ['secMove', T.secMove], ['secGeneral', T.secGeneral],
    ['who', T.who], ['sizeLabel', T.size], ['roamLabel', T.roam], ['roamHint', T.roamHint],
    ['linkLabel', T.link], ['linkHint', T.linkHint], ['patLabel', T.pat], ['patHint', T.patHint], ['loginLabel', T.login], ['langLabel', T.language]]) $(id).textContent = text;
  $('reset').title = T.reset;

  $('outfits').replaceChildren(...s.outfits.map((k) => {
    const el = document.createElement('div');
    el.className = 'outfit' + (s.skin === k ? ' on' : '');
    el.innerHTML = (k === 'clawd' ? CLAWD_CARD : `<img src="assets/skins/${k}/idle.webp">`) + `<div>${T.skins[k]}</div>`;
    el.onclick = () => api.set('skin', k);
    return el;
  }));

  $('clawdRow').style.display = s.skin === 'clawd' ? '' : 'none';
  $('chips').replaceChildren(...['red', 'pink'].map((k) => {
    const el = document.createElement('div');
    el.className = 'chip' + (s.clawd.includes(k) ? ' on' : '');
    el.innerHTML = CLAWD_CHIP(k) + T.clawd[k];
    el.onclick = () => api.set('clawdKind', { kind: k, on: !s.clawd.includes(k) });
    return el;
  }));

  const size = $('size');
  size.min = s.sizeMin; size.max = s.sizeMax;
  if (!dragging) size.value = s.size;
  paintSlider();

  $('roam').checked = s.roam; $('link').checked = s.link; $('login').checked = s.login; $('pat').checked = s.patApprove;
  $('login').closest('.row').style.display = s.canLogin ? '' : 'none';
  $('lang').replaceChildren(...[['auto', T.auto], ...s.langs].map(([k, label]) => {
    const o = document.createElement('option'); o.value = k; o.textContent = label; o.selected = s.lang === k; return o;
  }));
  // updates: what's going on, and the one button that moves it along
  const u = s.update, up = $('upBtn');
  $('upLabel').textContent = T.upCheck;
  $('upHint').textContent = !u.enabled ? T.upDev
    : { checking: T.upChecking, latest: T.upLatest, error: T.upError, available: T.upAvailable, ready: T.upReady,
      downloading: T.upDownloading.replace('{p}', u.percent || 0) }[u.status]?.replace('{v}', u.version) || '';
  up.textContent = u.status === 'ready' ? T.upRestart : u.status === 'available' ? T.upDownload : T.upCheck;
  up.className = 'btn' + (u.status === 'ready' || u.status === 'available' ? ' go' : '');
  up.disabled = !u.enabled || u.status === 'checking' || u.status === 'downloading';
  requestAnimationFrame(() => api.height(document.body.scrollHeight));
}

// size: the pet follows the slider live while it's being dragged
$('size').addEventListener('pointerdown', () => { dragging = true; });
$('size').addEventListener('input', () => {
  paintSlider();
  if (!pending) pending = requestAnimationFrame(() => { pending = null; api.set('size', Number($('size').value)); });
});
$('size').addEventListener('change', () => { dragging = false; api.set('size', Number($('size').value)); });
$('reset').onclick = () => api.set('size', 1);

$('roam').onchange = (e) => api.set('roam', e.target.checked);
$('link').onchange = (e) => api.set('link', e.target.checked);
$('login').onchange = (e) => api.set('login', e.target.checked);
$('pat').onchange = (e) => api.set('patApprove', e.target.checked);
$('lang').onchange = (e) => api.set('lang', e.target.value);
$('upBtn').onclick = () => api.set('update');

api.onChanged(render);
api.state().then((s) => { render(s); requestAnimationFrame(() => document.body.classList.add('ready')); });

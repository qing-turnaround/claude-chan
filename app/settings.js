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

// flight gear on a red Clawd, as drawn in the air (critter-renderer.js): pixel wings, jet flames, propeller beanie
const WING = [[4, -5], [5, -5], [2, -4], [3, -4], [4, -4], [5, -4], [6, -4], [1, -3], [2, -3], [3, -3], [4, -3], [5, -3], [6, -3],
  [0, -2], [1, -2], [2, -2], [3, -2], [4, -2], [5, -2], [6, -2], [0, -1], [1, -1], [2, -1], [3, -1], [4, -1], [5, -1],
  [0, 0], [1, 0], [3, 0], [4, 0], [0, 1]];
function pixelWing(x0, y0, side) {
  const P = 3, on = new Set(WING.map(([c, r]) => c + ',' + r)), px = (c) => x0 + side * c * P + (side < 0 ? -P : 0);
  let cells = '', edges = '';
  for (const [c, r] of WING) {
    const x = px(c), y = y0 + r * P;
    cells += `<rect x="${x}" y="${y}" width="${P}" height="${P}" fill="${r >= -1 ? '#ECE6F1' : '#FFFFFF'}"/>`;
    const has = (dc, dr) => on.has((c + dc) + ',' + (r + dr));
    if (!has(0, -1)) edges += `M${x} ${y}h${P}`;
    if (!has(0, 1)) edges += `M${x} ${y + P}h${P}`;
    if (!has(side > 0 ? -1 : 1, 0)) edges += `M${x} ${y}v${P}`;
    if (!has(side > 0 ? 1 : -1, 0)) edges += `M${x + P} ${y}v${P}`;
  }
  return cells + `<path d="${edges}" stroke="#2B2220" stroke-width="1.6" stroke-linecap="square" fill="none"/>`;
}
const GEAR = {
  off: '',
  wings: pixelWing(43, 16, 1) + pixelWing(2, 16, -1),
  jets: [12.5, 32.5].map((x) => `<path d="M${x - 5} 52 Q${x} 72 ${x + 5} 52Z" fill="#F6C445" stroke="#2B2220" stroke-width="1.6" stroke-linejoin="round"/>`
    + `<path d="M${x - 2.4} 52 Q${x} 63 ${x + 2.4} 52Z" fill="#D97757"/>`).join(''),
  rotor: '<g stroke="#2B2220" stroke-width="1.8"><path d="M15 12a7.5 7.5 0 0 1 15 0Z" fill="#6FA8DC"/><path d="M22.5 4.5v-4" fill="none"/>'
    + '<ellipse cx="22.5" cy="0" rx="14" ry="2.6" fill="#F6C445"/><circle cx="22.5" cy="0" r="1.8" fill="#E2453C"/></g>',
};
// the wings and the beanie go behind / over the body, the flames under the feet
const FLIGHT_CARD = (k) => `<svg viewBox="-21 -5 87 69">${k === 'wings' ? GEAR.wings : ''}${clawd(0, COLORS.red)}${k !== 'wings' ? GEAR[k] : ''}</svg>`;
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
    ['linkLabel', T.link], ['linkHint', T.linkHint], ['patLabel', T.pat], ['patHint', T.patHint], ['holidayLabel', T.holiday], ['holidayHint', T.holidayHint], ['loginLabel', T.login], ['langLabel', T.language]]) $(id).textContent = text;
  // taking the hooks out for good: a quiet link under the Link switch, while they're in place
  $('unhook').textContent = T.unhook; $('unhook').title = T.unhookHint; $('unhook').style.display = s.hooks ? '' : 'none';
  $('reset').title = T.reset;

  $('outfits').replaceChildren(...s.outfits.map((k) => {
    const el = document.createElement('div');
    el.className = 'outfit' + (s.skin === k ? ' on' : '');
    el.innerHTML = (k === 'clawd' ? CLAWD_CARD : `<img src="assets/skins/${k}/idle.webp">`) + `<div>${T.skins[k]}</div>`;
    el.onclick = () => api.set('skin', k);
    return el;
  }));

  $('clawdRow').style.display = $('flightRow').style.display = s.skin === 'clawd' ? '' : 'none';
  $('flightLabel').textContent = T.flight;
  $('flights').replaceChildren(...['off', 'wings', 'jets', 'rotor'].map((k) => {
    const el = document.createElement('div');
    el.className = 'outfit' + (s.flight === k ? ' on' : '');
    el.title = T.flights[k];
    el.innerHTML = FLIGHT_CARD(k) + `<div>${T.flights[k]}</div>`;
    el.onclick = () => api.set('flight', k);
    return el;
  }));
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

  $('roam').checked = s.roam; $('link').checked = s.link; $('login').checked = s.login; $('pat').checked = s.patApprove; $('holiday').checked = s.holiday;
  $('login').closest('.row').style.display = s.canLogin ? '' : 'none';
  $('lang').replaceChildren(...[['auto', T.auto], ...s.langs].map(([k, label]) => {
    const o = document.createElement('option'); o.value = k; o.textContent = label; o.selected = s.lang === k; return o;
  }));
  // updates, next to the version at the top: what's going on, and the one button that moves it along
  const u = s.update, up = $('upBtn');
  $('upHint').textContent = !u.enabled ? T.upDev
    : { checking: T.upChecking, latest: T.upLatest, error: T.upError, available: T.upAvailable, installing: T.upInstalling,
      downloading: T.upDownloading.replace('{p}', u.percent || 0) }[u.status]?.replace('{v}', u.version) || '';
  up.textContent = u.status === 'available' ? (u.canInstall ? T.upNow : T.upDownload) : T.upCheck;
  up.className = 'btn' + (u.status === 'available' ? ' go' : '');
  up.disabled = !u.enabled || ['checking', 'downloading', 'installing'].includes(u.status);
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
$('holiday').onchange = (e) => api.set('holiday', e.target.checked);
$('lang').onchange = (e) => api.set('lang', e.target.value);
$('upBtn').onclick = () => api.set('update');
$('unhook').onclick = () => api.set('unhook');

api.onChanged(render);
api.state().then((s) => { render(s); requestAnimationFrame(() => document.body.classList.add('ready')); });

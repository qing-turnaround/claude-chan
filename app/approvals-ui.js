// Approval cards (one per pending request, oldest at the bottom next to the pet)
const list = document.getElementById('list');
const MAX = 3;                 // more than this: the rest wait behind, with a count
const picks = new Map();       // question card id -> { questionIndex: Set of labels }, survives re-renders

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function button(cls, label, onclick, title) {
  const b = el('button', cls, label);
  if (title) b.title = title;
  b.onclick = onclick;
  return b;
}

// shell command / plan text
function commandBody(it) {
  const out = [el('div', 'main', it.main)];
  if (it.note) out.push(el('div', 'note', it.note));
  return out;
}

// file name large, folder small, then the lines going out (-) and in (+)
function fileBody(it) {
  const out = [el('div', 'fname', it.name), el('div', 'note path', it.dir)];
  if (it.diff.length) {
    const d = el('div', 'main diff');
    it.diff.forEach(([sign, text]) => d.append(el('div', sign === '-' ? 'del' : sign === '+' ? 'add' : '', `${sign ? sign + ' ' : ''}${text}`)));
    out.push(d);
  }
  return out;
}

function fieldsBody(it) {
  const d = el('div', 'main');
  it.fields.forEach(([k, v]) => { const row = el('div'); row.append(el('b', '', k + ': '), document.createTextNode(v)); d.append(row); });
  return [d];
}

// AskUserQuestion: the question and its options, answered right here
function questionBody(it, T) {
  const sel = picks.get(it.id) || { typed: {} };
  picks.set(it.id, sel);
  const single = it.questions.length === 1 && !it.questions[0].multi;
  const out = [];
  // a typed answer ("Other") replaces the pick on a single-choice question, and joins the picks on a multi-choice one
  const answer = (q, i) => {
    const typed = (sel.typed[i] || '').trim();
    if (!q.multi && typed) return typed;
    return [...(sel[i] || []), ...(typed ? [typed] : [])].join(', ');
  };
  const ready = () => it.questions.every((q, i) => answer(q, i));
  const send = () => {
    if (!ready()) return;
    const answers = {};
    it.questions.forEach((q, i) => { answers[i] = answer(q, i); });
    window.approvals.decide(it.id, 'answer', answers);
  };
  const submit = button('allow', T.submit, send);
  it.questions.forEach((q, i) => {
    const box = el('div', 'q');
    if (q.header) box.append(el('div', 'qhead', q.header));
    box.append(el('div', 'qtext', q.question));
    q.options.forEach((o) => {
      const opt = el('div', 'opt' + (sel[i] && sel[i].has(o.label) ? ' on' : ''));
      opt.append(el('div', 'olabel', o.label));
      if (o.description) opt.append(el('div', 'odesc', o.description));
      opt.onclick = () => {
        if (single) return window.approvals.decide(it.id, 'answer', { 0: o.label });   // one question, one pick: done
        const s = sel[i] || (sel[i] = new Set());
        if (q.multi) s.has(o.label) ? s.delete(o.label) : s.add(o.label);
        else { s.clear(); s.add(o.label); }
        if (!q.multi) { sel.typed[i] = ''; other.value = ''; }
        box.querySelectorAll('.opt').forEach((x, k) => x.classList.toggle('on', s.has(q.options[k].label)));
        submit.disabled = !ready();
      };
      box.append(opt);
    });
    // the terminal's own "Type something" choice: an answer of your own
    const other = el('input', 'other');
    other.placeholder = T.other; other.value = sel.typed[i] || '';
    other.oninput = () => {
      sel.typed[i] = other.value;
      if (!q.multi && other.value.trim() && sel[i]) { sel[i].clear(); box.querySelectorAll('.opt').forEach((x) => x.classList.remove('on')); }
      submit.disabled = !ready();
    };
    other.onkeydown = (e) => { if (e.key === 'Enter' && !e.isComposing) send(); };   // not the Enter that ends IME input
    box.append(other);
    out.push(box);
  });
  const btns = el('div', 'btns');
  submit.disabled = !ready(); btns.append(submit);
  btns.append(button('deny', T.toTerminal, () => window.approvals.decide(it.id, 'terminal')));
  out.push(btns);
  return out;
}

window.approvals.onView(({ T, items }) => {
  const shown = items.slice(0, MAX).reverse();
  for (const id of picks.keys()) if (!items.some((x) => x.id === id)) picks.delete(id);
  list.replaceChildren(...shown.map((it, i) => {
    const card = el('div', 'card');
    const head = el('div', 'head');
    head.append(el('div', 'bang', it.kind === 'question' ? '?' : '!'), el('div', 'tool', it.kind === 'question' ? T.question : it.tool), el('div', 'proj', it.project));
    if (i === 0 && items.length > MAX) head.append(el('div', 'proj', `+${items.length - MAX}`));
    card.append(head);
    if (it.kind === 'question') { card.append(...questionBody(it, T)); return card; }
    card.append(...(it.kind === 'file' ? fileBody(it) : it.kind === 'fields' ? fieldsBody(it) : commandBody(it)));
    const btns = el('div', 'btns');
    btns.append(button('allow', T.allow, () => window.approvals.decide(it.id, 'allow')));
    if (it.always) btns.append(button('always', `${T.always} ${it.always}`, () => window.approvals.decide(it.id, 'always'), it.always));
    btns.append(button('deny', T.deny, () => window.approvals.decide(it.id, 'deny')));
    card.append(btns);
    return card;
  }));
  // a timer, not requestAnimationFrame: this window is hidden between cards, and Chromium pauses rAF in hidden
  // windows, so the next card would never report its height and never be shown
  setTimeout(() => window.approvals.height(document.body.scrollHeight), 0);
});

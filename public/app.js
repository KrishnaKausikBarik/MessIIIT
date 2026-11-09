'use strict';
const $ = s => document.querySelector(s);
const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const key = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const inr = n => '₹' + n.toLocaleString('en-IN');
const DAYN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ICON = { breakfast: '🍳', lunch: '🍛', snacks: '🫖', dinner: '🌙' };
const ICONS = {
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  receipt: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-8M3 20h18"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M17 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
};
const ico = n => `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;
const LOGO = '<svg class="logo" viewBox="0 0 46 46" aria-hidden="true"><rect width="46" height="46" rx="13" fill="#2b3a67"/><circle cx="23" cy="23" r="13" fill="none" stroke="#fff" stroke-width="2.5"/><circle cx="23" cy="23" r="5" fill="#e0a100"/></svg>';
const THALI = `<svg class="thali" viewBox="0 0 200 200" role="img" aria-label="A thali with dal, vegetables, rice, roti and a sweet"><circle cx="100" cy="100" r="96" fill="#dfe4ec" stroke="#9fa9bd" stroke-width="4"/><circle cx="100" cy="100" r="84" fill="#f1f3f8" stroke="#c3cad8" stroke-width="2"/>
<g class="f" style="animation-delay:.1s"><circle cx="64" cy="62" r="26" fill="#fff" stroke="#9fa9bd" stroke-width="3"/><circle cx="64" cy="62" r="19" fill="#f0b429"/></g>
<g class="f" style="animation-delay:.25s"><circle cx="136" cy="62" r="26" fill="#fff" stroke="#9fa9bd" stroke-width="3"/><circle cx="136" cy="62" r="19" fill="#5f9a3b"/><circle cx="130" cy="58" r="4" fill="#d9e8a8"/><circle cx="142" cy="66" r="4" fill="#d9e8a8"/></g>
<g class="f" style="animation-delay:.4s"><circle cx="100" cy="112" r="30" fill="#fffdf4" stroke="#e5dcc0" stroke-width="2"/><g fill="#e8dfc2"><circle cx="90" cy="104" r="2.5"/><circle cx="104" cy="100" r="2.5"/><circle cx="112" cy="114" r="2.5"/><circle cx="94" cy="120" r="2.5"/><circle cx="104" cy="124" r="2.5"/></g></g>
<g class="f" style="animation-delay:.55s"><circle cx="45" cy="128" r="20" fill="#d9a05b"/><path d="M33 124q12-8 24 0" stroke="#b9803c" fill="none" stroke-width="2"/></g>
<g class="f" style="animation-delay:.7s"><circle cx="155" cy="130" r="18" fill="#fff" stroke="#9fa9bd" stroke-width="3"/><circle cx="155" cy="130" r="12" fill="#e9b07b"/></g></svg>`;
const TABS = {
  student: [['today', 'Today', 'calendar'], ['week', 'This week', 'grid'], ['bill', 'My bill', 'receipt'], ['feedback', 'Feedback', 'message']],
  admin: [['overview', 'Overview', 'chart'], ['students', 'Students', 'users'], ['menu', 'Menu editor', 'edit'], ['feedback', 'Feedback', 'message']],
};

// ---------- state & API ----------
let token = null;
try { token = localStorage.getItem('mess-token'); } catch (e) { /* storage unavailable */ }
let MEALS = [];
let clock = null; // mess-timezone time reported by the server

const S = { user: null, hostels: [], menu: {}, students: [], skips: {}, fb: [], tab: null };
let draft = { meal: 'lunch', rating: 0 };
let ed = { day: 1, meal: 0 };

async function api(method, url, body) {
  const res = await fetch('/api' + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (res.status === 401 && token) { logout(); throw new Error('Your session has expired. Please sign in again.'); }
  if (!res.ok) throw new Error((data && data.error) || 'Request failed');
  return data;
}
async function load() {
  const d = await api('GET', '/bootstrap');
  MEALS = d.meals;
  clock = { date: d.now.date, hour: d.now.hour, at: Date.now() };
  Object.assign(S, { user: d.user, hostels: d.hostels, menu: d.menu, students: d.students, skips: d.skips, fb: d.fb });
}
const run = fn => fn().catch(e => toast(e.message, true));
function toast(msg, bad) {
  const t = $('#toast');
  t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600);
}
function logout() {
  token = null; S.user = null;
  try { localStorage.removeItem('mess-token'); } catch (e) { /* ignore */ }
  showLogin();
}

// ---------- meal helpers ----------
// All "today" logic uses the server's mess timezone so the page and the API always agree.
function messNow() {
  if (!clock) { const n = new Date(); return { date: key(n), hour: n.getHours() + n.getMinutes() / 60 }; }
  let h = clock.hour + (Date.now() - clock.at) / 36e5, date = clock.date;
  while (h >= 24) { h -= 24; const [y, m, d] = date.split('-').map(Number); date = key(new Date(y, m - 1, d + 1)); }
  return { date, hour: h };
}
function today() { const [y, m, d] = messNow().date.split('-').map(Number); return new Date(y, m - 1, d); }
function tomorrow() { const t = today(); t.setDate(t.getDate() + 1); return t; }
function status(date, m) {
  const n = messNow(), k = key(date), nk = n.date;
  if (k < nk) return 'done';
  if (k > nk) return 'upcoming';
  const h = n.hour;
  return h >= m.end ? 'done' : h >= m.start ? 'now' : 'upcoming';
}
const isSkipped = (date, m, sid = S.user.id) => !!(S.skips[sid] || {})[`${key(date)}|${m.id}`];
const menuOf = (date, i) => (S.menu[date.getDay()] || [])[i] || '—';
const headcount = (date, m) => S.students.filter(s => !isSkipped(date, m, s.id)).length;
const nextMeal = () => { const d = today(); return MEALS.find(m => status(d, m) !== 'done') || null; };
const avgRating = id => { const r = S.fb.filter(f => f.meal === id); return r.length ? (r.reduce((a, f) => a + f.rating, 0) / r.length).toFixed(1) : '—'; };

function billCalc(sid) {
  const n = today(), y = n.getFullYear(), mo = n.getMonth(), dim = new Date(y, mo + 1, 0).getDate();
  const eaten = {}; MEALS.forEach(m => eaten[m.id] = 0);
  let total = 0, saved = 0, projected = 0;
  for (let day = 1; day <= dim; day++) {
    const d = new Date(y, mo, day);
    for (const m of MEALS) {
      const sk = isSkipped(d, m, sid), st = status(d, m);
      if (st === 'upcoming') { if (sk) saved += m.price; else projected += m.price; }
      else if (sk) saved += m.price;
      else { eaten[m.id]++; total += m.price; }
    }
  }
  return { eaten, total, saved, projected: projected + total, month: n.toLocaleString('en-IN', { month: 'long', year: 'numeric' }) };
}

// ---------- student views ----------
function mealCard(date, m, i) {
  const st = status(date, m), sk = isSkipped(date, m);
  const items = menuOf(date, i).split(',').map(x => `<li>${esc(x.trim())}</li>`).join('');
  const badge = sk ? '<span class="badge skip">Skipped</span>' : st === 'now' ? '<span class="badge now">Serving now</span>' : st === 'done' ? '<span class="badge done">Served</span>' : '<span class="badge">Upcoming</span>';
  return `<article class="card meal ${m.id}"><div class="row"><h3><span aria-hidden="true">${ICON[m.id]}</span> ${m.name}</h3>${badge}</div>
  <div class="meta">${m.label} · ${inr(m.price)}</div><ul>${items}</ul>
  <button class="btn ${sk ? 'ghost' : ''}" data-skip="${key(date)}|${m.id}" ${st !== 'upcoming' ? 'disabled' : ''}>${sk ? 'Undo skip' : 'Skip this meal'}</button></article>`;
}
function vToday() {
  const d = today(), nm = nextMeal(), i = nm ? MEALS.indexOf(nm) : 0;
  const hero = nm
    ? `<div><h2>${status(d, nm) === 'now' ? nm.name + ' is being served' : 'Next up: ' + nm.name}</h2><p>${esc(menuOf(d, i).split(',')[0])} and more · ${nm.label}</p></div><div class="pill">${inr(nm.price)}</div>`
    : `<div><h2>Meals are done for today</h2><p>Tomorrow’s breakfast: ${esc(menuOf(tomorrow(), 0).split(',')[0])}</p></div>`;
  return `<section class="hero">${hero}${THALI}</section><div class="grid">${MEALS.map((m, k) => mealCard(d, m, k)).join('')}</div>
  <p class="meta">Skip a meal before it starts and it is removed from your bill.</p>`;
}
function vWeek() {
  const s = today(); s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  const rows = [];
  for (let k = 0; k < 7; k++) {
    const d = new Date(s); d.setDate(s.getDate() + k);
    rows.push(`<tr class="${key(d) === key(today()) ? 'today' : ''}"><th scope="row">${DAYN[d.getDay()]}<div class="meta">${d.getDate()}/${d.getMonth() + 1}</div></th>` +
      MEALS.map((m, i) => {
        const sk = isSkipped(d, m), up = status(d, m) === 'upcoming';
        return `<td class="${sk ? 'skipped' : ''}">${esc(menuOf(d, i))}${up ? `<button class="cellbtn" data-skip="${key(d)}|${m.id}">${sk ? 'Undo skip' : 'Skip'}</button>` : ''}</td>`;
      }).join('') + '</tr>');
  }
  return `<div class="tablewrap"><table style="min-width:760px"><thead><tr><th>Day</th>${MEALS.map(m => `<th>${m.name}<div class="meta">${m.label}</div></th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}
function vBill() {
  const b = billCalc(S.user.id);
  return `<section class="hero"><div><h2>${b.month}</h2><p>${esc(S.user.name)} · ${esc(S.user.roll)}. Billed so far for meals already served.</p></div><div class="pill">${inr(b.total)}</div></section>
  <div class="grid"><div class="card kpi"><div class="meta">Projected month total</div><div class="n">${inr(b.projected)}</div></div>
  <div class="card kpi"><div class="meta">Saved by skipping</div><div class="n">${inr(b.saved)}</div></div></div>
  <h3 class="sec">Meals eaten this month</h3>
  <div class="tablewrap"><table style="min-width:0"><thead><tr><th>Meal</th><th>Count</th><th>Rate</th><th>Amount</th></tr></thead><tbody>
  ${MEALS.map(m => `<tr><td>${m.name}</td><td>${b.eaten[m.id]}</td><td>${inr(m.price)}</td><td>${inr(b.eaten[m.id] * m.price)}</td></tr>`).join('')}</tbody></table></div>`;
}
function vFeedback() {
  const mine = S.fb;
  return `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(290px,1fr))"><div class="card"><h3>Rate a meal</h3>
  <label for="fbmeal">Meal</label><select id="fbmeal">${MEALS.map(m => `<option value="${m.id}" ${draft.meal === m.id ? 'selected' : ''}>${m.name}</option>`).join('')}</select>
  <label id="rl">Rating</label><div class="stars" role="group" aria-labelledby="rl">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-star="${n}" class="${n <= draft.rating ? 'on' : ''}" aria-label="${n} star${n > 1 ? 's' : ''}">★</button>`).join('')}</div>
  <label for="fbtext">Comment</label><textarea id="fbtext" maxlength="500" placeholder="What was good or needs fixing?"></textarea>
  <p><button class="btn" id="fbsend" type="button">Send feedback</button></p></div>
  <div class="card"><h3>Your feedback</h3>${mine.length ? mine.map(f => `<div class="fb"><strong>${MEALS.find(m => m.id === f.meal).name}</strong> · ${'★'.repeat(f.rating)}<div>${esc(f.text) || '<span class="meta">No comment</span>'}</div>
  <div class="meta">${esc(f.date)} · ${f.resolved ? 'Resolved by the mess committee' : 'Sent to the mess committee'}</div></div>`).join('') : '<div class="empty">You have not sent any feedback yet.</div>'}</div></div>`;
}

// ---------- admin views ----------
function aOverview() {
  const d = today(), nm = nextMeal(), open = S.fb.filter(f => !f.resolved).length;
  const all = S.fb.length ? (S.fb.reduce((a, f) => a + f.rating, 0) / S.fb.length).toFixed(1) : '—';
  const t = tomorrow(), total = Math.max(1, S.students.length);
  return `<div class="kpis">
  <div class="card kpi"><div class="meta">Registered students</div><div class="n">${S.students.length}</div></div>
  <div class="card kpi"><div class="meta">${nm ? 'Expected for ' + nm.name : 'Meals done today'}</div><div class="n">${nm ? headcount(d, nm) : '—'}</div></div>
  <div class="card kpi"><div class="meta">Average rating</div><div class="n">${all}</div></div>
  <div class="card kpi"><div class="meta">Open complaints</div><div class="n">${open}</div></div></div>
  <h3 class="sec" style="margin-top:0">Today’s headcount</h3>
  <div class="grid">${MEALS.map(m => {
    const h = headcount(d, m), pct = Math.round(h / total * 100), st = status(d, m);
    return `<div class="card meal ${m.id}"><div class="row"><h3><span aria-hidden="true">${ICON[m.id]}</span> ${m.name}</h3><span class="badge ${st === 'now' ? 'now' : st === 'done' ? 'done' : ''}">${st === 'done' ? 'Served' : st === 'now' ? 'Serving' : 'Upcoming'}</span></div>
    <div class="kpi"><div class="n">${h}</div></div><div class="bar" role="img" aria-label="${pct}% attending"><i style="width:${pct}%"></i></div>
    <div class="meta">${S.students.length - h} skipped · rating ${avgRating(m.id)} / 5</div><div class="meta">Cost to cover: ${inr(h * m.price)}</div></div>`;
  }).join('')}</div>
  <h3 class="sec">Tomorrow’s expected diners</h3>
  <div class="tablewrap"><table style="min-width:0"><thead><tr><th>Meal</th><th>Expected</th><th>Menu</th></tr></thead><tbody>
  ${MEALS.map((m, i) => `<tr><td>${m.name}</td><td>${headcount(t, m)}</td><td>${esc(menuOf(t, i))}</td></tr>`).join('')}</tbody></table></div>`;
}
function aStudents() {
  const rows = S.students.map(s => {
    const b = billCalc(s.id), n = Object.values(b.eaten).reduce((a, c) => a + c, 0);
    return `<tr><th scope="row">${esc(s.name)}</th><td>${esc(s.roll)}</td><td>${esc(s.hostel)}</td><td>${n}</td><td>${inr(b.total)}</td>
    <td><button class="btn danger" data-rm="${s.id}" aria-label="Remove ${esc(s.name)}">Remove</button></td></tr>`;
  }).join('');
  return `<div class="row"><h3 class="sec" style="margin:0">${S.students.length} registered students</h3><button class="btn ghost" id="csvbtn">Download billing CSV</button></div>
  <div class="tablewrap" style="margin-top:12px">${S.students.length ? `<table><thead><tr><th>Name</th><th>Roll no.</th><th>Hostel</th><th>Meals eaten</th><th>Bill so far</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty">No students yet. Register the first one below.</div>'}</div>
  <h3 class="sec">Register a student</h3>
  <div class="card formcard"><label for="rn">Full name</label><input type="text" id="rn" maxlength="80" autocomplete="off">
  <label for="rr">Roll number</label><input type="text" id="rr" maxlength="40" placeholder="IIIT2025014" autocomplete="off">
  <label for="rh">Hostel</label><select id="rh">${S.hostels.map(h => `<option>${esc(h)}</option>`).join('')}</select>
  <label for="rp">Temporary password</label><input type="text" id="rp" autocomplete="off" placeholder="At least 8 characters">
  <p><button class="btn" id="regsave">Register student</button></p></div>`;
}
function aMenu() {
  return `<div class="card formcard"><h3>Edit weekly menu</h3><p class="meta">Separate dishes with commas. Students see the change straight away.</p>
  <label for="eday">Day</label><select id="eday">${[1, 2, 3, 4, 5, 6, 0].map(d => `<option value="${d}" ${ed.day === d ? 'selected' : ''}>${DAYN[d]}</option>`).join('')}</select>
  <label for="emeal">Meal</label><select id="emeal">${MEALS.map((m, i) => `<option value="${i}" ${ed.meal === i ? 'selected' : ''}>${m.name}</option>`).join('')}</select>
  <label for="eitems">Dishes</label><textarea id="eitems" maxlength="300">${esc((S.menu[ed.day] || [])[ed.meal] || '')}</textarea>
  <p><button class="btn" id="esave">Save menu</button></p></div>`;
}
function aFeedback() {
  const list = S.fb.slice().sort((a, b) => a.resolved - b.resolved || b.id - a.id);
  return `<div class="card"><h3>Student feedback</h3>${list.length ? list.map(f => `<div class="fb"><div class="row"><div><strong>${MEALS.find(m => m.id === f.meal).name}</strong> · ${'★'.repeat(f.rating)}
  <span class="meta"> · ${esc(f.author)}, ${esc(f.hostel)} · ${esc(f.date)}</span></div>
  <button class="btn ghost" data-res="${f.id}" data-to="${f.resolved ? 0 : 1}">${f.resolved ? 'Reopen' : 'Mark resolved'}</button></div>
  <div>${esc(f.text) || '<span class="meta">No comment</span>'}</div></div>`).join('') : '<div class="empty">No feedback yet.</div>'}</div>`;
}

// ---------- shell ----------
function showLogin(msg) {
  $('#app').innerHTML = `<div class="login"><section class="lbrand">${THALI}<h1>IIIT Mess</h1><p>Menus, meal skipping and billing in one place.</p></section>
  <section class="lform"><form id="lf"><h2>Sign in</h2><p class="meta">Use your roll number and the password issued by the mess office.</p>
  <label for="lrole">Sign in as</label><select id="lrole"><option value="student">Student</option><option value="admin">Admin</option></select>
  <label for="lr">Roll number</label><input id="lr" type="text" autocomplete="username" autocapitalize="characters" required>
  <label for="lp">Password</label><input id="lp" type="password" autocomplete="current-password" required>
  <p class="err" id="le" role="alert">${esc(msg || '')}</p><button class="btn wide" type="submit">Sign in</button></form></section></div>`;
  document.body.classList.add('intro');
  setTimeout(() => document.body.classList.remove('intro'), 1800);
  const f = $('#lr'); if (f) f.focus();
}
function renderShell() {
  const u = S.user; S.tab = TABS[u.role][0][0];
  const initials = u.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  $('#app').innerHTML = `<div class="shell"><aside class="side"><div class="sbrand">${LOGO}<div><strong>IIIT Mess</strong><span>${u.role === 'admin' ? 'Administration' : 'Student portal'}</span></div></div>
  <nav id="tabs" role="tablist" aria-label="Sections"></nav>
  <div class="me"><div class="avatar" aria-hidden="true">${esc(initials)}</div><div class="who"><strong>${esc(u.name)}</strong><span>${esc(u.roll)}</span></div>
  <button class="ib" id="pwbtn" title="Change password" aria-label="Change password">${ico('key')}</button><button class="ib" id="outbtn" title="Sign out" aria-label="Sign out">${ico('logout')}</button></div></aside>
  <main><header class="top"><h1 id="title"></h1><p id="today"></p></header><div id="view"></div></main></div>`;
  document.body.classList.add('intro');
  setTimeout(() => document.body.classList.remove('intro'), 1800);
}
function render() {
  if (!S.user) return;
  const tabs = TABS[S.user.role], cur = tabs.find(t => t[0] === S.tab) || tabs[0];
  $('#tabs').innerHTML = tabs.map(([id, l, ic]) => `<button role="tab" data-tab="${id}" aria-selected="${id === cur[0]}">${ico(ic)}<span>${l}</span></button>`).join('');
  $('#title').textContent = cur[1];
  $('#today').textContent = today().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const V = { student: { today: vToday, week: vWeek, bill: vBill, feedback: vFeedback }, admin: { overview: aOverview, students: aStudents, menu: aMenu, feedback: aFeedback } }[S.user.role];
  $('#view').innerHTML = V[cur[0]]();
}
function modal(title, body, okLabel, onOk) {
  const d = $('#dlg');
  d.innerHTML = `<form method="dialog"><h3>${title}</h3><div>${body}</div><div class="mact"><button class="btn ghost" value="x">Cancel</button><button class="btn" id="mok" value="ok">${okLabel}</button></div></form>`;
  d.showModal();
  $('#mok').onclick = async e => { e.preventDefault(); try { await onOk(); d.close(); } catch (er) { toast(er.message, true); } };
}
async function csvDownload() {
  const r = await fetch('/api/report.csv', { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) throw new Error('Could not export the report');
  const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = 'mess-billing.csv'; a.click(); URL.revokeObjectURL(a.href);
}
async function toggleSkip(dk, mid) {
  const m = MEALS.find(x => x.id === mid), [y, mo, d] = dk.split('-').map(Number);
  if (status(new Date(y, mo - 1, d), m) !== 'upcoming') return toast('This meal has already started', true);
  const sk = S.skips[S.user.id] = S.skips[S.user.id] || {}, k = `${dk}|${mid}`;
  if (sk[k]) { await api('DELETE', `/skips/${dk}/${mid}`); delete sk[k]; toast(`Skip removed for ${m.name}`); }
  else { await api('POST', '/skips', { date: dk, meal: mid }); sk[k] = 1; toast(`Skipped ${m.name}. You will not be billed`); }
  render();
}

// ---------- events ----------
document.addEventListener('submit', e => {
  if (e.target.id !== 'lf') return;
  e.preventDefault();
  run(async () => {
    try {
      const r = await api('POST', '/login', { role: $('#lrole').value, roll: $('#lr').value, password: $('#lp').value });
      token = r.token;
      try { localStorage.setItem('mess-token', token); } catch (er) { /* ignore */ }
      await load(); renderShell(); render();
    } catch (er) { const le = $('#le'); if (le) le.textContent = er.message; }
  });
});
document.addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  const D = t.dataset;
  if (D.tab) { S.tab = D.tab; render(); }
  else if (D.skip) { const [k, id] = D.skip.split('|'); run(() => toggleSkip(k, id)); }
  else if (D.star) { draft.rating = +D.star; draft.meal = $('#fbmeal').value; const tx = $('#fbtext').value; render(); $('#fbtext').value = tx; }
  else if (t.id === 'fbsend') run(async () => {
    if (!draft.rating) return toast('Choose a star rating first', true);
    draft.meal = $('#fbmeal').value;
    const f = await api('POST', '/feedback', { meal: draft.meal, rating: draft.rating, text: $('#fbtext').value });
    S.fb.unshift(f); draft.rating = 0; toast('Thanks, your feedback was sent'); render();
  });
  else if (D.res) run(async () => { await api('PATCH', `/feedback/${D.res}`, { resolved: D.to === '1' }); S.fb.find(f => f.id === +D.res).resolved = D.to === '1'; render(); });
  else if (t.id === 'esave') run(async () => {
    const items = $('#eitems').value;
    await api('PUT', '/menu', { day: ed.day, meal: ed.meal, items });
    (S.menu[ed.day] = S.menu[ed.day] || [])[ed.meal] = items.trim(); toast('Menu saved'); render();
  });
  else if (t.id === 'regsave') run(async () => {
    const s = await api('POST', '/students', { name: $('#rn').value, roll: $('#rr').value, hostel: $('#rh').value, password: $('#rp').value });
    S.students.push(s); S.students.sort((a, b) => a.roll.localeCompare(b.roll)); toast(`Registered ${s.name}`); render();
  });
  else if (D.rm) {
    const s = S.students.find(x => x.id === +D.rm);
    modal('Remove student', `<p>Remove <strong>${esc(s.name)}</strong> (${esc(s.roll)})? Their skips and feedback will be deleted too.</p>`, 'Remove', async () => {
      await api('DELETE', `/students/${s.id}`); S.students = S.students.filter(x => x.id !== s.id); delete S.skips[s.id]; S.fb = S.fb.filter(f => f.sid !== s.id); toast('Student removed'); render();
    });
  }
  else if (t.id === 'csvbtn') run(csvDownload);
  else if (t.id === 'outbtn') logout();
  else if (t.id === 'pwbtn') modal('Change password', '<label for="pc">Current password</label><input type="password" id="pc" autocomplete="current-password"><label for="pn">New password (8+ characters)</label><input type="password" id="pn" autocomplete="new-password">', 'Update password', async () => {
    await api('POST', '/password', { current: $('#pc').value, next: $('#pn').value }); toast('Password updated');
  });
});
document.addEventListener('change', e => {
  if (e.target.id === 'eday') { ed.day = +e.target.value; render(); }
  else if (e.target.id === 'emeal') { ed.meal = +e.target.value; render(); }
  else if (e.target.id === 'fbmeal') draft.meal = e.target.value;
});

// ---------- boot ----------
if (token) load().then(() => { renderShell(); render(); }).catch(() => logout());
else showLogin();
// Refresh admin feedback more often so new student submissions appear quickly.
let lastRefresh = Date.now();
setInterval(async () => {
  if (!S.user || document.hidden || $('#dlg').open) return;
  const a = document.activeElement;
  if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return;
  const feedbackView = S.user.role === 'admin' && S.tab === 'feedback';
  if (!feedbackView && Date.now() - lastRefresh < 45000) return;
  try { await load(); lastRefresh = Date.now(); render(); } catch (e) { /* next tick */ }
}, 10000);

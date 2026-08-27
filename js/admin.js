/* פאנל גבאי — תור אישורים, עריכה, ייצוא. */
(function () {
  'use strict';
  var CFG = window.CFG, TOK = null, T = 'sugg', DATA = {};

  var $ = function (i) { return document.getElementById(i); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  function H() {
    return {
      apikey: CFG.anon,
      Authorization: 'Bearer ' + (TOK || CFG.anon),
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    };
  }
  function api(p, o) {
    o = o || {}; o.headers = H();
    return fetch(CFG.url + '/rest/v1/' + p, o).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(t); });
      return r.status === 204 ? null : r.json();
    });
  }

  /* ---------- כניסה ---------- */
  function login(e) {
    e.preventDefault();
    var ph = $('lPh').value.replace(/\D/g, '');
    fetch(CFG.url + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { apikey: CFG.anon, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ph + '@gmach.local', password: $('lPw').value })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d.access_token) throw new Error();
      TOK = d.access_token;
      try { sessionStorage.setItem('gm_tok', TOK); } catch (x) {}
      show();
    }).catch(function () {
      $('lMsg').textContent = 'טלפון או סיסמה שגויים.';
      $('lMsg').className = 'msg err';
    });
  }

  function show() {
    $('login').hidden = true; $('app').hidden = false; $('out').hidden = false;
    load();
  }

  function load() {
    Promise.all([
      api('gmach_suggestions?select=*&order=created_at.desc&limit=200'),
      api('gmachim?select=*&order=code'),
      api('gmach_categories?select=*&order=sort'),
      api('gmach_searches?select=q,results,created_at&order=created_at.desc&limit=200')
    ]).then(function (r) {
      DATA.sugg = r[0]; DATA.gm = r[1]; DATA.cats = r[2]; DATA.se = r[3];
      var open = DATA.sugg.filter(function (s) { return s.status === 'new'; });
      $('bSugg').textContent = open.length;
      stats(); draw();
    }).catch(function (e) {
      $('pane').innerHTML = '<div class="empty"><b>שגיאת טעינה</b>' + esc(e.message) + '</div>';
    });
  }

  function stats() {
    var live = DATA.gm.filter(function (g) { return !g.is_wanted && g.status === 'approved'; });
    var want = DATA.gm.filter(function (g) { return g.is_wanted; });
    var open = DATA.sugg.filter(function (s) { return s.status === 'new'; });
    var noPhone = live.filter(function (g) { return !g.phone1; });
    var miss = {};
    DATA.se.forEach(function (s) { if (!s.results && s.q) miss[s.q] = (miss[s.q] || 0) + 1; });
    $('stat').innerHTML =
      box(live.length, 'גמ"חים פעילים') + box(open.length, 'ממתינים לאישור') +
      box(want.length, 'מבוקשים') + box(noPhone.length, 'בלי טלפון') +
      box(Object.keys(miss).length, 'חיפושים בלי תוצאה');
  }
  function box(n, t) { return '<div><b>' + n + '</b><span>' + t + '</span></div>'; }

  /* ---------- תצוגות ---------- */
  function draw() {
    if (T === 'sugg') return paneSugg();
    if (T === 'list') return paneList();
    if (T === 'search') return paneSearch();
    if (T === 'export') return paneExport();
  }

  function paneSugg() {
    var rows = DATA.sugg.filter(function (s) { return s.status === 'new'; });
    if (!rows.length) {
      $('pane').innerHTML = '<div class="empty"><b>אין הצעות ממתינות</b>' +
        'כל מה שנשלח מהאתר או מהקו הטלפוני יופיע כאן.</div>';
      return;
    }
    $('pane').innerHTML = '<div class="grid">' + rows.map(function (s) {
      var p = s.payload || {};
      var kinds = { 'new': 'גמ"ח חדש', fix: 'תיקון', remove: 'בקשת הסרה' };
      var kv = Object.keys(p).map(function (k) {
        if (!p[k]) return '';
        var v = k === 'category' ? catName(p[k]) : p[k];
        return '<dt>' + esc(labelOf(k)) + '</dt><dd>' + esc(v) + '</dd>';
      }).join('');
      return '<div class="card"><div class="cat">' + esc(kinds[s.kind] || s.kind) +
        ' · ' + esc(s.source) + ' · ' + new Date(s.created_at).toLocaleDateString('he-IL') +
        '</div><h3>' + esc(p.name || ('דיווח על קוד ' + (p.code || '—'))) + '</h3>' +
        '<dl class="kv">' + kv + '</dl>' +
        (s.reporter_name || s.reporter_phone
          ? '<div class="meta"><span><b>מדווח:</b> ' + esc(s.reporter_name || '') + ' ' +
            esc(s.reporter_phone || '') + '</span></div>' : '') +
        '<div class="acts">' +
        (s.kind === 'new'
          ? '<button class="btn pri js-ok" data-id="' + s.id + '">אשר ופרסם</button>' : '') +
        '<button class="btn js-done" data-id="' + s.id + '">טופל ידנית</button>' +
        '<button class="btn ghost js-rej" data-id="' + s.id + '">דחייה</button>' +
        '</div></div>';
    }).join('') + '</div>';
  }

  var LBL = {
    name: 'שם', category: 'קטגוריה', description: 'תיאור', owner_name: 'אצל',
    address: 'כתובת', phone1: 'טלפון', phone2: 'טלפון 2', hours: 'שעות',
    price: 'עלות', what: 'הדיווח', code: 'קוד'
  };
  function labelOf(k) { return LBL[k] || k; }

  function paneList() {
    $('pane').innerHTML = '<div class="wrap"><table class="tbl"><thead><tr>' +
      '<th>קוד</th><th>שם</th><th>קטגוריה</th><th>אצל</th><th>טלפון</th>' +
      '<th>סטטוס</th><th></th></tr></thead><tbody>' +
      DATA.gm.map(function (g) {
        return '<tr><td>' + g.code + '</td><td>' + esc(g.name) + '</td><td>' +
          esc(catName(g.category)) + '</td><td>' + esc(g.owner_name || '') + '</td><td>' +
          esc(g.phone1 || '—') + '</td><td>' +
          (g.is_wanted ? 'מבוקש' : g.status === 'approved' ? 'פעיל' : esc(g.status)) +
          '</td><td><button class="btn sm js-hide" data-id="' + g.id + '" data-s="' +
          (g.status === 'approved' ? 'hidden' : 'approved') + '">' +
          (g.status === 'approved' ? 'הסתר' : 'הפעל') + '</button></td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function catName(k) {
    var c = DATA.cats.filter(function (x) { return x.key === k; })[0];
    return c ? c.name : (k || '');
  }

  function paneSearch() {
    var agg = {};
    DATA.se.forEach(function (s) {
      if (!s.q) return;
      agg[s.q] = agg[s.q] || { n: 0, hits: 0 };
      agg[s.q].n++; agg[s.q].hits += s.results;
    });
    var rows = Object.keys(agg).map(function (q) {
      return { q: q, n: agg[q].n, avg: agg[q].hits / agg[q].n };
    }).sort(function (a, b) { return (a.avg - b.avg) || (b.n - a.n); });
    if (!rows.length) {
      $('pane').innerHTML = '<div class="empty"><b>עדיין לא חיפשו כלום</b>' +
        'כשתושבים יחפשו באתר, המילים יופיעו כאן — ובעיקר אלה שלא החזירו תוצאה.</div>';
      return;
    }
    $('pane').innerHTML = '<p style="color:var(--muted);font-size:14px">' +
      'מיון לפי הכי פחות תוצאות — אלה הגמ"חים שהיישוב מחפש ולא מוצא.</p>' +
      '<div class="wrap"><table class="tbl"><thead><tr><th>חיפוש</th><th>פעמים</th>' +
      '<th>תוצאות בממוצע</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr' + (r.avg === 0 ? ' style="background:#FFF6E8"' : '') + '><td>' +
          esc(r.q) + '</td><td>' + r.n + '</td><td>' + r.avg.toFixed(1) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function paneExport() {
    $('pane').innerHTML = '<div class="card"><h3>ייצוא הרשימה</h3>' +
      '<p>קובץ CSV עם כל הגמ"חים הפעילים — לפתיחה באקסל או להדבקה לגוגל שיטס.</p>' +
      '<div class="acts"><button class="btn pri" id="csv">הורדת CSV</button>' +
      '<button class="btn" id="copy">העתקה ללוח</button></div></div>';
    $('csv').onclick = function () {
      var b = new Blob(['﻿' + csv()], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(b); a.download = 'gmachim-maale-amos.csv'; a.click();
    };
    $('copy').onclick = function () {
      navigator.clipboard.writeText(csv()).then(function () {
        $('copy').textContent = 'הועתק ✓';
      });
    };
  }

  function csv() {
    var head = ['קוד', 'שם', 'קטגוריה', 'תיאור', 'אצל', 'טלפון', 'טלפון 2',
      'כתובת', 'שעות', 'עלות', 'הערות'];
    var q = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    return [head.map(q).join(',')].concat(
      DATA.gm.filter(function (g) { return !g.is_wanted && g.status === 'approved'; })
        .map(function (g) {
          return [g.code, g.name, catName(g.category), g.description, g.owner_name,
            g.phone1, g.phone2, g.address, g.hours, g.price, g.notes].map(q).join(',');
        })).join('\r\n');
  }

  /* ---------- פעולות ---------- */
  function approve(id) {
    var s = DATA.sugg.filter(function (x) { return x.id === +id; })[0];
    if (!s) return;
    var p = s.payload || {};
    api('gmachim', {
      method: 'POST',
      body: JSON.stringify({
        name: p.name, category: p.category || null, description: p.description || '',
        owner_name: p.owner_name || '', phone1: p.phone1 || '', phone2: p.phone2 || '',
        address: p.address || '', hours: p.hours || '', price: p.price || '',
        status: 'approved', is_wanted: false, source: s.source,
        verified_at: new Date().toISOString().slice(0, 10)
      })
    }).then(function () { return mark(id, 'done', 'אושר ופורסם'); })
      .then(load)
      .catch(function (e) { alert('שגיאה: ' + e.message); });
  }

  function mark(id, st, note) {
    return api('gmach_suggestions?id=eq.' + id, {
      method: 'PATCH',
      body: JSON.stringify({
        status: st, handled_note: note || '', handled_at: new Date().toISOString()
      })
    });
  }

  /* ---------- wiring ---------- */
  $('lForm').addEventListener('submit', login);
  $('out').addEventListener('click', function () {
    TOK = null; try { sessionStorage.removeItem('gm_tok'); } catch (e) {}
    location.reload();
  });
  $('tabs').addEventListener('click', function (e) {
    var b = e.target.closest('.tab'); if (!b) return;
    [].forEach.call(this.querySelectorAll('.tab'), function (x) { x.classList.remove('on'); });
    b.classList.add('on'); T = b.dataset.t; draw();
  });
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.classList.contains('js-ok')) return approve(t.dataset.id);
    if (t.classList.contains('js-done')) return mark(t.dataset.id, 'done', 'טופל ידנית').then(load);
    if (t.classList.contains('js-rej')) return mark(t.dataset.id, 'rejected', '').then(load);
    if (t.classList.contains('js-hide')) {
      return api('gmachim?id=eq.' + t.dataset.id, {
        method: 'PATCH', body: JSON.stringify({ status: t.dataset.s })
      }).then(load);
    }
  });

  try {
    var k = sessionStorage.getItem('gm_tok');
    if (k) { TOK = k; show(); }
  } catch (e) {}
})();

/* מרכז הגמ"חים — מעלה עמוס. אין תלויות, אין build. */
(function () {
  'use strict';

  var CFG = window.CFG;
  var H = {
    apikey: CFG.anon,
    Authorization: 'Bearer ' + CFG.anon,
    'Content-Type': 'application/json'
  };

  var S = { all: [], cats: [], cat: null, q: '', mode: 'new', target: null,
            wantedName: null };

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  function api(path, opt) {
    opt = opt || {};
    opt.headers = H;
    return fetch(CFG.url + '/rest/v1/' + path, opt).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(t || r.status); });
      return r.status === 204 ? null : r.json();
    });
  }

  function rpc(fn, body) {
    return api('rpc/' + fn, { method: 'POST', body: JSON.stringify(body || {}) });
  }

  /* ---------------- טלפון ---------------- */
  function telHref(p) { return 'tel:' + String(p).replace(/[^\d+]/g, ''); }
  function waHref(p, name) {
    var d = String(p).replace(/\D/g, '');
    if (d.charAt(0) === '0') d = '972' + d.slice(1);
    return 'https://wa.me/' + d + '?text=' +
      encodeURIComponent('שלום, פניתי דרך מרכז הגמ"חים של מעלה עמוס בנוגע ל' + name + '.');
  }
  function prettyPhone(p) {
    var d = String(p).replace(/\D/g, '');
    if (d.length === 10) return d.slice(0, 3) + '-' + d.slice(3);
    if (d.length === 9) return d.slice(0, 2) + '-' + d.slice(2);
    return p;
  }

  /* ---------------- כרטיס ---------------- */
  function card(g) {
    var wanted = g.is_wanted;
    var h = ['<div class="card' + (wanted ? ' wanted' : '') + '" data-code="' + g.code + '">'];
    if (!wanted) h.push('<span class="code">' + g.code + '</span>');
    h.push('<div class="cat">' + esc(g.cat_name || g.category_name || '') + '</div>');
    h.push('<h3>' + esc(g.name) +
      (wanted ? '<span class="wanted-tag">מבוקש</span>' : '') + '</h3>');
    if (g.description) h.push('<p>' + esc(g.description) + '</p>');

    var m = [];
    if (g.owner_name) m.push('<span><b>אצל</b> ' + esc(g.owner_name) + '</span>');
    if (g.address) m.push('<span>📍 ' + esc(g.address) + '</span>');
    if (g.hours) m.push('<span>🕒 ' + esc(g.hours) + '</span>');
    if (g.price) m.push('<span>💵 ' + esc(g.price) + '</span>');
    if (m.length) h.push('<div class="meta">' + m.join('') + '</div>');
    if (g.notes) h.push('<div class="meta"><span>' + esc(g.notes) + '</span></div>');

    h.push('<div class="acts">');
    if (wanted) {
      h.push('<button class="btn pri js-iam" data-name="' + esc(g.name) +
        '" data-cat="' + esc(g.category) + '">אני מפעיל את זה</button>');
    } else if (g.phone1) {
      h.push('<a class="btn pri" href="' + telHref(g.phone1) + '">☎ ' +
        esc(prettyPhone(g.phone1)) + '</a>');
      h.push('<a class="btn wa" href="' + waHref(g.phone1, g.name) +
        '" target="_blank" rel="noopener">וואטסאפ</a>');
      if (g.phone2) {
        h.push('<a class="btn sm" href="' + telHref(g.phone2) + '">☎ ' +
          esc(prettyPhone(g.phone2)) + '</a>');
      }
    } else {
      h.push('<span class="btn ghost" style="cursor:default;color:var(--muted)">אין טלפון רשום</span>');
    }
    if (!wanted) {
      h.push('<button class="btn sm ghost js-fix" data-code="' + g.code +
        '" data-name="' + esc(g.name) + '">דיווח על טעות</button>');
    }
    h.push('</div></div>');
    return h.join('');
  }

  /* ---------------- רינדור ---------------- */
  function render() {
    var q = S.q.trim().toLowerCase();
    var rows = S.all.filter(function (g) {
      if (S.cat && g.category !== S.cat) return false;
      if (!q) return true;
      return (g._hay || '').indexOf(q) >= 0;
    });
    var live = rows.filter(function (g) { return !g.is_wanted; });
    var want = rows.filter(function (g) { return g.is_wanted; });

    var cn = S.cats.filter(function (c) { return c.key === S.cat; })[0];
    $('listTitle').textContent = q ? 'תוצאות עבור "' + S.q.trim() + '"'
      : (cn ? cn.name : 'כל הגמ"חים');
    $('count').textContent = live.length ? '(' + live.length + ')' : '';
    $('resetBtn').hidden = !(S.cat || q);

    $('list').innerHTML = live.length ? live.map(card).join('') : emptyHtml(q);
    $('wantedBlock').hidden = !want.length;
    $('wcount').textContent = want.length ? '(' + want.length + ')' : '';
    $('wlist').innerHTML = want.map(card).join('');

    if (q) logSearch(q, live.length);
  }

  function emptyHtml(q) {
    if (!q) return '<div class="empty"><b>אין עדיין גמ"חים בקטגוריה הזו</b>' +
      'אתם מכירים אחד? לחצו "הוספת גמ"ח" למטה.</div>';
    return '<div class="empty"><b>לא נמצא גמ"ח בשם "' + esc(q) + '"</b>' +
      'אולי יש כזה ביישוב ורק לא רשום כאן — ' +
      '<button class="linkbtn js-open-new">הוסיפו אותו</button>, ' +
      'או נסו מילה אחרת.</div>';
  }

  var logT = null, logged = {};
  function logSearch(q, n) {
    clearTimeout(logT);
    logT = setTimeout(function () {
      if (q.length < 2 || logged[q]) return;
      logged[q] = 1;
      api('gmach_searches', {
        method: 'POST',
        body: JSON.stringify({ q: q, results: n, source: 'site' })
      }).catch(function () {});
    }, 1400);
  }

  /* ---------------- טעינה ---------------- */
  function boot() {
    var line = 'tel:' + CFG.line;
    $('lineLink').href = line;
    $('lineFoot').href = line;
    $('lineFoot').textContent = CFG.line + ' שלוחה ' + CFG.ext;

    Promise.all([
      api('gmach_categories?select=*&order=sort'),
      api('gmach_public?select=*')
    ]).then(function (r) {
      S.cats = r[0]; S.all = prep(r[1]);
      cache(r);
      drawChips(); render();
    }).catch(function () {
      var c = localStorage.getItem('gm_cache');
      if (c) {
        try {
          var d = JSON.parse(c);
          S.cats = d[0]; S.all = prep(d[1]);
          $('offline').style.display = 'block';
          drawChips(); render();
          return;
        } catch (e) {}
      }
      $('list').innerHTML = '<div class="empty"><b>לא הצלחנו לטעון את הרשימה</b>' +
        'בדקו חיבור לאינטרנט ונסו לרענן. בינתיים אפשר תמיד להתקשר: ' +
        CFG.line + ' שלוחה ' + CFG.ext + '.</div>';
    });
  }

  function prep(rows) {
    return rows.map(function (g) {
      g._hay = [g.name, g.description, g.owner_name, g.address, g.notes,
        g.category_name, g.cat_name].join(' ').toLowerCase();
      return g;
    });
  }

  function cache(r) {
    try { localStorage.setItem('gm_cache', JSON.stringify(r)); } catch (e) {}
  }

  function drawChips() {
    var h = ['<button class="chip on" data-c="">הכל</button>'];
    S.cats.forEach(function (c) {
      h.push('<button class="chip" data-c="' + esc(c.key) + '">' +
        (c.emoji ? c.emoji + ' ' : '') + esc(c.name) + '</button>');
    });
    $('chips').innerHTML = h.join('');
  }

  /* ---------------- מודאל ---------------- */
  function openModal(mode, opts) {
    opts = opts || {};
    S.mode = mode; S.target = opts.code || null; S.wantedName = null;
    $('mMsg').className = 'msg';
    $('fNew').hidden = mode === 'fix';
    $('fFix').hidden = mode !== 'fix';
    $('fName').required = mode !== 'fix';

    if (mode === 'fix') {
      $('mTitle').textContent = 'דיווח על ' + (opts.name || 'גמ"ח');
      $('mSub').textContent = 'תודה. הדיווח מגיע לאחראי המאגר ומטופל ידנית.';
    } else if (mode === 'iam') {
      $('mTitle').textContent = 'אני מפעיל את זה';
      $('mSub').textContent = 'מעולה. מלאו את הפרטים והגמ"ח יעלה לאוויר.';
      $('fName').value = opts.name || '';
      S.wantedName = opts.name || null;   // כדי שהאישור יפעיל ולא ישכפל
      if (opts.cat) $('fCat').value = opts.cat;
    } else {
      $('mTitle').textContent = 'הוספת גמ"ח';
      $('mSub').textContent = 'הפרטים נשלחים לאישור, ומתפרסמים תוך יום-יומיים.';
    }
    $('ov').classList.add('on');
    setTimeout(function () {
      (mode === 'fix' ? $('fWhat') : $('fName')).focus();
    }, 60);
  }

  function closeModal() { $('ov').classList.remove('on'); }

  function submit(e) {
    e.preventDefault();
    if ($('hp').value) { closeModal(); return; }          // honeypot

    var kind = S.mode === 'fix' ? 'fix' : 'new';
    var payload;
    if (kind === 'fix') {
      var w = $('fWhat').value.trim();
      if (!w) { return say('נא לכתוב מה צריך לתקן.', 'err'); }
      payload = { code: S.target, what: w };
    } else {
      var name = $('fName').value.trim();
      var ph = $('fPh1').value.trim();
      if (!name) return say('נא למלא שם גמ"ח.', 'err');
      if (!/\d{7,}/.test(ph.replace(/\D/g, ''))) return say('נא למלא טלפון תקין.', 'err');
      payload = {
        name: name, category: $('fCat').value,
        description: $('fDesc').value.trim(), owner_name: $('fOwner').value.trim(),
        address: $('fAddr').value.trim(), phone1: ph, phone2: $('fPh2').value.trim(),
        hours: $('fHours').value.trim(), price: $('fPrice').value.trim()
      };
      if (S.wantedName) payload.activates_wanted = S.wantedName;
    }

    $('mSend').disabled = true;
    api('gmach_suggestions', {
      method: 'POST',
      body: JSON.stringify({
        kind: kind, payload: payload, source: 'site',
        reporter_name: $('fRep').value.trim(),
        reporter_phone: $('fRepPh').value.trim()
      })
    }).then(function () {
      say('התקבל, תודה! הפרטים יעברו אישור ויעלו לאתר.', 'ok');
      $('mForm').reset();
      setTimeout(closeModal, 2200);
    }).catch(function () {
      say('השליחה נכשלה. אפשר גם להשאיר הודעה בקו: ' + CFG.line +
          ' שלוחה ' + CFG.ext + '.', 'err');
    }).then(function () { $('mSend').disabled = false; });
  }

  function say(t, k) { var m = $('mMsg'); m.textContent = t; m.className = 'msg ' + k; }

  /* ---------------- אירועים ---------------- */
  function wire() {
    var t = null;
    $('q').addEventListener('input', function () {
      S.q = this.value;
      $('clearq').style.display = this.value ? 'block' : 'none';
      clearTimeout(t); t = setTimeout(render, 110);
    });
    $('clearq').addEventListener('click', function () {
      $('q').value = ''; S.q = ''; this.style.display = 'none'; render(); $('q').focus();
    });
    $('chips').addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      [].forEach.call(this.querySelectorAll('.chip'), function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      S.cat = b.dataset.c || null;
      render(); window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    $('resetBtn').addEventListener('click', function () {
      S.cat = null; S.q = ''; $('q').value = ''; $('clearq').style.display = 'none';
      drawChips(); render();
    });
    $('addBtn').addEventListener('click', function () { openModal('new'); });
    $('mCancel').addEventListener('click', closeModal);
    $('mForm').addEventListener('submit', submit);
    $('ov').addEventListener('click', function (e) { if (e.target === this) closeModal(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });
    document.addEventListener('click', function (e) {
      var f = e.target.closest('.js-fix');
      if (f) return openModal('fix', { code: +f.dataset.code, name: f.dataset.name });
      var i = e.target.closest('.js-iam');
      if (i) return openModal('iam', { name: i.dataset.name, cat: i.dataset.cat });
      if (e.target.closest('.js-open-new')) return openModal('new');
    });
    // מילוי הקטגוריות בטופס אחרי הטעינה
    var iv = setInterval(function () {
      if (!S.cats.length) return;
      clearInterval(iv);
      $('fCat').innerHTML = S.cats.map(function (c) {
        return '<option value="' + esc(c.key) + '">' + esc(c.name) + '</option>';
      }).join('');
    }, 120);
  }

  /* ---------------- מצב תצוגה + הדפסה ---------------- */
  function theme() {
    var saved = null;
    try { saved = localStorage.getItem('gm_theme'); } catch (e) {}
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    paintThemeBtn();

    $('themeBtn').addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme');
      if (!cur) {
        cur = window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark' : 'light';
      }
      var next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('gm_theme', next); } catch (e) {}
      paintThemeBtn();
    });
  }

  function paintThemeBtn() {
    var t = document.documentElement.getAttribute('data-theme');
    var dark = t === 'dark' ||
      (!t && window.matchMedia('(prefers-color-scheme: dark)').matches);
    $('themeBtn').textContent = dark ? '☀' : '🌙';
    var m = document.querySelector('meta[name=theme-color]');
    if (m) m.content = dark ? '#0A1729' : '#12233F';
  }

  function print_() {
    var n = S.all.filter(function (g) { return !g.is_wanted; }).length;
    $('printSub').textContent =
      n + ' גמ"חים · ' + new Date().toLocaleDateString('he-IL') +
      ' · ' + CFG.line + ' שלוחה ' + CFG.ext;
    window.print();
  }

  // deep-link: index.html?q=בוסטר  או  ?c=rechev  או  #101
  function fromUrl() {
    var p = new URLSearchParams(location.search);
    if (p.get('q')) { S.q = p.get('q'); $('q').value = S.q; $('clearq').style.display = 'block'; }
    if (p.get('c')) S.cat = p.get('c');
  }

  wire(); theme(); fromUrl(); boot();
  $('printBtn').addEventListener('click', print_);
  var p2 = $('printBtn2'); if (p2) p2.addEventListener('click', print_);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
  window.addEventListener('offline', function () { $('offline').style.display = 'block'; });
  window.addEventListener('online', function () { $('offline').style.display = 'none'; });
})();

// Suită adversarială pentru CRONOSALA. Rulează: node test.js <fișier.html>
const puppeteer = require('puppeteer-core');
const FILE = process.argv[2];
const results = [];
const rec = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  — ' + detail : '')); };

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 60000, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--disable-gpu'] });
  async function fresh(vp = { width: 412, height: 800, isMobile: true, hasTouch: true }) {
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
    page.on('dialog', d => d.accept('Test preset'));
    await page.setViewport(vp);
    await page.evaluateOnNewDocument(() => { window.__T = 1700000000000; Date.now = () => window.__T; });
    await page.goto('file://' + FILE);
    await new Promise(r => setTimeout(r, 150));
    return { page, errs };
  }
  const clickDlg = page => page.evaluate(() => { const b = document.getElementById('dlgOk'); const d = document.getElementById('dlg'); if (b && d && !d.hidden) { b.click(); return true } return false });

  // ---------- T1: încărcare ----------
  {
    const { page, errs } = await fresh();
    const n = await page.evaluate(() => document.querySelectorAll('#grid .card').length);
    rec('T1 încărcare fără erori', errs.length === 0, errs.join(' | '));
    rec('T1 cardurile din home', n === 19, 'carduri=' + n);
    await page.close();
  }

  // ---------- T2/T3: constructori ----------
  {
    const { page, errs } = await fresh();
    const r = await page.evaluate(() => {
      const out = { bad: [], tot: {} };
      for (const T of TYPES) {
        if (!T.build) continue;
        let seq; try { seq = T.build(defOf(T)); } catch (e) { out.bad.push(T.id + ' aruncă ' + e.message); continue; }
        if (!seq.length) out.bad.push(T.id + ' secvență goală');
        seq.forEach((p, i) => {
          if (!(p.dur === null || (Number.isFinite(p.dur) && p.dur > 0))) out.bad.push(T.id + '#' + i + ' dur=' + p.dur);
          if (!p.name || typeof p.name !== 'string') out.bad.push(T.id + '#' + i + ' fără nume');
          if (!['work', 'rest', 'prep'].includes(p.t)) out.bad.push(T.id + '#' + i + ' tip=' + p.t);
        });
        out.tot[T.id] = seq.reduce((a, p) => a + (p.dur || 0), 0) + 's/' + seq.length;
      }
      return out;
    });
    rec('T2 secvențe implicite valide', r.bad.length === 0, r.bad.slice(0, 5).join('; '));
    console.log('     totaluri:', JSON.stringify(r.tot));

    const fz = await page.evaluate(() => {
      const bad = {}; let runs = 0, degenerate = 0, huge = 0;
      const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
      const junk = () => [NaN, undefined, null, '', 'abc', -5, 0, 1.5, '12', 7, 3][rnd(0, 10)];
      for (const T of TYPES) {
        if (!T.build) continue;
        for (let it = 0; it < 400; it++) {
          const c = defOf(T);
          T.fields.forEach(f => {
            if (f.kind === 'int' || f.kind === 'time') c[f.k] = Math.random() < .25 ? junk() : rnd(f.min, f.max);
            else if (f.kind === 'bool') c[f.k] = Math.random() < .5;
            else if (f.kind === 'text') c[f.k] = Math.random() < .2 ? junk() : 'x'.repeat(rnd(0, 60));
            else if (f.kind === 'list') c[f.k] = Array.from({ length: rnd(0, 6) }, () => { const o = {}; f.cols.forEach(cc => o[cc.k] = cc.kind === 'num' ? (Math.random() < .3 ? junk() : rnd(cc.min, cc.max)) : (Math.random() < .3 ? junk() : 'e' + rnd(0, 9))); return o; });
          });
          runs++;
          let seq; try { seq = T.build(c); } catch (e) { (bad[T.id + ' throw: ' + e.message] = (bad[T.id + ' throw: ' + e.message] || 0) + 1); continue; }
          if (seq.length > 20000) huge++;
          seq.forEach(p => { if (!(p.dur === null || (Number.isFinite(p.dur) && p.dur > 0))) bad[T.id + ' dur invalid ' + p.dur] = (bad[T.id + ' dur invalid ' + p.dur] || 0) + 1; if (typeof p.name !== 'string' || !p.name.trim()) bad[T.id + ' nume invalid'] = (bad[T.id + ' nume invalid'] || 0) + 1; });
          if (seq.length && seq.every(p => p.t === 'prep')) degenerate++;
        }
      }
      return { bad, runs, degenerate, huge };
    });
    const keys = Object.keys(fz.bad);
    rec('T3 fuzz constructori (' + fz.runs + ' cfg-uri)', keys.length === 0, keys.slice(0, 6).map(k => k + ' ×' + fz.bad[k]).join('; '));
    rec('T3 fără secvențe doar-pregătire pornibile', fz.degenerate === 0, 'degenerate=' + fz.degenerate);
    rec('T3 fără secvențe gigantice', fz.huge === 0, 'huge=' + fz.huge);
    await page.close();
  }

  // ---------- T3b: stocare coruptă ----------
  {
    const { page } = await fresh();
    const hung = [];
    for (const id of ['hiit', 'tempo', 'circuit', 'pyr', 'emom', 'sets']) {
      const pg = await browser.newPage(); pg.on('dialog', d => d.accept());
      await pg.evaluateOnNewDocument((id) => { window.__T = 1700000000000; Date.now = () => window.__T; localStorage.setItem('cronosala.cfg.' + id, JSON.stringify({ rounds: 1e9, sets: 1e9, reps: 1e9, n: 1e9, start: 1, step: 0, peak: 1e9, work: 1e9, list: [{ n: 'x', sets: 1e9, s: 1e9, rest: 5 }] })); }, id);
      await pg.goto('file://' + FILE);
      const ok = await Promise.race([
        pg.evaluate((id) => { const t0 = performance.now(); openType(id); return performance.now() - t0; }, id).then(ms => ms < 3000 ? 'ok' : 'lent ' + Math.round(ms)),
        new Promise(r => setTimeout(() => r('BLOCAT'), 6000))
      ]).catch(e => 'EROARE');
      if (ok !== 'ok') hung.push(id + ':' + ok);
      pg.close().catch(() => { });
    }
    rec('T3b cfg corupt din stocare nu blochează pagina', hung.length === 0, hung.join(', '));
    await page.close();
    { const cl = await browser.newPage(); await cl.goto('file://' + FILE); await cl.evaluate(() => localStorage.clear()); await cl.close(); }
  }

  // ---------- T4: motor ----------
  {
    const { page, errs } = await fresh();
    const r = await page.evaluate(() => {
      const out = [];
      const run = (id, maxStep, tol) => {
        const T = TYPES.find(t => t.id === id); const cfg = defOf(T); const seq = T.build(cfg);
        if (seq.some(p => p.dur == null)) return null;
        const expected = seq.reduce((a, p) => a + p.dur, 0) * 1000;
        let entered = 0; const _e = window.enter; window.enter = (...a) => { entered++; return _e(...a); };
        closeRunQuiet();
        openRun(T.name, seq, T.name); begin();
        let g = 0; while (!E.fin && g++ < 400000) { window.__T += 20 + Math.floor(Math.random() * maxStep); tick(); }
        window.enter = _e;
        const res = { id, fin: E.fin, drift: E.tot - expected, entered, n: seq.length, tol, iters: g };
        closeRunQuiet();
        return res;
      };
      window.closeRunQuiet = () => { try { E.started = false; E.fin = true; pause(); document.getElementById('run').hidden = true; document.body.style.overflow = ''; } catch (e) { } };
      for (const id of ['rest', 'cd', 'hiit', 'tabata', 'box', 'emom', 'amrap', 'circuit', 'tempo', 'iso', 'pyr']) {
        const a = run(id, 280, 300); if (a) out.push(a);
        const b = run(id, 6000, 6000); if (b) out.push({ ...b, id: id + '(salturi mari)' });
      }
      return out;
    });
    for (const x of r) rec('T4 simulare ' + x.id, x.fin && Math.abs(x.drift) <= x.tol + 100 && x.entered === x.n, `fin=${x.fin} drift=${Math.round(x.drift)}ms enter=${x.entered}/${x.n}`);

    // pauză/reluare
    const p = await page.evaluate(() => {
      const T = TYPES.find(t => t.id === 'cd'); openRun('t', T.build({ prep: 0, total: 100 }), 't'); begin();
      window.__T += 10000; tick(); const a = E.carry; pause();
      window.__T += 50000; const b = E.carry; begin(); window.__T += 5000; tick(); const c = E.carry;
      return { a, b, c, tot: E.tot };
    });
    rec('T4 pauza nu consumă timp', p.a === 10000 && p.b === 10000 && p.c === 15000 && p.tot === 15000, JSON.stringify(p));

    // +15 s apoi reset
    const pr = await page.evaluate(() => {
      const T = TYPES.find(t => t.id === 'cd'); openRun('t', T.build({ prep: 0, total: 100 }), 't'); begin();
      document.getElementById('bPlus').click(); const during = E.seq[0].dur;
      pause(); resetState(); render(); return { during, after: E.seq[0].dur };
    });
    rec('T4 reset restaurează duratele după +15 s', pr.after === 100, JSON.stringify(pr));

    // faze manuale + contor
    const m = await page.evaluate(() => {
      localStorage.removeItem('cronosala.hist');
      const T = TYPES.find(t => t.id === 'sets'); openRun('t', T.build({ prep: 0, list: [{ n: 'A', sets: 2, r: '', rest: 5 }] }), 't'); begin();
      window.__T += 60000; tick(); const still = E.i; next(); const afterNext = E.i;
      window.__T += 5000; tick(); const afterRest = E.i;
      next(); const fin = E.fin; return { still, afterNext, afterRest, fin, hist: JSON.parse(localStorage.getItem('cronosala.hist') || '[]').length };
    });
    rec('T4 faze manuale (serii) + pauză automată', m.still === 0 && m.afterNext === 1 && m.afterRest === 2 && m.fin === true, JSON.stringify(m));
    rec('T4 istoric logat o singură dată', m.hist === 1, 'hist=' + m.hist);
    await page.evaluate(() => { try { closeRunQuiet() } catch (e) { } });
    rec('T4 fără erori de pagină', errs.length === 0, errs.slice(0, 3).join(' | '));
    await page.close();
  }

  // ---------- T5: monkey UI (pe tip, cu timeout) ----------
  {
    const bad = [];
    const ids = ['rest','cd','hiit','tabata','box','emom','amrap','circuit','sets','tempo','iso','pyr'];
    for (const id of ids) {
      const { page, errs } = await fresh();
      const t0 = Date.now();
      const res = await Promise.race([
        page.evaluate((id) => {
          const bad = []; const rnd = n => Math.floor(Math.random() * n);
          const junk = ['', '-5', '0', '999999', 'abc', '1e3', '  ', '7', '3.7', '--', '＋'];
          openType(id);
          for (let i = 0; i < 120; i++) {
            const root = document.getElementById('cfgBody');
            const els = [...root.querySelectorAll('button:not(#goBtn):not(#saveP), input')].filter(e => !e.disabled);
            if (!els.length) break;
            const e = els[rnd(els.length)];
            try {
              if (e.tagName === 'BUTTON') e.click();
              else if (e.type === 'checkbox') { e.checked = !e.checked; e.dispatchEvent(new Event('change', { bubbles: true })); }
              else { e.value = junk[rnd(junk.length)]; e.dispatchEvent(new Event('input', { bubbles: true })); if (Math.random() < .6) e.dispatchEvent(new Event('change', { bubbles: true })); }
            } catch (err) { bad.push(id + ' ex: ' + err.message); }
            const txt = document.getElementById('config').textContent;
            if (/NaN|undefined|Infinity|\[object/.test(txt)) { bad.push(id + ' text invalid: ' + (txt.match(/.{0,25}(NaN|undefined|Infinity|\[object).{0,10}/) || [''])[0]); break; }
          }
          return bad;
        }, id),
        new Promise(r => setTimeout(() => r(['BLOCAT >25s pe ' + id]), 25000))
      ]).catch(e => ['EROARE ' + e.message.slice(0, 60)]);
      bad.push(...res, ...errs);
      console.log('     monkey ' + id + ' ' + (Date.now() - t0) + 'ms');
      page.close().catch(() => { });
    }
    rec('T5 monkey pe formulare (fără NaN/undefined/excepții/blocaje)', bad.length === 0, bad.slice(0, 5).join(' | '));
  }

  // ---------- T6: tastatură ----------
  {
    const { page } = await fresh({ width: 1100, height: 700 });
    await page.evaluate(() => { const T = TYPES.find(t => t.id === 'cd'); openRun('t', T.build({ prep: 0, total: 100 }), 't'); begin(); });
    await page.click('#bPlay'); // pauză
    const s1 = await page.evaluate(() => E.running);
    await page.keyboard.press('Space');
    const s2 = await page.evaluate(() => E.running);
    rec('T6 Space nu dublează comutarea pe buton focalizat', s1 === false && s2 === true, `după click running=${s1}, după Space=${s2} (așteptat false→true)`);
    await page.close();
  }

  // ---------- T7: back cu overlay ----------
  {
    const { page } = await fresh();
    await page.evaluate(() => { openType('cd'); });
    await page.evaluate(() => document.getElementById('goBtn').click());
    await new Promise(r => setTimeout(r, 100));
    await page.evaluate(() => history.back());
    await new Promise(r => setTimeout(r, 300));
    await clickDlg(page);
    const st = await page.evaluate(() => ({ run: !document.getElementById('run').hidden, home: document.getElementById('home').classList.contains('on'), config: document.getElementById('config').classList.contains('on') }));
    rec('T7 Back cu overlay deschis rămâne consecvent', !st.run || !st.home, JSON.stringify(st));
    await page.close();
  }

  // ---------- T8: layout ----------
  for (const vp of [{ width: 320, height: 568, isMobile: true, hasTouch: true }, { width: 360, height: 640, isMobile: true, hasTouch: true }, { width: 640, height: 360, isMobile: true, hasTouch: true }, { width: 1280, height: 720 }]) {
    const { page } = await fresh(vp);
    const r = await page.evaluate(() => {
      const bad = [];
      const chk = n => { if (document.documentElement.scrollWidth > innerWidth + 1) bad.push(n + ' overflow-x ' + document.documentElement.scrollWidth + '>' + innerWidth); };
      chk('home');
      for (const t of TYPES) { if (t.fields) { openType(t.id); chk(t.id); } else go(t.screen); chk(t.screen || t.id); }
      go('history'); chk('history'); go('settings'); chk('settings');
      const seq = [{ t: 'work', name: 'Împins la piept înclinat cu priză îngustă la aparat Technogym', dur: 5025, info: 'Stația 12/12 · Runda 99/99 · Setul 20/20 · Exercițiul 20/20 foarte lung' }];
      openRun('x', seq, 'x'); begin(); tick();
      const rt = document.getElementById('rTime'), rp = document.getElementById('rPhase'), ri = document.getElementById('rInfo');
      if (rt.scrollWidth > rt.clientWidth + 1 || rt.getBoundingClientRect().right > innerWidth + 1) bad.push('rTime depășește: ' + rt.textContent + ' w=' + rt.scrollWidth + '/' + innerWidth);
      if (rp.getBoundingClientRect().right > innerWidth + 1 || rp.scrollWidth > rp.clientWidth + 1) bad.push('rPhase depășește');
      if (ri.scrollWidth > ri.clientWidth + 1) bad.push('rInfo depășește');
      const bt = document.querySelector('#run .rbot').getBoundingClientRect(); if (bt.bottom > innerHeight + 1) bad.push('controale sub ecran ' + Math.round(bt.bottom) + '>' + innerHeight);
      const rm = document.querySelector('#run .rmain').getBoundingClientRect(); if (rm.height < 80) bad.push('rmain prea mic ' + Math.round(rm.height));
      return bad;
    });
    rec(`T8 layout ${vp.width}×${vp.height}`, r.length === 0, r.slice(0, 5).join('; '));
    await page.close();
  }

  // ---------- T10: audio/metronom/cronometru ----------
  {
    const { page, errs } = await fresh();
    const r = await page.evaluate(async () => {
      const out = {};
      audio(); out.ac = !!AC && AC.state;
      try { Object.values(SND).forEach(f => f()); out.snd = 'ok'; } catch (e) { out.snd = e.message; }
      go('metro'); document.getElementById('mGo').click();
      await new Promise(r => setTimeout(r, 1200));
      out.beats = M.beat; document.getElementById('mGo').click(); out.stopped = !M.run;
      go('stopwatch'); document.getElementById('swGo').click(); await new Promise(r => setTimeout(r, 200));
      document.getElementById('swLap').click(); document.getElementById('swLap').click(); document.getElementById('swGo').click();
      out.laps = SW.laps.length; document.getElementById('swReset').click(); out.reset = SW.laps.length === 0 && SW.acc === 0;
      return out;
    });
    rec('T10 audio + metronom + cronometru', r.snd === 'ok' && r.beats >= 2 && r.stopped && r.laps === 2 && r.reset && errs.length === 0, JSON.stringify(r) + ' ' + errs.join('|'));
    await page.close();
  }

  // ---------- T12: catalog ----------
  {
    const { page, errs } = await fresh();
    const r = await page.evaluate(async () => {
      const out = {};
      go('catalog'); out.rows = document.querySelectorAll('#cList .crow').length; out.expect = CAT.length + CARDIO.length;
      const q = (s) => { cQ = s; renderCat(); return document.querySelectorAll('#cList .crow').length; };
      out.fandari = q('fandari'); out.brate = q('brate'); out.ramat = q('ramat'); out.ramatD = q('Ramat'); cQ = ''; renderCat();
      // adăugare
      localStorage.removeItem('cronosala.cfg.sets'); document.querySelector('#cList [data-add=sets]').click();
      out.added = JSON.parse(localStorage.getItem('cronosala.cfg.sets')).list.length;
      // plan peste listă personalizată
      LS.set('cfg.sets', { prep: 5, list: [{ n: 'Personalizat 1', sets: 3, r: '10', rest: 60 }, { n: 'Personalizat 2', sets: 3, r: '10', rest: 60 }] });
      document.querySelector('#plans [data-pl="0"]').click();
      await new Promise(r => setTimeout(r, 200));
      const dlg = document.getElementById('dlg'); out.dlgShown = !!(dlg && !dlg.hidden);
      out.afterPlan = JSON.parse(localStorage.getItem('cronosala.cfg.sets')).list.map(x => x.n)[0];
      return out;
    });
    rec('T12 catalog: rânduri', r.rows === r.expect, `rows=${r.rows}/${r.expect}`);
    rec('T12 căutare fără diacritice', r.fandari > 0 && r.brate > 0 && r.ramat === r.ramatD, `fandari=${r.fandari} brate=${r.brate} ramat=${r.ramat}/${r.ramatD}`);
    rec('T12 „＋ Serii” înlocuiește lista implicită', r.added === 1, 'list=' + r.added);
    rec('T12 plan peste listă personalizată cere confirmare / nu pierde datele', r.dlgShown || r.afterPlan === 'Personalizat 1', `dlg=${r.dlgShown} primul=${r.afterPlan}`);
    rec('T12 fără erori', errs.length === 0, errs.slice(0, 3).join('|'));
    await page.close();
  }

  // ---------- T13: accesibilitate statică ----------
  {
    const { page } = await fresh();
    const r = await page.evaluate(() => {
      const bad = [];
      const name = el => (el.getAttribute('aria-label') || el.textContent || el.title || '').trim();
      const scan = (n) => {
        document.querySelectorAll('button').forEach(b => { if (!name(b)) bad.push(n + ' buton fără nume: ' + b.outerHTML.slice(0, 60)); });
        document.querySelectorAll('input,select').forEach(i => { if (i.type === 'hidden') return; const lab = i.getAttribute('aria-label') || (i.labels && i.labels.length) || i.closest('label') || (i.parentElement && i.parentElement.parentElement && i.parentElement.parentElement.querySelector(':scope > label')); if (!lab) bad.push(n + ' input fără etichetă: ' + i.outerHTML.slice(0, 70)); });
      };
      scan('home'); openType('circuit'); scan('circuit'); openType('rest'); scan('rest'); go('settings'); scan('settings'); go('metro'); scan('metro'); go('catalog'); scan('catalog'); go('stopwatch'); scan('stopwatch');
      const run = document.getElementById('run'); if (run.getAttribute('role') !== 'dialog') bad.push('overlay fără role=dialog');
      if (!document.querySelector('[aria-live]')) bad.push('nicio regiune aria-live pentru faze');
      return bad;
    });
    rec('T13 accesibilitate (nume, etichete, dialog, aria-live)', r.length === 0, r.slice(0, 5).join('; '));
    await page.close();
  }

  // ---------- T14: performanță ----------
  {
    const { page } = await fresh();
    const r = await page.evaluate(() => {
      const T = TYPES.find(t => t.id === 'tempo'); const c = defOf(T); c.reps = 50; c.sets = 20; c.down = 3; c.bot = 1; c.up = 1; c.top = 1;
      let t0 = performance.now(); const seq = T.build(c); const build = performance.now() - t0;
      openRun('p', seq, 'p'); begin(); t0 = performance.now(); for (let i = 0; i < 200; i++) { window.__T += 100; tick(); } const tickAvg = (performance.now() - t0) / 200;
      t0 = performance.now(); openType('tempo'); const render = performance.now() - t0;
      return { phases: seq.length, build: Math.round(build), tickAvg: +tickAvg.toFixed(2), render: Math.round(render) };
    });
    rec('T14 performanță (4000+ faze)', r.build < 200 && r.tickAvg < 6 && r.render < 300, JSON.stringify(r));
    await page.close();
  }

  // ---------- T15: persistență + v2 ----------
  {
    const { page } = await fresh();
    await page.evaluate(() => { openType('hiit'); document.getElementById('goBtn').click(); });
    await page.evaluate(() => { window.__T += 12000; tick(); });
    await new Promise(r => setTimeout(r, 2300));
    await page.evaluate(() => { window.__T += 100; tick(); });
    await page.reload(); await new Promise(r => setTimeout(r, 200));
    const r = await page.evaluate(() => ({ banner: !!document.getElementById('resume') && !document.getElementById('resume').hidden, ls: !!localStorage.getItem('cronosala.run') }));
    rec('T15 antrenamentul întrerupt poate fi reluat după reload', r.banner && r.ls, JSON.stringify(r));
    await page.close();
  }

  // ---------- T16: CSP / rețea ----------
  {
    const { page } = await fresh();
    const csp = await page.evaluate(() => { const m = document.querySelector('meta[http-equiv="Content-Security-Policy"]'); return m ? m.content : null; });
    rec('T16 CSP care interzice rețeaua', !!csp && /connect-src 'none'/.test(csp), csp ? csp.slice(0, 80) : 'lipsă');
    await page.close();
  }

  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} trecute ===`);
  process.exit(0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });

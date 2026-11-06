// Audit adversarial v3: node test3.js <fisier.html>
const puppeteer = require('puppeteer-core');
const fs = require('fs'), path = require('path'), cp = require('child_process');
const FILE = process.argv[2];
const OUT = path.join(__dirname, 'qr_out'); fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const rec = (n, ok, d = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  — ' + d : '')); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const race = (p, ms, label) => Promise.race([p, new Promise((_, rj) => setTimeout(() => rj(new Error('TIMEOUT ' + label)), ms))]);

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 40000, args: ['--no-sandbox', '--disable-gpu'] });
  async function fresh(opts = {}) {
    const page = await browser.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('dialog', d => { errs.push('DIALOG NATIV: ' + d.message()); d.dismiss(); });
    await page.setViewport(opts.vp || { width: 412, height: 800, isMobile: true, hasTouch: true });
    await page.evaluateOnNewDocument(() => { window.__T = new Date().getTime(); Date.now = () => window.__T; });
    if (opts.pre) await page.evaluateOnNewDocument(opts.pre);
    await page.goto('file://' + FILE + (opts.hash || ''));
    if (opts.clear !== false) { await page.evaluate(() => localStorage.clear()); if (opts.seed) await page.evaluate(opts.seed); await page.reload(); }
    await wait(200);
    return { page, errs };
  }

  // ===== A. XSS =====
  {
    const { page, errs } = await fresh();
    const X = '<img src=x onerror="window.__xss=1">"><svg onload="window.__xss=2">';
    await page.evaluate(X => {
      // nume ostile în toate locurile unde ajung în DOM
      const T = TYPES.find(t => t.id === 'sets');
      localStorage.setItem('cronosala.cfg.sets', JSON.stringify({ list: [{ n: X, sets: 2, r: X, rest: 30 }] }));
      localStorage.setItem('cronosala.cfg.duo', JSON.stringify({ A: X, B: X, list: [{ n: X, sets: 1, r: X }] }));
      localStorage.setItem('cronosala.presets.sets', JSON.stringify([{ name: X, cfg: {} }]));
      localStorage.setItem('cronosala.hist', JSON.stringify([{ t: Date.now(), type: X, sec: 5, done: true, cnt: X, plan: X }]));
      localStorage.setItem('cronosala.wlog', JSON.stringify([{ t: Date.now(), ex: X, kg: 5, reps: 5 }]));
      localStorage.setItem('cronosala.inv.off', JSON.stringify([X]));
      localStorage.setItem('cronosala.prog', JSON.stringify({ start: Date.now(), days: [X, X, X, X, X, X, X] }));
    }, X);
    await page.reload(); await wait(200);
    await page.evaluate(async X => {
      for (const id of ['sets', 'duo']) { openType(id); await new Promise(r => setTimeout(r, 30)); }
      openType('sets'); startRun(); await new Promise(r => setTimeout(r, 100)); shutRun();
      go('history'); go('catalog'); go('program'); go('labels'); go('settings');
      document.getElementById('cSearch').value = '<img src=x onerror="window.__xss=3">'; document.getElementById('cSearch').dispatchEvent(new Event('input'));
      renderStats(); renderTodayPlan();
      // dialoguri cu text ostil
      ask({ title: '<img src=x onerror="window.__xss=4">', text: X, choices: [X, X] });
      await new Promise(r => setTimeout(r, 50)); dlgClose(false);
      // cod partajat cu text ostil
      const code = b64e(JSON.stringify({ y: 'sets', c: { list: [{ n: X, sets: 1, r: X, rest: 5 }] } }));
      importShared(code); await new Promise(r => setTimeout(r, 50)); dlgClose(true);
      await new Promise(r => setTimeout(r, 100));
    }, X);
    const x = await page.evaluate(() => ({ xss: window.__xss, imgs: document.querySelectorAll('img').length, svgOnload: [...document.querySelectorAll('svg')].some(s => s.hasAttribute('onload')) }));
    rec('XSS: niciun script/handler din nume ostile', x.xss === undefined && x.imgs === 0 && !x.svgOnload, JSON.stringify(x));
    rec('XSS: fără excepții', errs.length === 0, errs.slice(0, 3).join('|'));
    await page.close();
  }

  // ===== B. stocare ostilă =====
  {
    const junk = () => {
      const big = 'A'.repeat(3000), deep = JSON.parse('['.repeat(200) + ']'.repeat(200));
      const set = (k, v) => { try { localStorage.setItem('cronosala.' + k, typeof v === 'string' ? v : JSON.stringify(v)) } catch (e) { } };
      set('settings', { vol: 'x', theme: 5, snd: {}, out: [], count: 'yes', notif: 1, sound: 'no' });
      set('wlog', [null, 1, 'a', { ex: 5, kg: 'x', reps: null }, { ex: 'Leg Press', kg: Infinity, reps: 1e999, t: NaN }, ...Array.from({ length: 4000 }, (_, i) => ({ t: Date.now() - i * 3600e3, ex: 'Leg Press (Leg Press)', kg: i % 100, reps: i % 15, set: 1 }))]);
      set('hist', [null, 5, 'x', { t: 'a' }, { t: Date.now(), type: big, sec: 'q', done: 1, cnt: -5 }, ...Array.from({ length: 500 }, (_, i) => ({ t: Date.now() - i * 1e6, type: 'Tabata', sec: i, done: i % 2 === 0, cnt: i, plan: 'p1' }))]);
      set('prog', { start: 'x', days: ['__proto__', 'p999', 'c999', null, 1, {}, []] });
      set('radj', [1, 2, 3]); set('inv.off', [1, null, { a: 1 }, 'Presă picioare (Leg Press)']);
      set('metro', { bpm: 'x', beats: 1e9 });
      set('run', { v: 3, title: big, i: 'x', carry: -1, tot: 'y', seq: 5, ts: Date.now() }); set('run.seq', deep);
      for (const id of ['rest', 'cd', 'hiit', 'tabata', 'box', 'emom', 'amrap', 'circuit', 'sets', 'duo', 'tempo', 'iso', 'pyr']) set('cfg.' + id, [big, deep, { list: 'no', sets: 1e9, work: -1e9, A: {}, B: deep, prep: NaN, rounds: '1e999' }][id.length % 3]);
      set('cfg.sets', { list: Array.from({ length: 300 }, (_, i) => ({ n: big, sets: 1e9, r: 'x', rest: 'x' })) });
      set('presets.hiit', [null, 1, { name: 5, cfg: 'x' }, { name: big, cfg: deep }]);
      localStorage.setItem('cronosala.zzz', big);
    };
    const { page, errs } = await fresh({ seed: junk });
    const r = await race(page.evaluate(async () => {
      const o = { errs: [] }; const t0 = performance.now();
      for (const id of SCREENS) { try { if (id === 'config') continue; go(id); await new Promise(r => setTimeout(r, 20)); } catch (e) { o.errs.push(id + ':' + e.message) } }
      for (const T of TYPES) { if (T.fields) { try { openType(T.id); const s = CUR.build(CFG); o[T.id] = s.length } catch (e) { o.errs.push(T.id + ':' + e.message) } } }
      try { renderStats(); renderProg(); renderTodayPlan(); renderResume(); renderLabels(); } catch (e) { o.errs.push('render:' + e.message) }
      try { o.resume = !document.getElementById('resume').hidden } catch (e) { }
      o.ms = Math.round(performance.now() - t0);
      return o;
    }), 30000, 'storage-hostil').catch(e => ({ errs: [String(e)] }));
    rec('stocare ostilă: toate ecranele și tipurile se deschid', r.errs.length === 0, JSON.stringify(r).slice(0, 300));
    rec('stocare ostilă: timp rezonabil', r.ms < 8000, 'ms=' + r.ms);
    rec('stocare ostilă: fără excepții de pagină', errs.length === 0, errs.slice(0, 3).join('|'));
    // porneste din fiecare tip cu config corupt
    const started = await race(page.evaluate(async () => {
      const bad = []; for (const T of TYPES) { if (!T.build) continue; try { openType(T.id); startRun(); await new Promise(r => setTimeout(r, 20)); if (!document.getElementById('run').hidden) { for (let i = 0; i < 30; i++) { window.__T += 1000; tick() } shutRun() } } catch (e) { bad.push(T.id + ':' + e.message) } }
      return bad;
    }), 30000, 'start').catch(e => [String(e)]);
    rec('stocare ostilă: pornirea fiecărui tip nu aruncă', started.length === 0, started.join(';'));
    await page.close();
  }

  // ===== C. hash / cod malițios =====
  {
    const cases = { 'invalid': '#t=!!!', 'gol': '#t=', 'uriaș': '#t=' + 'A'.repeat(900000), 'proto': '#t=' + Buffer.from('{"y":"hiit","c":{"__proto__":{"polluted":1},"constructor":{"x":1}}}').toString('base64url'), 'tip-gresit': '#t=' + Buffer.from('{"y":"stopwatch"}').toString('base64url'), 'adânc': '#t=' + Buffer.from('['.repeat(5000) + ']'.repeat(5000)).toString('base64url'), '#run': '#run', 'diverse': '#%00%ff<script>' };
    for (const [n, h] of Object.entries(cases)) {
      const { page, errs } = await fresh({ hash: h, clear: false });
      await wait(250);
      const r = await page.evaluate(() => ({ polluted: ({}).polluted, ok: !!document.getElementById('grid').children.length, run: document.getElementById('run').hidden }));
      if (!(r.polluted === undefined && r.ok && r.run) || errs.length) rec('hash malițios: ' + n, false, JSON.stringify(r) + errs.join('|'));
      else rec('hash malițios: ' + n, true);
      await page.close();
    }
  }

  // ===== D. API-uri lipsă =====
  {
    const pre = () => {
      delete window.speechSynthesis; delete window.SpeechSynthesisUtterance; delete window.Notification; delete window.BarcodeDetector; delete window.AudioContext; delete window.webkitAudioContext;
      Object.defineProperty(navigator, 'wakeLock', { value: undefined }); window.Worker = function () { throw new Error('no worker') };
      Object.defineProperty(navigator, 'mediaSession', { value: undefined }); navigator.vibrate = undefined;
      Storage.prototype.setItem = function () { throw new DOMException('quota', 'QuotaExceededError') };
    };
    const { page, errs } = await fresh({ pre, clear: false });
    const r = await race(page.evaluate(async () => {
      const o = {}; openType('hiit'); startRun(); o.kind = E.stop && E.stop.kind && E.stop.kind();
      for (let i = 0; i < 40; i++) { window.__T += 1000; tick() }
      next(); prev(); pause(); begin(); o.running = E.running; shutRun();
      go('settings'); document.querySelector('[data-s=notif]').click(); document.querySelector('[data-s=voice]').click();
      startScan(); await new Promise(r => setTimeout(r, 50)); o.scanMsg = document.getElementById('scMsg').textContent.length > 0; stopScan();
      mStart(); mStop(); o.metro = true; go('stopwatch'); document.getElementById('swGo').click(); document.getElementById('swGo').click();
      return o;
    }), 20000, 'api-lipsa').catch(e => ({ err: String(e) }));
    rec('API-uri lipsă (voce, audio, worker, stocare plină): funcționează degradat', !r.err && r.kind === 'interval', JSON.stringify(r));
    rec('API-uri lipsă: fără excepții necontrolate', errs.length === 0, errs.slice(0, 4).join('|'));
    await page.close();
  }

  // ===== E. fuzz de operații pe un antrenament în desfășurare =====
  {
    const { page, errs } = await fresh();
    const r = await race(page.evaluate(async () => {
      let seed = 12345; const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n };
      const T = TYPES.find(t => t.id === 'sets'); CUR = T;
      CFG = sanitize(T, { prep: 3, warm: true, cool: true, deload: false, auto: true, list: [{ n: 'Leg Press', sets: 3, r: '8-10', rest: 20 }, { n: 'Chest Press', sets: 3, r: '10', rest: 20 }, { n: 'Plank', sets: 2, r: '45 s', rest: 10 }, { n: 'Hip Thrust', sets: 2, r: '10', rest: 15 }] });
      openRun('fz', T.build(CFG), 'Serii'); begin();
      const ops = ['tick', 'tick', 'tick', 'next', 'prev', 'plus', 'minus', 'log', 'done', 'swap', 'move', 'pause', 'begin', 'jump', 'back', 'resetState', 'count'];
      const bad = []; let steps = 0;
      const inv = () => {
        if (!E.seq.length) return 'seq vid'; if (E.i < 0 || E.i >= E.seq.length) return 'i în afara intervalului ' + E.i;
        for (const [j, p] of E.seq.entries()) { if (!(p.dur === null || (Number.isFinite(p.dur) && p.dur > 0))) return 'dur invalid ' + j; if (!['work', 'rest', 'prep'].includes(p.t)) return 'tip invalid' }
        if (!Number.isFinite(E.carry) || E.carry < 0) return 'carry ' + E.carry; if (!Number.isFinite(E.tot)) return 'tot'; return null;
      };
      for (let k = 0; k < 4000; k++) {
        const op = ops[rnd(ops.length)]; steps++;
        try {
          if (op === 'tick') { window.__T += rnd(1500); tick() }
          else if (op === 'jump') { window.__T += rnd(3) === 0 ? 3600e3 * 5 : rnd(60000); tick() }
          else if (op === 'back') { window.__T -= rnd(5000); tick() }
          else if (op === 'next') next(); else if (op === 'prev') prev();
          else if (op === 'plus') adjust(15); else if (op === 'minus') adjust(-15);
          else if (op === 'log') { document.getElementById('lgKg').value = String(rnd(200)); document.getElementById('lgRp').value = String(rnd(20)); logSet() }
          else if (op === 'done') { if (!document.getElementById('rDone').hidden) document.getElementById('rDone').click() }
          else if (op === 'swap') { const p = cur(); if (p && p.log) { const a = alts(p.ex); if (a.length) swapEx(p.blk, a[rnd(a.length)]) } }
          else if (op === 'move') { const p = cur(); if (p && p.log && E.seq.some((q, j) => j > E.i && q.blk != null && q.blk !== p.blk)) moveEnd(p.blk) }
          else if (op === 'pause') pause(); else if (op === 'begin') begin();
          else if (op === 'resetState') { if (rnd(40) === 0) { pause(); resetState(); calc(); render() } }
          else if (op === 'count') { E.cnt = Math.max(0, E.cnt + rnd(3) - 1) }
          render();
        } catch (e) { bad.push(op + ': ' + e.message); break }
        const v = inv(); if (v) { bad.push(op + ' → ' + v); break }
        if (E.fin) { pause(); resetState(); calc(); begin() }
      }
      shutRun(); return { bad, steps };
    }), 60000, 'fuzz').catch(e => ({ bad: [String(e)] }));
    rec('fuzz 4000 operații pe antrenament: invarianți păstrați', r.bad.length === 0, JSON.stringify(r).slice(0, 300));
    rec('fuzz: fără excepții de pagină', errs.length === 0, errs.slice(0, 3).join('|'));
    await page.close();
  }

  // ===== F. dialoguri concurente =====
  {
    const { page, errs } = await fresh();
    const r = await page.evaluate(async () => {
      const o = {};
      const a = ask({ title: 'A', choices: ['1', '2'] }), b = ask({ title: 'B' });
      o.firstResolved = await Promise.race([a, new Promise(r => setTimeout(() => r('PENDING'), 200))]);
      dlgClose(true); o.second = await b;
      // Escape
      const c = ask({ title: 'C', input: 'x' }); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      o.esc = await Promise.race([c, new Promise(r => setTimeout(() => r('PENDING'), 200))]);
      // închiderea antrenamentului cu dialog deschis
      openType('rest'); startRun(); begin(); window.__T += 30000; tick();
      const cl = closeRun(); await new Promise(r => setTimeout(r, 50));
      o.dlgOpen = !document.getElementById('dlg').hidden; const cl2 = closeRun(); dlgClose(false);
      o.closed = await Promise.all([cl, cl2]); o.runHidden = document.getElementById('run').hidden;
      shutRun(); o.inertClean = !document.querySelector('main').inert && !document.querySelector('#run').inert;
      return o;
    });
    rec('dialoguri: al doilea înlocuiește primul, fără blocaje', r.firstResolved === false && r.second === true, JSON.stringify(r));
    rec('dialoguri: Escape rezolvă', r.esc === null || r.esc === false, JSON.stringify(r.esc));
    rec('closeRun dublu cu dialog deschis: stare consecventă', r.dlgOpen && r.inertClean, JSON.stringify(r));
    rec('dialoguri: fără erori', errs.length === 0, errs.slice(0, 3).join('|'));
    await page.close();
  }

  // ===== G. QR aleator (decodare independentă) =====
  {
    const { page } = await fresh();
    let seed = 99; const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n };
    const alpha = 'abcXYZ019_-:#/ ăâîșțĂ€😀'; const samples = [];
    for (let i = 0; i < 120; i++) { const len = 1 + rnd(i < 20 ? 40 : 260); let s = ''; for (let k = 0; k < len; k++) s += [...alpha][rnd([...alpha].length)]; if (new TextEncoder().encode(s).length <= 271) samples.push(s) }
    const mats = await page.evaluate(s => s.map(x => { const m = QR.matrix(x); return m ? m.map(r => Array.from(r).join('')) : null }), samples);
    fs.writeFileSync(path.join(OUT, 'mats.json'), JSON.stringify({ samples, mats }));
    const py = `import json,cv2,numpy as np,sys,zxingcpp\nd=json.load(open(sys.argv[1]))\nz=0;c=0;n=0;bad=[]\nfor s,m in zip(d['samples'],d['mats']):\n    n+=1\n    if m is None: bad.append(('null',len(s)));continue\n    a=np.pad(np.array([[int(ch) for ch in r] for r in m],dtype=np.uint8),4)\n    img=((1-np.kron(a,np.ones((8,8),dtype=np.uint8)))*255).astype(np.uint8)\n    r=zxingcpp.read_barcodes(img)\n    if r and r[0].text==s: z+=1\n    else: bad.append(len(s.encode()))\n    v,_,_=cv2.QRCodeDetector().detectAndDecode(img)\n    if v==s: c+=1\nprint(z,n,'cv2:',c,bad[:6])`;
    const res = cp.spawnSync('python3', ['-c', py, path.join(OUT, 'mats.json')], { encoding: 'utf8' });
    const m = /^(\d+) (\d+)/.exec(res.stdout || '');
    rec('QR aleatoriu (UTF-8, emoji, 1–271 B): zxing decodează tot, OpenCV ≥98%', m && m[1] === m[2] && +/cv2: (\d+)/.exec(res.stdout)[1] >= 0.98 * +m[2], (res.stdout || res.stderr).trim().slice(0, 200));
    await page.close();
  }

  // ===== H. timp: salturi de ceas =====
  {
    const { page, errs } = await fresh();
    const r = await page.evaluate(() => {
      const o = {}; openType('hiit'); startRun();
      window.__T += 7 * 864e5; tick(); o.afterWeek = E.fin;           // săritură de 7 zile înainte
      resetState(); calc(); begin(); window.__T -= 864e5; tick(); o.backOk = Number.isFinite(E.carry) && E.carry >= 0 && !E.fin;
      shutRun(); return o;
    });
    rec('ceas: salt de 7 zile înainte termină fără buclă; salt înapoi nu strică', r.afterWeek === true && r.backOk, JSON.stringify(r));
    rec('ceas: fără erori', errs.length === 0, errs.join('|'));
    await page.close();
  }

  console.log(`\n=== test3: ${pass}/${pass + fail} trecute ===`);
  await browser.close(); process.exit(fail ? 1 : 0);
})();

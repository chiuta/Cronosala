// Teste v3: node test2.js <fisier.html>
const puppeteer = require('puppeteer-core');
const fs = require('fs'), path = require('path'), cp = require('child_process');
const FILE = process.argv[2];
const OUT = path.join(__dirname, 'qr_out'); fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const rec = (n, ok, d = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  — ' + d : '')); };
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 60000, args: ['--no-sandbox', '--disable-gpu'] });
  async function fresh(vp = { width: 412, height: 800, isMobile: true, hasTouch: true }, pre) {
    const page = await browser.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.setViewport(vp);
    await page.evaluateOnNewDocument(() => { window.__T = new Date().getTime(); Date.now = () => window.__T; });
    if (pre) await page.evaluateOnNewDocument(pre);
    await page.goto('file://' + FILE); await page.evaluate(() => localStorage.clear()); await page.reload(); await wait(150);
    return { page, errs };
  }

  // ---- QR: generare + decodare cu OpenCV ----
  {
    const { page, errs } = await fresh();
    const samples = ['CS:E0', 'CS:E77', 'CS:T' + 'a'.repeat(60), 'Hello, Școala ăâîșț!', 'x'.repeat(100), 'y'.repeat(150), 'z'.repeat(220), 'w'.repeat(268), 'CS:T' + Buffer.from(JSON.stringify({ y: 'hiit', c: { work: 40, rest: 20 } })).toString('base64url')];
    const svgs = await page.evaluate(s => s.map(x => QR.svg(x)), samples);
    const html = svgs.map((v, i) => `<div style="padding:10px;background:#fff;width:600px">${v}</div>`).join('');
    // fiecare SVG într-un fișier PNG separat
    let okAll = 0; const bad = [];
    for (let i = 0; i < samples.length; i++) {
      if (!svgs[i]) { bad.push(i + ':null'); continue; }
      const p2 = await browser.newPage(); await p2.setViewport({ width: 700, height: 700 });
      await p2.setContent(`<body style="margin:0;background:#fff"><div style="width:600px;height:600px;margin:20px">${svgs[i].replace('<svg ', '<svg width="600" height="600" ')}</div></body>`);
      const f = path.join(OUT, `q${i}.png`); await p2.screenshot({ path: f }); await p2.close();
      const py = cp.spawnSync('python3', ['-c', `import cv2,sys\nim=cv2.imread(sys.argv[1])\nd=cv2.QRCodeDetector()\nv,_,_=d.detectAndDecode(im)\nprint(v)`, f], { encoding: 'utf8' });
      const got = (py.stdout || '').replace(/\n$/, '');
      if (got === samples[i]) okAll++; else bad.push(i + ':' + JSON.stringify(got.slice(0, 30)));
    }
    rec('QR decodabil cu OpenCV (v1..v10, UTF-8)', okAll === samples.length, `${okAll}/${samples.length} ${bad.join(' ')}`);
    const big = await page.evaluate(() => QR.svg('q'.repeat(300)));
    rec('QR prea mare returnează null', big === null);
    rec('QR fără erori de pagină', errs.length === 0, errs.join('|'));
    await page.close();
  }

  // ---- jurnal kg×rep + pauză adaptivă + progresie ----
  {
    const { page, errs } = await fresh();
    const r = await page.evaluate(async () => {
      const T = TYPES.find(t => t.id === 'sets');
      CUR = T; CFG = sanitize(T, { prep: 0, list: [{ n: 'Leg Press', sets: 2, r: '8-10', rest: 60 }, { n: 'Chest Press', sets: 2, r: '10', rest: 60 }] });
      const seq = T.build(CFG);
      openRun('t', seq, 'Serii'); begin();
      const o = {};
      o.logFlag = !!cur().log; o.logVisible = !document.getElementById('rLog').hidden; o.busyVisible = !document.getElementById('bBusy').hidden;
      document.getElementById('lgKg').value = '80'; document.getElementById('lgRp').value = '6';
      document.getElementById('rDone').click();
      const w = JSON.parse(localStorage.getItem('cronosala.wlog') || '[]');
      o.logged = w.length === 1 && w[0].kg === 80 && w[0].reps === 6;
      o.nextRest = cur().t === 'rest' ? cur().dur : -1;     // 60 + 30 (reps < 8)
      // +15 pe pauză => memorează pe exercițiu
      document.getElementById('bPlus').click();
      o.radj = JSON.parse(localStorage.getItem('cronosala.radj') || '{}');
      // build nou folosește radj + ultima serie sub limită
      const seq2 = T.build(CFG); const r1 = seq2.find(p => p.t === 'rest' && p.ex === 'Leg Press');
      o.restRebuilt = r1 && r1.dur;
      // prefill următoarea serie
      next(); render();
      o.hint = document.getElementById('rHint').textContent;
      shutRun();
      return o;
    });
    rec('serie: panou kg/rep + buton ocupat vizibile', r.logFlag && r.logVisible && r.busyVisible, JSON.stringify(r));
    rec('serie: intrarea e salvată în jurnal', r.logged);
    rec('pauză adaptivă: +30 s după serie sub limită', r.nextRest === 90, 'rest=' + r.nextRest);
    rec('pauză adaptivă: +15 s învățat pe exercițiu', r.radj && r.radj['Leg Press'] === 15, JSON.stringify(r.radj));
    rec('pauză adaptivă: build ulterior folosește ajustările', r.restRebuilt === 60 + 15 + 30, 'rest=' + r.restRebuilt);
    rec('indiciu „ultima dată” afișat', /80 kg × 6/.test(r.hint || ''), r.hint);

    // progresie: 3 sesiuni la limita de repetări
    const sg = await page.evaluate(() => {
      const base = Date.now();
      const e = [0, 1, 2].map(k => ({ t: base - (k + 1) * 864e5, ex: 'Chest Press', kg: 50, reps: 10, set: 1 }));
      localStorage.setItem('cronosala.wlog', JSON.stringify(e));
      return { s: suggest('Chest Press', '8-10'), none: suggest('Chest Press', '12-15'), noRange: suggest('Chest Press', '45 s') };
    });
    rec('progresie dublă: sugerează +2,5 kg', /52\.5 kg/.test(sg.s), sg.s);
    rec('progresie: nu sugerează sub limită / pe durate', sg.none === '' && sg.noRange === '', JSON.stringify(sg));
    rec('jurnal: fără erori', errs.length === 0, errs.join('|'));
    await page.close();
  }

  // ---- aparat ocupat ----
  {
    const { page, errs } = await fresh();
    const r = await page.evaluate(async () => {
      const T = TYPES.find(t => t.id === 'sets');
      CUR = T; CFG = sanitize(T, { prep: 0, list: [{ n: 'Leg Press', sets: 2, r: '10', rest: 30 }, { n: 'Chest Press', sets: 2, r: '10', rest: 30 }, { n: 'Plank', sets: 1, r: '45 s', rest: 0 }] });
      const o = {}; o.alts = alts('Leg Press');
      openRun('t', T.build(CFG), 'Serii'); begin();
      const before = E.seq.length, nameBefore = cur().name;
      swapEx(cur().blk, o.alts[0]);
      o.swapped = cur().name === o.alts[0] && E.seq.filter(p => p.ex === o.alts[0]).length >= 3;
      moveEnd(cur().blk);
      o.moved = cur().ex === 'Chest Press' && E.seq.length >= before - 1;
      const exOrder = []; E.seq.forEach(p => { if (p.t === 'work' && exOrder[exOrder.length - 1] !== p.ex) exOrder.push(p.ex) });
      o.order = exOrder;
      // secvența rămâne validă: nicio pauză dublă consecutivă, fără durate invalide
      o.valid = E.seq.every((p, i) => (p.dur === null || p.dur > 0) && !(p.t === 'rest' && E.seq[i + 1] && E.seq[i + 1].t === 'rest'));
      o.lastIsRest = E.seq[E.seq.length - 1].t === 'rest';
      shutRun(); return o;
    });
    rec('aparat ocupat: alternative din catalog', r.alts.length > 0 && r.alts.length <= 3, JSON.stringify(r.alts));
    rec('aparat ocupat: înlocuire pe toate seriile rămase', r.swapped);
    rec('aparat ocupat: mutare la sfârșit păstrează secvența validă', r.moved && r.valid && !r.lastIsRest, JSON.stringify(r.order));
    rec('aparat ocupat: fără erori', errs.length === 0, errs.join('|'));
    await page.close();
  }

  // ---- program lunar + descărcare ----
  {
    const { page, errs } = await fresh();
    const r = await page.evaluate(async () => {
      const o = {};
      const monday = dayStart(new Date()); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      // luni 1700000000000 = Wed Nov 15 2023 UTC; start = luni acelei săptămâni
      const dd = PROG_DEF.slice(); dd[new Date().getDay()] = 'p5'; progSave({ start: monday.getTime(), days: dd });
      const w0 = weekOf(progGet(), new Date());
      o.w0 = w0;
      const d22 = new Date(Date.now() + 22 * 864e5);
      o.w3 = weekOf(progGet(), d22);
      o.w4 = weekOf(progGet(), new Date(Date.now() + 29 * 864e5));
      renderProg(); o.progHtml = document.getElementById('progBody').innerText.length;
      o.rows = document.querySelectorAll('#progBody .crow').length;
      // pornire automată dintr-o zi de forță, cu deload
      await startItem('p5', true);
      o.running = !document.getElementById('run').hidden;
      const sets = E.seq.filter(p => p.log);
      o.deloadSets = Math.max(...sets.map(p => +/\/(\d+)/.exec(p.info)[1]));
      o.warm = E.seq[0].t === 'prep' && E.seq[0].name === 'Încălzire cardio';
      o.cool = E.seq[E.seq.length - 1].t === 'rest' && !!E.seq[E.seq.length - 1].tip;
      o.plan = E.plan;
      // terminăm rapid: ultima fază
      E.i = E.seq.length - 1; E.started = true; begin(); finish();
      const h = JSON.parse(localStorage.getItem('cronosala.hist') || '[]');
      o.histPlan = h[0] && h[0].plan; o.done = h[0] && h[0].done;
      shutRun();
      renderProg(); o.doneMark = /✓ făcut/.test(document.getElementById('progBody').innerText);
      renderTodayPlan(); o.todayVisible = true;
      return o;
    });
    rec('program: ciclu 4 săptămâni cu descărcare în a 4-a', r.w3 && r.w3.cy === 3 && r.w3.deload && r.w4.cy === 0 && !r.w4.deload, JSON.stringify([r.w0, r.w3, r.w4]));
    rec('program: 28 de zile afișate', r.rows === 28, 'rânduri=' + r.rows);
    rec('program: startul pornește antrenamentul cu încălzire/răcire', r.running && r.warm && r.cool, JSON.stringify(r));
    rec('program: descărcare = max 2 serii', r.deloadSets <= 2, 'max serii=' + r.deloadSets);
    rec('program: sesiunea terminată e marcată pe zi', r.histPlan === 'p5' && r.done && r.doneMark, JSON.stringify([r.histPlan, r.done, r.doneMark]));
    rec('program: fără erori', errs.length === 0, errs.join('|'));
    await page.close();
  }

  // ---- mod în doi ----
  {
    const { page, errs } = await fresh();
    const r = await page.evaluate(() => {
      const T = TYPES.find(t => t.id === 'duo');
      const c = sanitize(T, { A: 'Ana', B: 'Radu', rest: 60, list: [{ n: 'Presă', sets: 2, r: '10' }] });
      const s = T.build(c);
      return { names: s.map(p => p.name), say: s.filter(p => p.say).map(p => p.say), lastRest: s[s.length - 1].t === 'rest' };
    });
    rec('în doi: alternare Ana/Radu, pauză comună', r.names.join('|') === 'Pregătire|Ana · Presă|Radu · Presă|Pauză comună|Ana · Presă|Radu · Presă' && !r.lastRest, r.names.join('|'));
    rec('în doi: vocea anunță numele', r.say[0] === 'Ana, Presă', JSON.stringify(r.say));
    rec('în doi: fără erori', errs.length === 0, errs.join('|'));
    await page.close();
  }

  // ---- partajare + import cod ----
  {
    const { page, errs } = await fresh();
    const r = await page.evaluate(async () => {
      const o = {};
      const T = TYPES.find(t => t.id === 'hiit');
      CUR = T; CFG = sanitize(T, { work: 41, rest: 19, rounds: 6 });
      const d = defOf(T), diff = {}; for (const k of Object.keys(CFG)) if (JSON.stringify(CFG[k]) !== JSON.stringify(d[k])) diff[k] = CFG[k];
      const code = b64e(JSON.stringify({ y: 'hiit', c: diff }));
      const p = parseShared(code);
      o.parsed = p && p.c.work === 41 && p.c.rest === 19 && p.c.rounds === 6;
      o.qr = !!QR.svg('CS:T' + code);
      o.bad1 = parseShared('!!!') === null;
      o.bad2 = parseShared(b64e('{"y":"nu_exista"}')) === null;
      o.junk = parseShared(b64e(JSON.stringify({ y: 'hiit', c: { work: 1e12, rest: 'abc', __proto__: { x: 1 } } }))).c.work <= 3600;
      o.okE = codeOk('E12') && codeOk('CS:E66') && !codeOk('E999') && !codeOk('xyz') && codeOk('CS:T' + code) && codeOk('https://x/y#t=' + code);
      return o;
    });
    rec('partajare: codare/decodare configurație', r.parsed && r.qr);
    rec('partajare: coduri invalide / maliționse respinse', r.bad1 && r.bad2 && r.junk);
    rec('coduri: recunoaștere aparat/timer/link', r.okE);
    // flux UI: buton Partajează deschide dialog cu QR
    await page.evaluate(() => { openType('hiit') });
    await page.evaluate(() => document.getElementById('shareBtn').click()); await wait(100);
    const ui = await page.evaluate(() => ({ dlg: !document.getElementById('dlg').hidden, qr: !!document.querySelector('#dlgQr svg'), val: document.getElementById('dlgIn').value.slice(0, 4) }));
    rec('partajare: dialog cu QR și cod', ui.dlg && ui.qr && ui.val === 'CS:T', JSON.stringify(ui));
    await page.evaluate(() => document.getElementById('dlgNo').click());
    // import prin hash la pornire
    const code2 = await page.evaluate(() => b64e(JSON.stringify({ y: 'tabata', c: { work: 25 } })));
    const p2 = await browser.newPage(); await p2.setViewport({ width: 412, height: 800 });
    await p2.goto('file://' + FILE + '#t=' + code2); await wait(300);
    const imp = await p2.evaluate(() => ({ dlg: !document.getElementById('dlg').hidden, title: document.getElementById('dlgT').textContent }));
    rec('import din link (#t=) cere confirmare', imp.dlg && /Tabata/.test(imp.title), JSON.stringify(imp));
    await p2.evaluate(() => document.getElementById('dlgOk').click()); await wait(150);
    const after = await p2.evaluate(() => ({ cfg: JSON.parse(localStorage.getItem('cronosala.cfg.tabata')), on: document.getElementById('config').classList.contains('on') }));
    rec('import din link: cfg aplicată și ecran deschis', after.cfg && after.cfg.work === 25 && after.on, JSON.stringify(after.cfg));
    await p2.close();
    rec('partajare: fără erori', errs.length === 0, errs.join('|'));
    await page.close();
  }

  // ---- scanner (manual) + etichete ----
  {
    const { page, errs } = await fresh();
    await page.evaluate(() => document.querySelector('[data-id=scan]').click()); await wait(100);
    const s1 = await page.evaluate(() => ({ open: !document.getElementById('scan').hidden, msg: document.getElementById('scMsg').textContent.length > 0, mainInert: document.querySelector('main').inert }));
    rec('scanner: se deschide, mesaj fallback, restul inert', s1.open && s1.msg && s1.mainInert, JSON.stringify(s1));
    await page.evaluate(() => { document.getElementById('scIn').value = 'E3'; document.getElementById('scGo').click() }); await wait(150);
    const s2 = await page.evaluate(() => ({ scan: document.getElementById('scan').hidden, dlg: !document.getElementById('dlg').hidden, title: document.getElementById('dlgT').textContent, opts: document.querySelectorAll('#dlgOpts button').length }));
    rec('scanner: cod E3 deschide fișa aparatului', s2.scan && s2.dlg && s2.opts === 3, JSON.stringify(s2));
    await page.evaluate(() => document.querySelector('#dlgOpts button').click()); await wait(100);
    const add = await page.evaluate(() => JSON.parse(localStorage.getItem('cronosala.cfg.sets')).list.map(x => x.n));
    rec('scanner: „＋ Serii” adaugă aparatul scanat', add.length === 1, JSON.stringify(add));
    await page.evaluate(() => go('labels')); await wait(200);
    const lb = await page.evaluate(() => ({ n: document.querySelectorAll('#labelsPrint .lab').length, svgs: document.querySelectorAll('#labelsPrint .lab svg').length }));
    rec('etichete QR: una per aparat', lb.n === 67 && lb.svgs === 67, JSON.stringify(lb));
    rec('scanner/etichete: fără erori', errs.length === 0, errs.join('|'));
    await page.close();
  }

  // ---- ghid, voce, teme, notificări ----
  {
    const { page, errs } = await fresh();
    const r = await page.evaluate(async () => {
      const o = {};
      o.guideAll = CAT.every(x => { const g = guideFor(x[1]); return g && g.how && g.err });
      o.guideCardio = CARDIO.every(x => guideFor(x.n));
      // teme de sunet: nu aruncă
      o.themes = ['normal', 'box', 'sport', 'soft', 'voce'].map(t => { S.snd = t; try { soundFor({ t: 'work' })(); soundFor({ t: 'rest' })(); soundFor({ t: 'prep' })(); return true } catch (e) { return false } }).every(Boolean);
      S.snd = 'normal';
      // voce: "încă 10 secunde" + numărătoare
      S.voice = true; S.count = true; window.__said = [];
      const orig = say; // say e declarație de funcție: înlocuim prin speechSynthesis
      const sp = []; const U = window.SpeechSynthesisUtterance;
      speechSynthesis.speak = u => sp.push(u.text); speechSynthesis.cancel = () => { };
      openRun('t', [P('work', 'A', 30, '')], 'x'); begin();
      for (let i = 0; i < 295; i++) { window.__T += 100; tick(); }
      await new Promise(r => setTimeout(r, 1200));
      o.said = sp.slice(); shutRun(); S.voice = false;
      // notificare nu aruncă
      S.notif = true; notify({ name: 'x', info: '' }); S.notif = false;
      // gain căști
      S.out = 'casca'; o.gain = outGain() < S.vol; S.out = 'difuzor';
      return o;
    });
    rec('ghid: există pentru toate cele 78 de aparate + cardio', r.guideAll && r.guideCardio);
    rec('teme de sunet funcționează', r.themes);
    rec('voce: „Încă zece secunde” și numărătoare 3-2-1', r.said.includes('Încă zece secunde') && ['3', '2', '1'].every(x => r.said.includes(x)), JSON.stringify(r.said));
    rec('ieșire căști reduce volumul', r.gain);
    rec('ghid/voce/teme: fără erori', errs.length === 0, errs.join('|'));
    await page.close();
  }

  // ---- statistici + CSV + export/import ----
  {
    const { page, errs } = await fresh();
    const r = await page.evaluate(() => {
      const base = Date.now(), W = [];
      for (let k = 0; k < 3; k++) { W.push({ t: base - k * 864e5, ex: 'Presă piept (Chest Press)', kg: 40 + k, reps: 10, set: 1 }); W.push({ t: base - k * 864e5, ex: 'Presă picioare (Leg Press)', kg: 100, reps: 8, set: 1 }) }
      localStorage.setItem('cronosala.wlog', JSON.stringify(W));
      localStorage.setItem('cronosala.hist', JSON.stringify([{ t: base, type: 'AMRAP', sec: 600, done: true, cnt: 7 }]));
      renderStats();
      return { txt: document.getElementById('hStats').innerText };
    });
    rec('statistici: serie de zile, serii pe grupă, recorduri', /3\s*\n?zile la rând/.test(r.txt) && /Piept/.test(r.txt) && /Picioare/.test(r.txt) && /100 kg/.test(r.txt) && /7/.test(r.txt), r.txt.replace(/\n/g, ' | ').slice(0, 200));
    // export/import complet
    await page.evaluate(() => { localStorage.setItem('cronosala.settings', JSON.stringify({ vol: .3, theme: 'light' })) });
    const exp = await page.evaluate(() => { const d = {}; Object.keys(localStorage).filter(k => k.startsWith('cronosala.')).forEach(k => d[k] = localStorage.getItem(k)); return JSON.stringify({ app: 'cronosala', v: 3, data: d }) });
    const f = path.join(OUT, 'backup.json'); fs.writeFileSync(f, exp);
    const bad = path.join(OUT, 'bad.json'); fs.writeFileSync(bad, JSON.stringify({ app: 'cronosala', data: { 'evil.key': 'x' } }));
    await page.evaluate(() => { Object.keys(localStorage).forEach(k => localStorage.removeItem(k)) });
    const input = await page.$('#sFile');
    await input.uploadFile(bad); await wait(300);
    const rej = await page.evaluate(() => ({ dlg: !document.getElementById('dlg').hidden, toast: document.getElementById('toast').textContent }));
    rec('import: fișier cu chei străine respins', !rej.dlg && /invalid/i.test(rej.toast), JSON.stringify(rej));
    await input.uploadFile(f); await wait(300);
    const dlg = await page.evaluate(() => !document.getElementById('dlg').hidden);
    rec('import: fișier valid cere confirmare', dlg);
    const nav = page.waitForNavigation({ timeout: 5000 }).catch(() => null);
    await page.evaluate(() => document.getElementById('dlgOk').click()); await nav; await wait(300);
    const back = await page.evaluate(() => ({ w: JSON.parse(localStorage.getItem('cronosala.wlog') || '[]').length, theme: JSON.parse(localStorage.getItem('cronosala.settings') || '{}').theme }));
    rec('import: datele restaurate', back.w === 6 && back.theme === 'light', JSON.stringify(back));
    rec('statistici/import: fără erori', errs.length === 0, errs.join('|'));
    await page.close();
  }

  // ---- reluare după reload păstrează câmpurile noi ----
  {
    const { page, errs } = await fresh();
    await page.evaluate(() => {
      const T = TYPES.find(t => t.id === 'sets'); CUR = T; CFG = sanitize(T, { prep: 0, list: [{ n: 'Leg Press', sets: 2, r: '10', rest: 30 }, { n: 'Chest Press', sets: 1, r: '10', rest: 30 }] });
      NEXTPLAN = 'p1'; openRun('t', T.build(CFG), 'Serii'); begin(); next(); next(); saveRun(true);
    });
    await page.reload(); await wait(250);
    const r = await page.evaluate(() => { const b = document.getElementById('resume'); b.hidden || document.getElementById('rsGo').click(); return { banner: !b.hidden, log: !!cur().log, ex: cur().ex, blk: cur().blk, plan: E.plan, i: E.i } });
    rec('reluare: păstrează ex/blk/plan', r.banner && r.log && r.ex && r.blk !== undefined && r.plan === 'p1', JSON.stringify(r));
    rec('reluare: fără erori', errs.length === 0, errs.join('|'));
    await page.close();
  }

  // ---- layout mobil cu panoul de log ----
  for (const vp of [{ width: 320, height: 568 }, { width: 640, height: 360 }]) {
    const { page, errs } = await fresh({ ...vp, isMobile: true, hasTouch: true });
    const r = await page.evaluate(() => {
      const T = TYPES.find(t => t.id === 'sets'); CUR = T; CFG = sanitize(T, { list: [{ n: 'Extrem de lung nume de exercițiu pentru test de layout', sets: 2, r: '8-10', rest: 60 }] });
      openRun('t', T.build(CFG), 'Serii'); begin();
      const R = document.getElementById('run'), bad = [];
      for (const id of ['bPlay', 'rDone', 'bBusy', 'lgKg', 'lgRp']) { const e = document.getElementById(id), b = e.getBoundingClientRect(); if (b.width > 0 && (b.right > innerWidth + 1 || b.left < -1)) bad.push(id + ' orizontal') }
      const doc = document.documentElement; const m = document.querySelector('.rmain');
      return { bad, hscroll: doc.scrollWidth > innerWidth + 1, rdoneVis: (() => { const b = document.getElementById('rDone').getBoundingClientRect(); return b.bottom <= innerHeight + 1 })(), ctl: (() => { const b = document.getElementById('bPlay').getBoundingClientRect(); return b.bottom <= innerHeight + 1 && b.top >= 0 })() };
    });
    rec(`layout ${vp.width}×${vp.height} cu panou log`, !r.hscroll && r.bad.length === 0 && r.ctl, JSON.stringify(r));
    rec(`layout ${vp.width}×${vp.height}: fără erori`, errs.length === 0, errs.join('|'));
    await page.close();
  }

  console.log(`\n=== test2: ${pass}/${pass + fail} trecute ===`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();

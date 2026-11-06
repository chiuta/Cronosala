// Audit responsiv: node test4.js <fisier.html>
const puppeteer = require('puppeteer-core');
const FILE = process.argv[2]; let pass = 0, fail = 0;
const rec = (n, ok, d = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  — ' + d : '')); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const VPS = [[320,568,1],[360,640,1],[390,844,1],[430,932,1],[568,320,1],[667,375,1],[844,390,1],[768,1024,1],[1024,768,1],[1180,820,1],[1366,768,0],[1440,900,0],[1920,1080,0],[2560,1440,0]];
(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 60000, args: ['--no-sandbox', '--disable-gpu'] });
  for (const [w, h, touch] of VPS) {
    const page = await browser.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.setViewport({ width: w, height: h, isMobile: !!touch, hasTouch: !!touch });
    await page.evaluateOnNewDocument(() => { window.__T = new Date().getTime(); Date.now = () => window.__T; });
    await page.goto('file://' + FILE); await page.evaluate(() => { localStorage.clear();
      const m = new Date(); m.setHours(0,0,0,0); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); localStorage.setItem('cronosala.prog', JSON.stringify({ start: m.getTime(), days: ['r','p1','c10','p5','r','p6','c2'] }));
      localStorage.setItem('cronosala.cfg.circuit', JSON.stringify({ list: Array.from({ length: 12 }, (_, i) => ({ n: 'Exercițiu cu nume foarte lung numărul ' + i, s: 40 })) }));
      localStorage.setItem('cronosala.hist', JSON.stringify(Array.from({ length: 30 }, (_, i) => ({ t: Date.now() - i * 3e6, type: 'Serii pe exerciții cu nume lung', sec: 3700, done: true, cnt: 3 })))); });
    await page.reload(); await wait(200);
    const r = await page.evaluate(async (touch) => {
      const out = { h: [], v: [], t: [] };
      const vis = e => { const s = getComputedStyle(e), b = e.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && b.width > 0 && b.height > 0 };
      const checkH = (label) => {
        if (document.documentElement.scrollWidth > innerWidth + 1) out.h.push(label + ' scrollW=' + document.documentElement.scrollWidth);
        for (const e of document.querySelectorAll('main :is(button,input,select,.card,.crow,.fields,.stat,.hrow,.lab,.lap)')) { if (!vis(e) || e.closest('[hidden],details:not([open])>:not(summary)')) continue; const b = e.getBoundingClientRect(); if (b.right > innerWidth + 1 || b.left < -1) { out.h.push(label + ' ' + e.tagName + '.' + e.className + ' ' + Math.round(b.left) + '..' + Math.round(b.right)); break } }
      };
      const screens = ['home','stopwatch','metro','catalog','history','settings','program','labels'];
      for (const s of screens) { go(s); await new Promise(r => setTimeout(r, 40)); checkH(s);
        if (touch) for (const e of document.querySelectorAll('main :is(button,select,input[type=text],input[type=number],input[type=search])')) { if (!vis(e) || e.closest('details:not([open])')) continue; const b = e.getBoundingClientRect(); if ((b.height < 39 || b.width < 39) && !e.classList.contains('tg')) { out.t.push(s + ':' + (e.id || e.className || e.tagName) + ' ' + Math.round(b.width) + '×' + Math.round(b.height)); } } }
      for (const id of ['hiit','tabata','box','emom','amrap','circuit','sets','duo','tempo','iso','pyr','rest','cd']) { openType(id); await new Promise(r => setTimeout(r, 20)); checkH('cfg-' + id);
        if (touch) for (const e of document.querySelectorAll('#cfgBody :is(button,select,input[type=text],input[type=number])')) { if (!vis(e)) continue; const b = e.getBoundingClientRect(); if ((b.height < 39 || b.width < 39) && !e.classList.contains('tg')) { out.t.push('cfg-' + id + ':' + (e.id || e.className || e.getAttribute('aria-label')) + ' ' + Math.round(b.width) + '×' + Math.round(b.height)); break } } }
      // overlay: poziții verticale
      const runCheck = async (id, setup) => {
        openType(id); if (setup) setup(); startRun(); begin(); await new Promise(r => setTimeout(r, 60));
        if (id === 'sets') { next(); render(); }   // ajunge pe prima serie (manuală)
        if (id === 'amrap') { next(); render(); }
        await new Promise(r => setTimeout(r, 60));
        for (const k of ['rPhase','rTime','bPlay','bReset','rDone','bBusy','lgKg','rCnt','kbd','rClose']) { const e = document.getElementById(k); if (!e || !vis(e)) continue; const b = e.getBoundingClientRect(); if (b.bottom > innerHeight + 1 || b.top < -1 || b.right > innerWidth + 1 || b.left < -1) out.v.push(id + ':' + k + ' top=' + Math.round(b.top) + ' bottom=' + Math.round(b.bottom) + ' vh=' + innerHeight); }
        const rm = document.querySelector('.rmain'); if (rm.scrollHeight > rm.clientHeight + 2) out.v.push(id + ': rmain derulează ' + rm.scrollHeight + '>' + rm.clientHeight);
        shutRun();
      };
      await runCheck('hiit'); await runCheck('amrap'); await runCheck('box', () => { }); await runCheck('sets', () => { CFG.list[0].n = 'Un nume de exercițiu extrem de lung pentru a testa împachetarea textului'; });
      return out;
    }, !!touch);
    const tag = `${w}×${h}`;
    rec(`${tag}: fără depășire orizontală`, r.h.length === 0 && errs.length === 0, r.h.slice(0, 3).join(' | ') + errs.join('|'));
    rec(`${tag}: overlay încape vertical (fără decupări)`, r.v.length === 0, r.v.slice(0, 4).join(' | '));
    if (touch) rec(`${tag}: ținte tactile ≥39px`, r.t.length === 0, r.t.slice(0, 5).join(' | '));
    await page.close();
  }
  console.log(`\n=== test4: ${pass}/${pass + fail} trecute ===`); await browser.close(); process.exit(fail ? 1 : 0);
})();

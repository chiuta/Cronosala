// Test de limbi CRONOSALA: în fiecare dintre cele 7 limbi traduse nu mai rămân texte românești vizibile
// (ecran principal, configurarea și rularea fiecărui cronometru, catalog, program, istoric, setări).
// Rulare: node tests/i18n.test.mjs   (cere playwright; CHROMIUM_PATH opțional)
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";
const require = createRequire(process.env.PW_ROOT || import.meta.url);
const {chromium} = require("playwright");
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = "file://" + path.join(DIR, "index.html");
let ok = 0, bad = 0;
const check = (n, c, x) => { if (c) { ok++; console.log("  ok   " + n); } else { bad++; console.log("  FAIL " + n + (x !== undefined ? "  -> " + JSON.stringify(x) : "")); } };
const RO = /[ășțşţĂȘȚ]|\b(și|pentru|între|fără|când|cât|doar|aici|acum|seria|rundă|runde|faza|faze|pauză|exercițiu|antrenament)\b/;
const OK = /Popișteanu|nevoie de JavaScript/;
const b = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox"]});
for (const L of ["en", "fr", "de", "es", "it", "hu", "pt"]) {
  const ctx = await b.newContext({viewport: {width: 420, height: 900}, serviceWorkers: "block"});
  await ctx.addInitScript((L) => { try { localStorage.setItem("cronosala.lang", JSON.stringify(L)); } catch (e) {} }, L);
  const p = await ctx.newPage(); const errs = []; const bads = new Map();
  p.on("pageerror", (e) => errs.push(e.message));
  const scan = async (tag) => {
    const arr = await p.evaluate(() => { const o = []; const A = ["placeholder", "aria-label", "title", "alt"];
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT); let n = w.currentNode;
      while (n) { if (n.nodeType === 3) { const pn = n.parentNode.nodeName; if (!["SCRIPT", "STYLE", "NOSCRIPT"].includes(pn) && !n.parentNode.closest("[data-notr],noscript")) { const t = n.data.trim(); if (t) o.push(t); } }
        else if (n.nodeType === 1 && !n.closest("[data-notr],noscript")) { for (const a of A) { const v = n.getAttribute(a); if (v && v.trim()) o.push(v.trim()); } } n = w.nextNode(); }
      return o; });
    for (const t of arr) if (RO.test(t) && !OK.test(t) && !bads.has(t)) bads.set(t, tag);
  };
  await p.goto(FILE); await p.waitForTimeout(500); await scan("home");
  check(L + ": <html lang> = " + L, (await p.evaluate(() => document.documentElement.lang)) === L);
  const ids = await p.evaluate(() => [...document.querySelectorAll("#grid .card")].map((e) => e.dataset.id));
  for (const id of ids) {
    try {
      await p.goto(FILE); await p.waitForTimeout(150);
      await p.click(`#grid .card[data-id="${id}"]`); await p.waitForTimeout(200); await scan("cfg:" + id);
      const go = await p.$("#goBtn");
      if (go && await go.isEnabled()) { await go.click(); await p.waitForTimeout(350); await scan("run:" + id);
        const nx = await p.$("#bNext"); if (nx) { await nx.click({force: true}).catch(() => {}); await p.waitForTimeout(200); await scan("run2:" + id); } }
    } catch (e) { errs.push(id + ": " + e.message.slice(0, 60)); }
  }
  await p.goto(FILE); await p.waitForTimeout(200);
  for (const sel of ["#bHist", "#bSet"]) { try { await p.click(sel); await p.waitForTimeout(250); await scan(sel); } catch (e) { errs.push(sel); } }
  check(L + ": fără texte românești rămase", bads.size === 0, [...bads].slice(0, 5));
  check(L + ": fără erori JS", errs.length === 0, errs.slice(0, 3));
  await ctx.close();
}
await b.close();
console.log(ok + " ok, " + bad + " FAIL");
process.exit(bad ? 1 : 0);

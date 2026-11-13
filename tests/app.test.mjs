// Test de bază al aplicației CRONOSALA (rețea externă blocată): pornire fără erori, versiune coerentă, chei de stocare cu prefix,
// toate limbile selectabile, import/stocare ostilă, fără cereri de rețea.
// Rulare: node tests/app.test.mjs   (cere playwright; CHROMIUM_PATH opțional)
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";
const require = createRequire(process.env.PW_ROOT || import.meta.url);
const {chromium} = require("playwright");
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = "file://" + path.join(DIR, "index.html");
const SLUG = "cronosala", MIN_LANGS = 1;
let ok = 0, bad = 0;
const check = (n, c, x) => { if (c) { ok++; console.log("  ok   " + n); } else { bad++; console.log("  FAIL " + n + (x !== undefined ? "  -> " + JSON.stringify(x) : "")); } };
const html = fs.readFileSync(path.join(DIR, "index.html"), "utf8");
const meta = (n) => (html.match(new RegExp('<meta name="' + n + '" content="([^"]*)"')) || [])[1];
let appjson = {}; try { appjson = JSON.parse(fs.readFileSync(path.join(DIR, "app.json"), "utf8")); } catch {}
check("metas application-version și last-updated prezente", !!meta("application-version") && /^\d{4}-\d{2}-\d{2}$/.test(meta("last-updated") || ""), [meta("application-version"), meta("last-updated")]);
check("app.json: versiunea coincide cu meta", appjson.version === meta("application-version"), [appjson.version, meta("application-version")]);
check("CSP prezent, fără 'unsafe-eval'", /Content-Security-Policy/.test(html) && !/unsafe-eval/.test(html));
const b = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox"]});
const net = [], errs = [];
async function open(w = 1100) {
  const ctx = await b.newContext({viewport: {width: w, height: 800}, serviceWorkers: "block"});
  await ctx.route(/^https?:/, (r) => { net.push(r.request().url()); r.abort(); });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text())) errs.push(m.text()); });
  p.on("dialog", (d) => d.dismiss());
  await p.goto(FILE); await p.waitForTimeout(900);
  return {ctx, p};
}
{
  const {ctx, p} = await open();
  const v = await p.evaluate(() => (document.getElementById("app-version") || {}).textContent || "");
  check("#app-version afișează versiunea din meta", v.replace(/^v/i, "").trim() === meta("application-version"), v);
  check("titlul paginii nu e gol", (await p.title()).length > 3);
  check("pagina are conținut vizibil (>200 caractere)", (await p.evaluate(() => document.body.innerText.length)) > 200);
  // chei de stocare cu prefix, după interacțiunea de pornire (schimbare limbă/temă dacă există)
  const sel = await p.evaluate(() => { const s = document.getElementById("lang") || document.getElementById("langsel"); return s ? [...s.options].map((o) => o.value) : []; });
  check("selectorul de limbă are cel puțin " + MIN_LANGS + " limbi", MIN_LANGS <= 1 || sel.length >= MIN_LANGS, sel);
  const id = await p.evaluate(() => (document.getElementById("lang") || document.getElementById("langsel") || {}).id || "");
  const seen = new Set();
  for (let i = 0; i < sel.length; i++) {
    await p.selectOption("#" + id, {index: i}); await p.waitForTimeout(150);
    const lg = await p.evaluate(() => document.documentElement.lang);
    seen.add(lg.slice(0, 2));
    check("limba #" + i + " (" + lg + "): <html lang> valid, text nevid", /^[a-z]{2}/.test(lg) && (await p.evaluate(() => document.body.innerText.length)) > 200, lg);
  }
  if (MIN_LANGS > 1) check("limbi distincte în <html lang>: cel puțin " + MIN_LANGS, seen.size >= MIN_LANGS, [...seen]);
  const keys = await p.evaluate(() => Object.keys(localStorage));
  check("toate cheile localStorage au prefixul „" + SLUG + "” sau „fff”", keys.every((k) => k.startsWith(SLUG) || k.startsWith("fff")), keys);
  await ctx.close();
}
{ // stocare ostilă: JSON invalid / tipuri greșite în toate cheile aplicației
  const ctx = await b.newContext({serviceWorkers: "block"});
  await ctx.route(/^https?:/, (r) => { net.push(r.request().url()); r.abort(); });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push("ostil: " + e.message));
  await p.addInitScript((slug) => { try { for (const k of [slug + ".state", slug + ".v", slug + ".s", slug + ".data", slug + ".proj", slug + ".lang", "lang", slug]) localStorage.setItem(k, "{\"__proto__\":{\"x\":1},\"a\":[1,{\"b\":null}]"); localStorage.setItem(slug + ".x", "\u0000\ud800"); } catch (e) {} }, SLUG);
  await p.goto(FILE); await p.waitForTimeout(900);
  check("stocare coruptă/ostilă: pagina pornește fără excepții", (await p.evaluate(() => document.body.innerText.length)) > 100 && !errs.some((e) => e.startsWith("ostil")), errs.filter((e) => e.startsWith("ostil")));
  check("prototype pollution: Object.prototype.x nedefinit", await p.evaluate(() => ({}).x === undefined));
  await ctx.close();
}
{ // 360 px: fără defilare orizontală
  const {ctx, p} = await open(360);
  check("360 px: fără defilare orizontală a paginii", await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await ctx.close();
}
check("fără cereri de rețea externă la pornire (blocate)", net.filter((u) => !/^data:|^blob:/.test(u)).length === 0 || false, net.slice(0, 5));
check("fără erori JS / de consolă", errs.length === 0, errs.slice(0, 5));
await b.close();
console.log(ok + " ok, " + bad + " FAIL");
process.exit(bad ? 1 : 0);

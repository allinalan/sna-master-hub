#!/usr/bin/env node
// Regression check for where the cursor goes when you click into a field, finish it,
// or leave it. It drives index.html in a real browser against tools/dev-server.js
// (fake backends, hub sync off), so nothing it does reaches Google or the shared copy.
//
//   node tools/edit-focus-check.js              headless Chromium (Playwright's own build)
//   node tools/edit-focus-check.js --chrome     the installed Google Chrome
//   node tools/edit-focus-check.js --headed     in a window you can watch
//   BASE=http://localhost:8830/ node tools/edit-focus-check.js
//                                               use a dev server that's already running
//
// Exit 0: every check passed · 1: a check failed · 2: it couldn't run (no Playwright,
// no browser, the dev server didn't start, or a field it needs isn't on the page).
//
// Playwright isn't a dependency of this repo. It's looked for in this order:
//   $PLAYWRIGHT (the package folder) · a normal require("playwright") ·
//   ~/projects/road-to-hyrox/node_modules/playwright
//
// What it guards (PR #22):
//   Enter, Tab or Escape finishes a field, and no later render (a sync pull) puts the
//   cursor back in it. Clicking from a changed field A into field B still lands in B.
//   Clicking a "+ note" placeholder with Edit off puts the caret in the note, whatever
//   was clicked before it, and focusing a note never moves its text.
"use strict";
const net = require("net");
const os = require("os");
const path = require("path");
const {spawn} = require("child_process");

const args = new Set(process.argv.slice(2));
for(const a of args) if(!["--chrome", "--headed"].includes(a)) die(`unknown option ${a} (try --chrome or --headed)`);

function die(msg){ console.error("edit-focus-check: " + msg); process.exit(2); }

function loadPlaywright(){
  const tried = [];
  const candidates = [process.env.PLAYWRIGHT, "playwright",
                      path.join(os.homedir(), "projects/road-to-hyrox/node_modules/playwright")];
  for(const c of candidates){
    if(!c) continue;
    try{ return {pw: require(c), from: c}; }
    catch(e){ tried.push(c); }
  }
  die("can't find Playwright. Tried: " + tried.join(" · ") +
      "\n  Point PLAYWRIGHT at an installed copy, e.g. PLAYWRIGHT=/path/to/node_modules/playwright");
}

const freePort = () => new Promise((ok, fail) => {
  const s = net.createServer().once("error", fail);
  s.listen(0, "127.0.0.1", () => { const {port} = s.address(); s.close(() => ok(port)); });
});

/* our own dev server on a free port, so a preview you already have on 8830 is left alone */
async function startServer(){
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(__dirname, "dev-server.js")],
                      {env: {...process.env, PORT: String(port)}, stdio: ["ignore", "pipe", "pipe"]});
  let out = "";
  await new Promise((ok, fail) => {
    const t = setTimeout(() => fail(new Error("no answer within 10 s")), 10000);
    child.stdout.on("data", d => { out += d; if(out.includes("http://localhost:")){ clearTimeout(t); ok(); } });
    child.stderr.on("data", d => { out += d; });
    child.on("exit", code => { clearTimeout(t); fail(new Error("exited with code " + code)); });
  }).catch(e => { child.kill(); die("the dev server didn't start: " + e.message + (out ? "\n" + out.trim() : "")); });
  child.removeAllListeners("exit");
  return {base: `http://localhost:${port}/`, stop: () => child.kill()};
}

/* ── the checks ───────────────────────────────────────────────────────── */

const results = [];
function check(name, ok, detail){
  results.push(ok);
  console.log((ok ? "  PASS " : "  FAIL ") + name + (ok ? "" : "\n         " + JSON.stringify(detail)));
}
class Missing extends Error {}                     // a field the checks need isn't on the page

const sel = p => `[data-edit="${p.replace(/"/g, '\\"')}"]`;

/* what has focus, as a data-edit path (null when it's no field) */
const focused = page => page.evaluate(() => {
  const a = document.activeElement;
  return a && a.dataset && a.dataset.edit || null;
});
const textOf = (page, p) => page.evaluate(p => {
  const el = document.querySelector(`[data-edit="${CSS.escape(p)}"]`);
  return el ? el.textContent : null;
}, p);
/* macOS doesn't move the caret on End, so put it at the end of the focused field directly */
const caretToEnd = page => page.evaluate(() => {
  const s = getSelection(); s.selectAllChildren(document.activeElement); s.collapseToEnd();
});
/* A click that lands before the 500 ms save-as-you-type timer, so leaving the field has
   something to save and re-renders — the path PENDING_FOCUS exists for. */
const beatTheSaveTimer = page => page.evaluate(() => clearTimeout(INPUT_TIMER));
/* a spot on the board with nothing clickable under it: clicking it only moves the selection */
async function blankSpot(page){
  const at = await page.evaluate(() => {
    const v = document.getElementById("view").getBoundingClientRect();
    for(let y = Math.max(v.top, 0) + 4; y < Math.min(v.bottom, innerHeight) - 4; y += 12)
      for(let x = v.right - 8; x > v.left + 8; x -= 40){
        const el = document.elementFromPoint(x, y);
        if(el && !el.closest("button, a, input, select, textarea, label, [data-edit], [contenteditable]")) return {x, y};
      }
    return null;
  });
  if(!at) throw new Missing("no blank spot on the board to click");
  return at;
}
const countRenders = page => page.evaluate(() => {
  window.__renders = 0;
  const real = render;
  render = function(){ window.__renders++; return real.apply(this, arguments); };
});

/* pickers run in the page and return data-edit paths; an empty result is a Missing field */
const pick = {
  topics: () => [...document.querySelectorAll('[data-edit^="calendar."][data-edit$=".topic"]:not([data-ph])')]
    .filter(e => e.textContent.trim() && e.getBoundingClientRect().width).slice(0, 2).map(e => e.dataset.edit),
  notes: () => [...document.querySelectorAll('[data-edit^="business."][data-edit$=".note"]:not([data-ph])')]
    .filter(e => e.textContent.trim()).slice(0, 2).map(e => e.dataset.edit),
  noteSlot: () => [...document.querySelectorAll('[data-edit^="business."][data-edit$=".note"][data-ph]')]
    .slice(0, 1).map(e => e.dataset.edit),
  openWeek: () => [...document.querySelectorAll('[data-edit^="calendar."][data-ph^="+ open"]')]
    .filter(e => e.getBoundingClientRect().width).slice(0, 1).map(e => e.dataset.edit),
};
async function find(page, what, n){
  const got = await page.evaluate(pick[what]);
  if(got.length < n) throw new Missing(`needs ${n} "${what}" field(s) on the page, found ${got.length}`);
  return got;
}

let browser, BASE;
async function onPage(hash, {edit = false, width = 1280} = {}, fn){
  const ctx = await browser.newContext({viewport: {width, height: 800}});
  try{
    const page = await ctx.newPage();
    page.setDefaultTimeout(5000);
    await page.goto(BASE + hash);
    await page.waitForSelector("[data-edit]");
    if(edit){ await page.click("#editBtn"); await page.waitForSelector("body.editing"); }
    await fn(page);
  }finally{ await ctx.close(); }
}

async function finishingAField(){
  console.log("\nFinishing a field — the cursor must not come back to it");

  await onPage("#calendar", {edit: true}, async page => {
    const [A] = await find(page, "topics", 1);
    await page.click(sel(A)); await caretToEnd(page); await page.keyboard.type(" X");
    await page.keyboard.press("Enter");
    check("calendar: change a topic, Enter leaves it", await focused(page) === null, {focused: await focused(page)});
    check("calendar: …and the change is kept", /X$/.test(await textOf(page, A)), {text: await textOf(page, A)});
    await page.evaluate(() => render());             // stands in for a sync pull landing later
    check("calendar: …and a later render doesn't put the cursor back", await focused(page) === null, {focused: await focused(page)});
  });

  await onPage("#calendar", {edit: true}, async page => {
    const [A] = await find(page, "topics", 1);
    await page.click(sel(A)); await page.keyboard.press("Enter");
    check("calendar: Enter with nothing changed leaves the field", await focused(page) === null, {focused: await focused(page)});
  });

  await onPage("#calendar", {edit: true}, async page => {
    const [A] = await find(page, "topics", 1);
    await page.click(sel(A)); await page.click(sel(A));          // a second click inside it, to move the caret
    await caretToEnd(page); await page.keyboard.type(" Y"); await page.keyboard.press("Enter");
    check("calendar: click twice inside a field, change it, Enter leaves it", await focused(page) === null, {focused: await focused(page)});
  });

  await onPage("#calendar", {edit: true}, async page => {
    const [A, B] = await find(page, "topics", 2);
    await page.click(sel(A)); await page.click(sel(B));          // nothing to save, so no render on the way
    check("calendar: click A (unchanged) then B lands in B", await focused(page) === B, {focused: await focused(page), B});
    await caretToEnd(page); await page.keyboard.type(" B"); await page.keyboard.press("Enter");
    check("calendar: …then change B, Enter leaves it", await focused(page) === null, {focused: await focused(page)});
  });

  await onPage("#calendar", {edit: true}, async page => {
    const [A] = await find(page, "topics", 1);
    await page.click(sel(A)); await caretToEnd(page); await page.keyboard.type(" T");
    await page.keyboard.press("Tab");
    check("calendar: change a topic, Tab doesn't come back to it", await focused(page) !== A, {focused: await focused(page)});
  });

  await onPage("#calendar", {edit: true}, async page => {
    const [A] = await find(page, "topics", 1);
    await page.click(sel(A)); await caretToEnd(page); await page.keyboard.type(" E");
    await page.keyboard.press("Escape");
    check("calendar: change a topic, Escape leaves it", await focused(page) === null, {focused: await focused(page)});
  });

  await onPage("#calendar", {}, async page => {                 // Edit off: the topic isn't editable
    const [A] = await find(page, "topics", 1);
    await page.click(sel(A));
    await page.evaluate(() => render());
    const st = await page.evaluate(() => ({pending: PENDING_FOCUS, selected: getSelection().toString()}));
    check("calendar, Edit off: clicking a topic then a render selects nothing", st.pending === null && st.selected === "", st);
  });

  await onPage("#business", {}, async page => {
    const [A] = await find(page, "notes", 1);
    await page.click(sel(A)); await page.keyboard.press("ControlOrMeta+a"); await page.keyboard.press("Backspace");
    await page.keyboard.press("Enter");
    check("orders, Edit off: empty a note, Enter leaves it", await focused(page) === null, {focused: await focused(page)});
  });

  await onPage("#business", {}, async page => {
    const [P] = await find(page, "noteSlot", 1);
    await page.click(sel(P)); await page.keyboard.type("hello"); await page.keyboard.press("Enter");
    const st = {focused: await focused(page), text: await textOf(page, P)};
    check("orders, Edit off: write in a + note, Enter leaves it and keeps the note", st.focused === null && st.text === "hello", st);
  });
}

async function clickingFromFieldToField(){
  console.log("\nClicking from a changed field A to field B — the cursor must land in B");
  const cases = [
    ["calendar topic → topic", "#calendar", true, page => find(page, "topics", 2)],
    ["orders note → note (Edit off)", "#business", false, page => find(page, "notes", 2)],
    ["orders note → + note (Edit off)", "#business", false,
      async page => [(await find(page, "notes", 1))[0], (await find(page, "noteSlot", 1))[0]]],
  ];
  for(const [name, hash, edit, fields] of cases){
    await onPage(hash, {edit}, async page => {
      const [A, B] = await fields(page);
      await countRenders(page);
      await page.locator(sel(B)).scrollIntoViewIfNeeded();
      await page.click(sel(A)); await caretToEnd(page); await page.keyboard.type(" a1");
      await beatTheSaveTimer(page);
      await page.click(sel(B));
      const st = await page.evaluate(() => ({focused: document.activeElement.dataset.edit || null,
                                              renders: window.__renders, pending: PENDING_FOCUS}));
      check(`${name}: one render, cursor in B`, st.renders === 1 && st.focused === B && st.pending === null, {...st, B});
      await page.keyboard.type("Z"); await page.keyboard.press("Enter");
      const end = {A: await textOf(page, A), B: await textOf(page, B), focused: await focused(page)};
      check(`${name}: A kept, typing went into B, Enter leaves B`,
            /a1$/.test(end.A) && end.B.includes("Z") && end.focused === null, end);
    });
  }
}

async function clickingAPlaceholder(){
  console.log("\nClicking a placeholder — typing must land in it, whatever was clicked first");
  const before = {
    "nothing": async () => {},
    "the page heading": async page => { await page.click("h1"); },
    "blank board space": async page => { const {x, y} = await blankSpot(page); await page.mouse.click(x, y); },
    "another field, unchanged": async (page, other) => { await page.click(sel(other)); },
    "another field, changed": async (page, other) => { await page.click(sel(other)); await page.keyboard.type("x"); await beatTheSaveTimer(page); },
  };
  const targets = [
    ["orders + note, Edit off", "#business", false, "noteSlot", "notes", ["left", "middle", "right"]],
    ["orders + note, Edit on", "#business", true, "noteSlot", "notes", ["middle"]],
    ["calendar + open, Edit on", "#calendar", true, "openWeek", "topics", ["middle"]],
  ];
  for(const [name, hash, edit, slot, otherKind, spots] of targets){
    for(const [first, doFirst] of Object.entries(before)){
      const miss = [];
      for(const spot of spots){
        await onPage(hash, {edit}, async page => {
          const [P] = await find(page, slot, 1);
          const [other] = await find(page, otherKind, 1);
          await page.locator(sel(P)).scrollIntoViewIfNeeded();
          await doFirst(page, other);
          await page.locator(sel(P)).scrollIntoViewIfNeeded();     // clicking the heading scrolls to the top
          const b = await page.locator(sel(P)).boundingBox();
          const x = spot === "left" ? b.x + 2 : spot === "right" ? b.x + b.width - 2 : b.x + b.width / 2;
          await page.mouse.click(x, b.y + b.height / 2);
          await page.keyboard.type("abc");
          const text = await textOf(page, P);
          if(text !== "abc") miss.push({spot, text, focused: await focused(page)});
        });
      }
      check(`${name}, after clicking ${first}`, miss.length === 0, miss);
    }
  }
}

async function focusingMovesNothing(){
  console.log("\nFocusing an Orders of Business note — its text must not move");
  for(const width of [1280, 390]){
    await onPage("#business", {width}, async page => {
      await find(page, "notes", 1);
      const moved = await page.evaluate(() => {
        const first = document.querySelector('[data-edit^="business."][data-edit$=".note"]:not([data-ph])').dataset.edit;
        setPath(first, "A long note that wraps onto more than one line on a phone, and maybe on a desktop too, " +
                       "to see whether clicking into it shifts the text or the row around it");
        render();
        const out = [];
        for(const el of document.querySelectorAll('[data-edit^="business."][data-edit$=".note"]:not([data-ph])')){
          if(!el.isConnected){ out.push({note: el.dataset.edit, error: "the page re-rendered mid-check"}); break; }
          const where = () => {
            const r = document.createRange(); r.selectNodeContents(el);
            return [...r.getClientRects()].map(x => [x.x, x.y, x.width].map(Math.round).join(",")).join(" ") +
                   " row " + Math.round(el.closest(".biz-row").getBoundingClientRect().height);
          };
          const b = where(); el.focus(); const a = where(); el.blur();   // nothing typed, so blur doesn't render
          if(a !== b) out.push({note: el.dataset.edit, before: b, focused: a});
        }
        return out;
      });
      check(`${width}px wide: no note's text or row moves when it's focused`, moved.length === 0, moved);
    });
  }
}

(async () => {
  const {pw, from} = loadPlaywright();
  const server = process.env.BASE ? null : await startServer();
  BASE = process.env.BASE || server.base;
  const channel = args.has("--chrome") ? "chrome" : undefined;
  try{
    browser = await pw.chromium.launch({channel, headless: !args.has("--headed")});
  }catch(e){
    if(server) server.stop();
    die(`couldn't launch ${channel ? "Google Chrome" : "Playwright's Chromium"}: ${e.message.split("\n")[0]}` +
        (channel ? "" : "\n  Install it with: npx playwright install chromium"));
  }
  console.log(`edit-focus-check · ${channel ? "Google Chrome" : "Chromium"} ${browser.version()}` +
              `${args.has("--headed") ? ", headed" : ""} · ${BASE} · Playwright from ${from}`);
  let code = 0;
  try{
    await finishingAField();
    await clickingFromFieldToField();
    await clickingAPlaceholder();
    await focusingMovesNothing();
    const failed = results.filter(ok => !ok).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    code = failed ? 1 : 0;
  }catch(e){
    console.error("\nedit-focus-check: stopped — " + (e instanceof Missing ? e.message : e.stack));
    code = 2;
  }finally{
    await browser.close();
    if(server) server.stop();
  }
  process.exit(code);
})();

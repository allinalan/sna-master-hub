#!/usr/bin/env node
// Regression check for how the hub looks and how its controls behave: the menus, the
// drawer, the popovers, the switches, the boards' group labels, print, and the Orders
// of Business placeholders. It drives index.html in a real browser against
// tools/dev-server.js (fake backends, hub sync off), so nothing it does reaches Google or
// the shared copy.
//
//   node tools/design-check.js              headless Chromium (Playwright's own build)
//   node tools/design-check.js --chrome     the installed Google Chrome
//   node tools/design-check.js --headed     in a window you can watch
//   BASE=http://localhost:8830/ node tools/design-check.js
//                                           use a dev server that's already running
//
// It unlocks the coach boards with the dev server's key ("dev"), so it only ever runs
// against tools/dev-server.js on this machine: a BASE that isn't one is refused before a
// page opens. It never turns an automation switch ON (on the real sheet that starts real
// sends, which is why the hub asks first): a switch's look is checked on a copy with the
// class set by hand, and nothing it adds to a board is written to the dev server either.
//
// Exit 0: every check passed · 1: a check failed · 2: it couldn't run (no Playwright,
// no browser, the dev server didn't start, BASE isn't the dev server, or something it
// needs isn't on the page).
//
// Playwright isn't a dependency of this repo. It's looked for in this order:
//   $PLAYWRIGHT (the package folder) · a normal require("playwright") ·
//   ~/projects/road-to-hyrox/node_modules/playwright
//
// What it guards (PRs #34 and #35, and the follow-ups after them):
//   Export is a menu: Save as PNG downloads a PNG, Print or save as PDF calls window.print.
//   The menus work from the keyboard: Enter, Space or an arrow on the trigger opens one
//   with an item focused, Up / Down / Home / End move, Enter runs one, Escape and Tab close
//   it and give the focus back to the trigger. A click opens one and leaves the focus alone.
//   Edit's "+ Add…" shows only on the week under the pointer, and "Add a note under …"
//   adds a note with the caret in it. Money's + Income is the page's one primary, and ⋯
//   holds Splits, Buyout and Refresh. Clicking the dimmed page closes an untouched drawer,
//   but shakes (and keeps open) one you've typed in, and the toast says why. Popovers
//   spring out of what you clicked. A switch's knob moves across when it's on.
//   A board's group labels ("Alan's mentees · 2", "The Dojo") stay in view when the board
//   is scrolled sideways, and still show in print and in the PNG, which is the whole width.
//   The Assignments board's name column holds at the left edge when it scrolls sideways (at
//   390 and 600px wide): every name stays in view and on top of the squares under it, faded
//   former rows too, with the group labels lined up over it; a hovered row's band runs under
//   its name; dark mode fills it with the dark card; a square the keyboard lands on is never
//   under it; a click doesn't slide the board. In print and the PNG it's a plain column.
//   The same on Weekly Check-ins and Call Attendance (390 and 1000px): Tab and Shift+Tab never
//   leave a square, or a roll-call heading, under the frozen names or past the right edge; Enter
//   on one the keyboard brought out opens its popover (or that call's roll) right there, and
//   "Showing Wk a–b" keeps up; a click on a half-covered one opens it without the board moving.
//   The calendar's seasons run on across printed pages (a week never splits, a season's
//   heading never sits alone at the foot of a page), so page 1 isn't just the stats.
//   Orders of Business keeps its unset chips and "+ note" out of sight until the row is
//   hovered or focused (or always, on a touch screen); set ones always show.
"use strict";
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");
const {spawn} = require("child_process");

const KEY = "dev";                                 // tools/dev-server.js's coach key
const args = new Set(process.argv.slice(2));
for(const a of args) if(!["--chrome", "--headed"].includes(a)) die(`unknown option ${a} (try --chrome or --headed)`);

function die(msg){ console.error("design-check: " + msg); process.exit(2); }

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

/* The coach key only goes to the dev server: a page on this machine whose backends are the
   dev server's fakes. Anything else (the live hub, a copy pointed at Google) is refused. */
async function mustBeDevServer(base){
  let url;
  try{ url = new URL(base); }catch(e){ die(`BASE ${base} isn't a URL`); }
  if(!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    die(`BASE ${base} isn't on this machine. This check enters the dev server's coach key, so it only runs against tools/dev-server.js.`);
  let html;
  try{ html = await (await fetch(base)).text(); }catch(e){ die(`couldn't load ${base}: ${e.message}`); }
  if(!/const TEAM_API = "\/__team"/.test(html) || !/const MONEY_API\s*= "\/__money"/.test(html) || /script\.google\.com\/macros\/s\//.test(html))
    die(`${base} isn't tools/dev-server.js (its page still talks to a real backend). Start one with: node tools/dev-server.js`);
}

/* ── the checks ───────────────────────────────────────────────────────── */

const results = [];
function check(name, ok, detail){
  results.push(ok);
  console.log((ok ? "  PASS " : "  FAIL ") + name + (ok ? "" : "\n         " + JSON.stringify(detail)));
}
class Missing extends Error {}                     // something the checks need isn't on the page
const need = (what, got) => { if(!got) throw new Missing(what); return got; };

let browser, BASE;
const pageErrors = [];
/* a fresh browser profile on a tab, unlocked with the dev key, with the page entrance played out */
async function onPage(hash, {width = 1280, height = 800, edit = false, touch = false, ready = "#view .export-frame"} = {}, fn){
  const ctx = await browser.newContext({viewport: {width, height}, acceptDownloads: true,
                                        ...(touch ? {hasTouch: true, isMobile: true} : {})});
  await ctx.addInitScript(key => { try{ localStorage.setItem("sna_coach_key", key); }catch(e){} }, KEY);
  try{
    const page = await ctx.newPage();
    page.setDefaultTimeout(8000);
    page.on("pageerror", e => pageErrors.push(`${hash}: ${e.message}`));
    await page.goto(BASE + hash);
    await page.waitForSelector(ready).catch(() => { throw new Missing(`${hash} never showed ${ready}`); });
    if(edit){ await page.click("#editBtn"); await page.waitForSelector("body.editing"); }
    await settled(page);
    await fn(page);
  }finally{ await ctx.close(); }
}
const settled = page => page.waitForFunction(() => ![...document.getElementById("view").children]
  .flatMap(c => c.getAnimations()).some(a => a.animationName === "pageIn" && a.playState === "running"));
const pause = (page, ms) => page.waitForTimeout(ms);

/* what's in the open menu, and where the focus is */
const menuState = page => page.evaluate(() => {
  const pop = document.getElementById("menuPop"), a = document.activeElement;
  return {open: !pop.classList.contains("hidden"), items: [...pop.querySelectorAll(".mi")].map(b => b.textContent.trim()),
          focus: pop.contains(a) ? "item:" + a.textContent.trim() : a && a.matches("[data-menu]") ? "trigger:" + a.textContent.trim() : a ? a.tagName : null};
});
const stubPrint = page => page.evaluate(() => { window.__prints = 0; window.print = () => { window.__prints++; }; });
const prints = page => page.evaluate(() => new Promise(ok => setTimeout(() => ok(window.__prints), 150)));   // printBoard waits 60 ms
/* the download an action starts, or null if none comes (a PNG can take a few seconds: the fonts are inlined first) */
const download = (page, act) => Promise.all([page.waitForEvent("download", {timeout: 30000}), act()]).then(([d]) => d, () => null);
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const pdfPages = buf => (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;

async function exportMenu(){
  console.log("\nExport — a menu: Save as PNG downloads a PNG, Print calls window.print");
  await onPage("#calendar", {ready: ".week"}, async page => {
    await stubPrint(page);
    const trig = "#view [data-exportfor]";
    need("an Export button on the calendar", await page.$(trig));
    await page.click(trig);
    const st = await menuState(page);
    check("Export opens a menu: Save as PNG, Print or save as PDF",
          st.open && st.items.join(" | ") === "Save as PNG | Print or save as PDF", st);
    check("…and a click leaves the focus where it was, not in the menu", !String(st.focus).startsWith("item:"), st);
    const dl = await download(page, () => page.click("#menuPop .mi[data-png]"));
    const file = dl ? fs.readFileSync(await dl.path()) : Buffer.alloc(0);
    check("Save as PNG downloads a .png that is a PNG", !!dl && /\.png$/.test(dl.suggestedFilename()) && file.subarray(0, 8).equals(PNG_SIG),
          {name: dl && dl.suggestedFilename(), head: file.subarray(0, 8).toString("hex")});
    check("…and the menu closed", !(await menuState(page)).open, await menuState(page));
    await page.click(trig); await page.click("#menuPop .mi[data-print]");
    const n = await prints(page);
    const after = await page.evaluate(() => ({exporting: document.body.classList.contains("exporting"), style: !!document.getElementById("printOnly")}));
    check("Print or save as PDF calls window.print once, and tidies up after", n === 1 && !after.exporting && !after.style, {prints: n, ...after});
  });
}

async function menusFromTheKeyboard(){
  console.log("\nMenus from the keyboard — Enter, Space and the arrows open them; arrows move; Escape and Tab close");
  await onPage("#calendar", {ready: ".week"}, async page => {
    await stubPrint(page);
    const trig = "#view [data-exportfor]";
    const step = async (key, want, name) => {
      await page.keyboard.press(key);
      const st = await menuState(page);
      check(name, st.open === want.open && st.focus === want.focus, {...st, want});
    };
    await page.focus(trig);
    await step("Enter", {open: true, focus: "item:Save as PNG"}, "Enter on Export opens it with the first item focused");
    await step("ArrowDown", {open: true, focus: "item:Print or save as PDF"}, "Down moves to the next item");
    await step("ArrowDown", {open: true, focus: "item:Save as PNG"}, "Down from the last wraps to the first");
    await step("ArrowUp", {open: true, focus: "item:Print or save as PDF"}, "Up from the first wraps to the last");
    await step("Home", {open: true, focus: "item:Save as PNG"}, "Home goes to the first item");
    await step("End", {open: true, focus: "item:Print or save as PDF"}, "End goes to the last item");
    await step("Escape", {open: false, focus: "trigger:Export"}, "Escape closes it and gives the focus back to Export");
    await step("Space", {open: true, focus: "item:Save as PNG"}, "Space on Export opens it with the first item focused");
    await step("Tab", {open: false, focus: "trigger:Export"}, "Tab closes it and gives the focus back to Export");
    await step("ArrowDown", {open: true, focus: "item:Save as PNG"}, "Down on a closed Export opens it too");
    /* Print hides the toolbar while it prints and Export is disabled while the PNG renders,
       so the focus comes back to Export once it can take it */
    const backOnExport = () => page.waitForFunction(() => document.activeElement.matches("[data-exportfor]"), null, {timeout: 3000}).catch(() => {});
    await page.keyboard.press("End"); await page.keyboard.press("Enter");
    const n = await prints(page);
    await backOnExport();
    const st = await menuState(page);
    check("Enter on Print or save as PDF runs it, closes the menu and puts the focus back on Export",
          n === 1 && !st.open && st.focus === "trigger:Export", {prints: n, ...st});
    await page.keyboard.press("Enter");
    const opened = await menuState(page);
    const dl = opened.focus === "item:Save as PNG" ? await download(page, () => page.keyboard.press("Enter")) : null;
    await backOnExport();
    const png = await menuState(page);
    check("Enter on Save as PNG downloads it and puts the focus back on Export once it's rendered",
          !!dl && /\.png$/.test(dl.suggestedFilename()) && !png.open && png.focus === "trigger:Export",
          {opened: opened.focus, name: dl && dl.suggestedFilename(), ...png});
  });

  await onPage("#money", {ready: "#view [data-moneyact='new'][data-kind='income']"}, async page => {
    const more = need("Money's ⋯ menu", await page.$("#view .toolbar [data-menu][aria-label^='More']"));
    await more.focus(); await page.keyboard.press("Enter");
    const a = await menuState(page);
    await page.keyboard.press("ArrowUp");
    const b = await menuState(page);
    await page.keyboard.press("Escape");
    const c = await page.evaluate(() => ({open: !document.getElementById("menuPop").classList.contains("hidden"),
                                           onMore: document.activeElement.matches("[data-menu][aria-label^='More']")}));
    check("Money's ⋯ from the keyboard: Enter → Splits, Up → Refresh from the sheet, Escape → back on ⋯",
          a.focus === "item:Splits" && b.focus === "item:Refresh from the sheet" && !c.open && c.onMore, {a, b, c});
  });
}

async function editAddMenu(){
  console.log("\nEdit's + Add… — only on the week under the pointer; Add a note puts the caret in the note");
  await onPage("#calendar", {edit: true, ready: ".week"}, async page => {
    /* a week whose menu can add a note: one with a call on it */
    const k = await page.evaluate(() => [...document.querySelectorAll(".week")].findIndex(w => {
      const t = w.querySelector(".wk-tools template.menu-src");
      return t && t.innerHTML.includes("data-addnote") && w.getBoundingClientRect().height;
    }));
    if(k < 0) throw new Missing("a week with a call on it (its + Add… menu has Add a note under …)");
    const week = page.locator(".week").nth(k);
    await week.scrollIntoViewIfNeeded();
    await week.locator(".wk-main").hover({position: {x: 40, y: 12}});
    await pause(page, 350);                                       // the others' fade-out is 0.2 s
    const shown = await page.evaluate(() => [...document.querySelectorAll(".week")].map((w, i) => {
      const t = w.querySelector(".wk-tools"); return t ? [i, Number(getComputedStyle(t).opacity)] : null;
    }).filter(Boolean));
    const lit = shown.filter(([, o]) => o > 0).map(([i]) => i);
    check("with Edit on, + Add… shows on the hovered week and on no other", lit.length === 1 && lit[0] === k, {hovered: k, lit});

    await week.locator(".wk-tools [data-menu]").click();
    const st = await menuState(page);
    const item = st.items.find(t => /^Add a note under /.test(t));
    check("its menu has Add a note under …", st.open && !!item, st);
    if(!item) return;
    const list = await page.getAttribute("#menuPop .mi[data-addnote]", "data-addnote");
    await page.click("#menuPop .mi[data-addnote]");
    const note = await page.evaluate(list => {
      const a = document.activeElement, s = getSelection();
      const p = a && a.dataset && a.dataset.edit;
      return {path: p || null, want: list + "." + (getPath(list).length - 1), editable: !!(a && a.isContentEditable),
              value: p ? getPath(p) : undefined, caret: s.rangeCount > 0 && s.isCollapsed && !!a && a.contains(s.anchorNode),
              menuOpen: !document.getElementById("menuPop").classList.contains("hidden")};
    }, list);
    check("Add a note under … adds an empty note with the caret in it, and the menu closes",
          note.path === note.want && note.editable && note.value === "" && note.caret && !note.menuOpen, note);
    await page.keyboard.type("hello");
    check("…and typing goes into the note", await page.evaluate(p => document.querySelector(`[data-edit="${CSS.escape(p)}"]`).textContent, note.path) === "hello", {});
  });
}

async function moneyToolbar(){
  console.log("\nMoney — + Income is the one primary; ⋯ holds Splits, Buyout and Refresh");
  await onPage("#money", {ready: "#view [data-moneyact='new'][data-kind='income']"}, async page => {
    const st = await page.evaluate(() => {
      const bar = document.querySelector("#view .toolbar");
      return {primary: [...bar.querySelectorAll(".btn.primary")].filter(b => b.offsetParent).map(b => b.textContent.trim()),
              onBar: ["splits", "buyout", "reload"].filter(k => bar.querySelector(`[data-moneyact="${k}"]`))};
    });
    check("+ Income is the toolbar's only primary button", st.primary.join("|") === "+ Income", st);
    check("Splits, Buyout and Refresh aren't loose on the toolbar", st.onBar.length === 0, st);
    await page.click("#view .toolbar [data-menu][aria-label^='More']");
    const m = await menuState(page);
    check("⋯ opens Splits · Buyout · Refresh from the sheet", m.open && m.items.join(" | ") === "Splits | Buyout | Refresh from the sheet", m);
  });
}

async function drawerGuard(){
  console.log("\nThe drawer's dimmed page — closes an untouched drawer, shakes one you've typed in");
  await onPage("#money", {ready: "#view [data-moneyact='new'][data-kind='income']"}, async page => {
    const open = async () => {
      await page.click("#view [data-moneyact='new'][data-kind='income']");
      await page.waitForSelector("#adrawer.on #mfNote");
      await pause(page, 600);                                     // the sheet curve is 0.5 s
    };
    const dimmed = {x: 120, y: 420};                              // left of the 520px drawer
    const isOn = () => page.evaluate(() => document.getElementById("adrawer").classList.contains("on"));
    await open();
    await page.mouse.click(dimmed.x, dimmed.y);
    await pause(page, 100);
    check("clicking the dimmed page closes a drawer nothing was typed in", !(await isOn()), {});

    await open();
    await page.fill("#mfNote", "lunch with Ben");
    await page.evaluate(() => {
      window.__shook = false;
      new MutationObserver(() => { if(document.getElementById("adrawer").classList.contains("nope")) window.__shook = true; })
        .observe(document.getElementById("adrawer"), {attributes: true, attributeFilter: ["class"]});
    });
    await page.mouse.click(dimmed.x, dimmed.y);
    await pause(page, 100);
    const st = await page.evaluate(() => ({on: document.getElementById("adrawer").classList.contains("on"), shook: window.__shook,
      note: (document.getElementById("mfNote") || {}).value, toast: [...document.querySelectorAll("#toasts .toast")].map(t => t.textContent.trim())}));
    check("…but one you've typed in stays open, shakes, and keeps what you typed",
          st.on && st.shook && st.note === "lunch with Ben", st);
    check("…and the toast says why", st.toast.some(t => /changed something here/.test(t)), st);
  });
}

async function popoversSpring(){
  console.log("\nPopovers — spring out of what you clicked");
  /* what the transform transition is doing right after an open, against the --spring tokens */
  const sprung = (page, pop, from) => page.evaluate(([pop, from]) => {
    const el = document.querySelector(pop), r = document.querySelector(from).getBoundingClientRect();
    const probe = document.createElement("i");
    probe.style.cssText = "transition:transform var(--spring-dur) var(--spring)"; document.body.appendChild(probe);
    const want = {dur: parseFloat(getComputedStyle(probe).transitionDuration) * 1000, easing: getComputedStyle(probe).transitionTimingFunction};
    probe.remove();
    const a = el.getAnimations().find(x => x.transitionProperty === "transform");
    const left = parseFloat(el.style.left) || 0;
    return {running: !!a && a.playState === "running", dur: a && a.effect.getTiming().duration, easing: a && a.effect.getTiming().easing, want,
            originOff: Math.round(Math.abs(parseFloat(el.style.getPropertyValue("--pop-x")) - (r.left + r.width / 2 - left)))};
  }, [pop, from]);
  const ok = s => s.running && s.dur === s.want.dur && s.easing === s.want.easing && /^linear\(/.test(s.easing) && s.originOff <= 2;

  await onPage("#calendar", {ready: ".week"}, async page => {
    await page.click("#view [data-exportfor]");
    const s = await sprung(page, "#menuPop", "#view [data-exportfor]");
    check("a menu springs in (the --spring curve over --spring-dur) from the middle of its button", ok(s), s);
  });
  await onPage("#business", {ready: ".biz-row"}, async page => {
    const due = need("an Orders of Business due date", await page.$(".biz-row .due [data-datepick], .biz-row .due button"));
    const row = await due.evaluateHandle(b => b.closest(".biz-row"));
    await row.hover();
    await due.click();
    const id = await due.evaluate(b => { b.id = b.id || "dcDue"; return b.id; });
    const s = await sprung(page, "#datePop", "#" + id);
    check("the date picker springs in from the date you clicked", ok(s), s);
    await page.keyboard.press("Escape");
    const chip = need("an unset topic chip", await page.$(".biz-row .chip.bz.empty[data-bizpick='topic']"));
    await (await chip.evaluateHandle(c => c.closest(".biz-row"))).hover();
    await chip.click();
    const cid = await chip.evaluate(c => { c.id = "dcChip"; return c.id; });
    const t = await sprung(page, "#bizPop", "#" + cid);
    check("the topic picker springs in from its chip", ok(t), t);
  });
}

async function switchLook(){
  console.log("\nSwitches — the knob moves across when on (checked on a copy; no real switch is flipped)");
  await onPage("#team", {ready: ".sw-card .sw-toggle"}, async page => {
    const st = await page.evaluate(() => {
      const real = [...document.querySelectorAll(".sw-card .sw-toggle")];
      const before = real.map(b => b.className + "|" + b.getAttribute("aria-checked"));
      /* two inert copies, pointer-events off and no data-swkey, so nothing can reach the switch handler */
      const box = document.createElement("div");
      box.style.cssText = "position:fixed;left:0;top:0;pointer-events:none;z-index:-1";
      const [off, on] = [0, 1].map(() => { const c = real[0].cloneNode(true); c.removeAttribute("data-swkey"); c.classList.remove("on"); return c; });
      on.classList.add("on");
      box.append(off, on); document.body.appendChild(box);
      const look = el => {
        const k = el.querySelector(".sw-knob"), m = new DOMMatrix(getComputedStyle(k, "::after").transform);
        return {x: m.m41, track: getComputedStyle(k).backgroundColor, state: getComputedStyle(el.querySelector(".sw-state")).color};
      };
      const r = {off: look(off), on: look(on)};
      box.remove();
      return {...r, untouched: real.map(b => b.className + "|" + b.getAttribute("aria-checked")).join() === before.join(), before};
    });
    check("an ON switch's knob sits across (16px) and its track turns green", st.on.x - st.off.x >= 12 && st.on.track !== st.off.track, st);
    check("…and every real switch on the page is as it was", st.untouched, st.before);
  });
}

/* (runs in the page) a dozen assignments on the Assignments board, so it's wider than a phone or a
   600px page, plus the former mentees if asked. They live in the page only: nothing reaches the dev server. */
const dozenAssignments = async former => {
  while(!(ASSIGN.rows && TEAM.rows)) await new Promise(ok => setTimeout(ok, 50));   // a fresh dev server has none
  for(let i = 1; i <= 12; i++) ASSIGN.rows.assignments.push({AssignmentID: "DC" + i, Programs: "The Dojo, The Path, Masters",
    Campaign: ASSIGN.campaign, Title: "Design check " + i, Instructions: "", MaterialsURL: "", DueDate: "", Active: "Y"});
  if(former) UI.assignFormer = true;
  render();
};
/* keep a copy of the holder the next PNG is drawn from, as window.__holder */
const keepPngHolder = page => page.evaluate(() => {
  const real = XMLSerializer.prototype.serializeToString;
  XMLSerializer.prototype.serializeToString = function(node){
    if(node && node.classList && node.classList.contains("png-holder")) window.__holder = node.cloneNode(true);
    return real.call(this, node);
  };
});
/* (runs in the page) a call on every open week of Call Attendance, so the board is wider than the page.
   In the page only, like the assignments above. */
const callEveryWeek = () => {
  DATA.calendar.forEach((r, i) => { if(!isPlanned(r) && !isOff(r) && !isBlocked(r)) r.topic = "Practice topic " + i; });
  render();
};
/* the keyboard along a run of controls (a row's squares, the roll-call headings) on a board whose names are
   frozen. The focus starts on the run's first control with the board unscrolled, or on its last with the board
   at the far end; then `key` is pressed once per control, the last press stepping off the run onto the next
   (or with onward false, once fewer, staying on it). After each press: where the focus is, how far it sits
   under the frozen names (under) and past the board's right edge (past), both below 0 when it's clear. */
const keySweep = async (page, {board, rows, row, ctl, key, from, onward = true}) => {
  const n = await page.evaluate(([board, rows, row, ctl, from]) => {
    const t = document.querySelector(board), run = [...t.querySelectorAll(rows)[row].querySelectorAll(ctl)];
    t.scrollLeft = from === "end" ? t.scrollWidth : 0; (from === "end" ? run[run.length - 1] : run[0]).focus();
    return run.length;
  }, [board, rows, row, ctl, from]), out = [];
  for(let i = 0; i < (onward ? n : n - 1); i++){
    await page.keyboard.press(key);
    out.push(await page.evaluate(board => {
      const t = document.querySelector(board), a = document.activeElement, r = a.getBoundingClientRect();
      return {at: t.contains(a) ? a.dataset.rollopen || a.title.split(" · ").slice(0, 2).join(" · ") : "off the board, on " + a.tagName,
              on: t.contains(a), under: Math.round(t.querySelector("th.mentee").getBoundingClientRect().right - r.left),
              past: Math.round(r.right - t.getBoundingClientRect().right)};
    }, board));
  }
  return out;
};
const clearOf = s => s.on && s.under < 0 && s.past < 0;

async function stickyGroupLabels(){
  console.log("\nGroup labels — stay in view when a board is scrolled sideways, and in print and the PNG");
  /* every group label's text, relative to its board's visible box: in view, and where it sits unscrolled */
  const labels = page => page.evaluate(() => {
    const t = document.querySelector("#view .tbl"), box = t.getBoundingClientRect();
    return {scrolls: t.scrollWidth > t.clientWidth + 20, at: Math.round(t.scrollLeft),
            rows: [...t.querySelectorAll("tr.grp td, tr.agrp td")].map(td => {
              const g = td.querySelector(".glab"), r = (g || td).getBoundingClientRect();
              return {text: td.textContent.trim(), wrapped: !!g, inView: !!g && r.width > 0 && r.left >= box.left - 1 && r.right <= box.right + 1,
                      fromEdge: Math.round(r.left - box.left)};
            })};
  });
  const scrollTo = (page, where) => page.evaluate(w => { const t = document.querySelector("#view .tbl"); t.scrollLeft = w === "end" ? t.scrollWidth : 0; }, where);
  const rows = "#view .tbl table tr.grp, #view .tbl table tr.agrp";
  const boards = [
    ["Weekly Check-ins", "#checkins", 1000, rows, null],
    ["Call Attendance", "#attend", 1000, rows, callEveryWeek],
    ["Assignments", "#assign", 600, "#view .toolbar", dozenAssignments],
  ];
  for(const [name, hash, width, ready, widen] of boards){
    await onPage(hash, {width, ready}, async page => {
      if(widen) await page.evaluate(widen);
      await page.waitForSelector(rows).catch(() => { throw new Missing(`${name} never showed a group row`); });
      const home = await labels(page);
      await scrollTo(page, "end");
      const far = await labels(page);
      if(!far.scrolls) throw new Missing(`${name} isn't wider than a ${width}px page, so there's no sideways scroll to check`);
      check(`${name}: scrolled to the far end, every group label is still in view`,
            far.at > 0 && far.rows.length > 0 && far.rows.every(r => r.inView), far);
      check(`${name}: …and unscrolled, each sits where it always did (14px in)`, home.rows.every(r => r.fromEdge === 14), home);
    });
  }

  await onPage("#checkins", {width: 1000, ready: "#view .tbl table tr.grp"}, async page => {
    await scrollTo(page, "end");
    await page.emulateMedia({media: "print"});
    const pr = await page.evaluate(() => [...document.querySelectorAll("#ciBoard tr.grp td")].map(td => {
      const g = td.querySelector(".glab");
      if(!g) return {text: td.textContent, wrapped: false};
      const a = td.getBoundingClientRect(), b = g.getBoundingClientRect();
      return {text: g.textContent, pos: getComputedStyle(g).position, inCell: b.width > 0 && b.left >= a.left && b.right <= a.right, fromCell: Math.round(b.left - a.left)};
    }));
    check("in print, each label is in its band at the left, whatever the screen was scrolled to",
          pr.length > 0 && pr.every(r => r.pos === "static" && r.inCell && r.fromCell <= 20), pr);
    await page.emulateMedia({media: "screen"});

    /* keep a copy of the holder the PNG is drawn from, then look at its labels */
    await keepPngHolder(page);
    await page.click("#view [data-exportfor]");
    const dl = need("a PNG from the check-ins board's Export", await download(page, () => page.click("#menuPop .mi[data-png]")));
    const png = fs.readFileSync(await dl.path());
    const st = await page.evaluate(() => {
      const h = window.__holder, wrap = document.createElement("div");
      wrap.style.cssText = "position:absolute;left:0;top:0;z-index:9999";
      wrap.appendChild(h); document.body.appendChild(wrap);
      const rows = [...h.querySelectorAll("tr.grp td")].map(td => {
        const g = td.querySelector(".glab");
        if(!g) return {text: td.textContent, wrapped: false};
        const a = td.getBoundingClientRect(), b = g.getBoundingClientRect();
        return {text: g.textContent, fromCell: Math.round(b.left - a.left), shown: b.width > 0 && getComputedStyle(g).visibility === "visible"};
      });
      const board = h.querySelector(".tbl table").getBoundingClientRect().width;
      wrap.remove();
      return {rows, board: Math.round(board), screen: document.querySelector("#ciBoard .tbl").scrollWidth};
    });
    const pngWidth = png.readUInt32BE(16) / 2 - 56;                // drawn at 2x, with 28px either side
    check("the PNG is the whole board's width, not the slice on screen", pngWidth >= st.screen, {pngWidth, ...st});
    check("…and each group label is in it, at the left of its band", st.rows.length > 0 && st.rows.every(r => r.shown && r.fromCell === 14), st.rows);
  });
}

async function frozenNames(){
  console.log("\nAssignments — the name column stays put when the board scrolls sideways (on screen only)");
  /* the header's and every row's name cell against the board's visible box, and what's drawn on top
     of each (elementFromPoint): the name, not a square scrolled under it; the same for the group labels */
  const names = page => page.evaluate(() => {
    const t = document.querySelector("#assignBoard .tbl"), box = t.getBoundingClientRect();
    const onTop = (el, r) => { const hit = document.elementFromPoint(r.left + 4, r.top + r.height / 2); return !!hit && el.contains(hit); };
    return {scrolls: t.scrollWidth > t.clientWidth + 20, at: Math.round(t.scrollLeft), below: box.bottom > innerHeight, head: !!t.querySelector("th.mentee"),
            cells: [t.querySelector("th.mentee"), ...t.querySelectorAll("td.an")].filter(Boolean).map(c => { const r = c.getBoundingClientRect();
              return {text: c.textContent.trim(), fromEdge: Math.round(r.left - box.left), inView: r.width > 0 && r.left >= box.left - 1 && r.right <= box.right + 1,
                      onTop: onTop(c, r), former: c.parentElement.style.opacity !== ""}; }),
            labels: [...t.querySelectorAll("tr.agrp .glab")].map(g => { const r = g.getBoundingClientRect();
              return {text: g.textContent.trim(), fromEdge: Math.round(r.left - box.left), onTop: onTop(g, r)}; })};
  });
  const toEnd = page => page.evaluate(() => { const t = document.querySelector("#assignBoard .tbl"); t.scrollLeft = t.scrollWidth; });
  const ready = "#assignBoard .tbl table.aboard tr.agrp";
  for(const width of [390, 600]){
    await onPage("#assign", {width, height: 1800, ready: "#view .toolbar"}, async page => {
      await page.evaluate(dozenAssignments, true);
      await page.waitForSelector(ready);
      await toEnd(page);
      const far = await names(page);
      if(!far.scrolls) throw new Missing(`Assignments isn't wider than a ${width}px page, so there's no sideways scroll to check`);
      if(far.below) throw new Missing(`the Assignments board runs past the bottom of a ${width}x1800 page`);
      check(`${width}px, scrolled to the far end: every name, and the Mentee heading, is still in view at the left edge`,
            far.head && far.at > 0 && far.cells.length > 1 && far.cells.every(c => c.inView && c.fromEdge === 0), {head: far.head, out: far.cells.filter(c => !c.inView || c.fromEdge)});
      check(`…drawn over the squares that scrolled under it, a former mentee's faded row too`,
            far.cells.some(c => c.former) && far.cells.every(c => c.onTop), far.cells.filter(c => !c.onTop));
      check(`…and the group labels sit over it, lined up with the names (14px in)`,
            far.labels.length > 0 && far.labels.every(l => l.onTop && l.fromEdge === 14), far.labels);
    });
  }

  await onPage("#assign", {width: 390, height: 1800, ready: "#view .toolbar"}, async page => {
    await page.evaluate(dozenAssignments, true);
    await page.waitForSelector(ready);
    /* a row under the pointer: its band runs under its frozen name; the others' names stay on the card */
    await page.evaluate(() => { const t = document.querySelector("#assignBoard .tbl"); t.scrollLeft = (t.scrollWidth - t.clientWidth) / 2; });
    const fills = () => page.evaluate(() => {
      const t = document.querySelector("#assignBoard .tbl"), rows = [...t.querySelectorAll("tbody tr:not(.agrp)")];
      const bg = el => getComputedStyle(el).backgroundColor;
      return {card: bg(t), rows: rows.map(tr => ({name: tr.querySelector("td.an b").textContent, hovered: tr.matches(":hover"), row: bg(tr), an: bg(tr.querySelector("td.an"))}))};
    });
    const tbl = await page.locator("#assignBoard .tbl").boundingBox(), row = await page.locator("#assignBoard tbody tr:not(.agrp)").nth(2).boundingBox();
    await page.mouse.move(tbl.x + tbl.width - 30, row.y + row.height / 2);
    await pause(page, 300);                                              // the row's fill eases in over .12 s
    const light = await fills(page), hov = light.rows.filter(r => r.hovered);
    check("a hovered row's band runs under its frozen name, and the other names stay on the card",
          hov.length === 1 && hov[0].an === hov[0].row && hov[0].an !== light.card && light.rows.every(r => r.hovered || r.an === light.card), light);
    await page.mouse.move(0, 0);
    await page.emulateMedia({colorScheme: "dark"});
    const dark = await fills(page);
    check("in dark mode the frozen column is the dark card, not a light patch", dark.card !== light.card && dark.rows.every(r => r.an === dark.card), dark);
    await page.emulateMedia({colorScheme: "light"});

    /* the keyboard: Shift+Tab from the far end along a row, then Tab along the next and round
       onto the one after. Each square it lands on is clear of the column and of the right edge. */
    const sq = {board: "#assignBoard .tbl", rows: "tbody tr:not(.agrp)", ctl: "button.sq"};
    const back = await keySweep(page, {...sq, row: 1, key: "Shift+Tab", from: "end"}), fwd = await keySweep(page, {...sq, row: 2, key: "Tab", from: "start"});
    check("Shift+Tab along a row from the far end: every square it lands on is clear of the frozen names",
          back.length > 6 && back.every(clearOf), back.filter(s => !clearOf(s)));
    check("…and Tab along a row and round onto the next one: the same, at the right edge too",
          fwd.length > 6 && fwd.every(clearOf), fwd.filter(s => !clearOf(s)));

    /* a click on a square half under the column opens it where it is: the board doesn't slide under the pointer */
    const half = await page.evaluate(() => {
      const t = document.querySelector("#assignBoard .tbl"), sq = t.querySelectorAll("tbody tr:not(.agrp)")[0].querySelectorAll("button.sq")[3];
      t.scrollLeft += sq.getBoundingClientRect().left - sq.closest("tr").querySelector("td.an").getBoundingClientRect().right + 12;
      const r = sq.getBoundingClientRect();
      return {at: t.scrollLeft, x: r.right - 5, y: r.top + r.height / 2, cell: sq.dataset.cell};
    });
    await page.mouse.click(half.x, half.y);
    const opened = await page.evaluate(() => ({at: document.querySelector("#assignBoard .tbl").scrollLeft, open: ASSIGN.open && ASSIGN.open.repId + "|" + ASSIGN.open.aId}));
    check("a click on a square half under the column opens that square, and the board stays where it was",
          opened.at === half.at && opened.open === half.cell, {half, opened});
  });

  await onPage("#assign", {width: 600, ready: "#view .toolbar"}, async page => {
    await page.evaluate(dozenAssignments, true);
    await page.waitForSelector(ready);
    await toEnd(page);
    /* paper doesn't scroll: the column is a plain one there (no hold, no divider, no fill), as it always was */
    const plain = sel => page.evaluate(sel => [...document.querySelectorAll(sel)].map(c => {
      const s = getComputedStyle(c), r = c.getBoundingClientRect(), tb = c.closest("table").getBoundingClientRect();
      return {text: c.textContent.trim(), pos: s.position, shadow: s.boxShadow, fill: s.backgroundColor, fromTable: Math.round(r.left - tb.left)};
    }), sel);
    const isPlain = cells => cells.length > 1 && cells.every(c => c.pos === "static" && c.shadow === "none" && c.fill === "rgba(0, 0, 0, 0)" && c.fromTable === 0);
    await page.emulateMedia({media: "print"});
    const pr = await plain("#assignBoard th.mentee, #assignBoard td.an");
    check("in print the name column is a plain column again, at the board's left, whatever the screen was scrolled to", isPlain(pr), pr);
    await page.emulateMedia({media: "screen"});

    await keepPngHolder(page);
    await page.click("#view [data-exportfor]");
    const dl = need("a PNG from the Assignments board's Export", await download(page, () => page.click("#menuPop .mi[data-png]")));
    const png = fs.readFileSync(await dl.path());
    const st = await page.evaluate(() => {
      const wrap = document.createElement("div");
      wrap.style.cssText = "position:absolute;left:0;top:0;z-index:9999";
      wrap.appendChild(window.__holder); document.body.appendChild(wrap);
      wrap.id = "pngHeld";
      return {screen: document.querySelector("#assignBoard .tbl").scrollWidth};
    });
    const held = await plain("#pngHeld th.mentee, #pngHeld td.an");
    await page.evaluate(() => document.getElementById("pngHeld").remove());
    const pngWidth = png.readUInt32BE(16) / 2 - 56;                // drawn at 2x, with 28px either side
    check("the PNG is the whole board's width, not the slice on screen", pngWidth >= st.screen, {pngWidth, ...st});
    check("…and its name column is the plain one, at the board's left", isPlain(held), held);
  });
}

async function frozenNamesKeyboard(){
  console.log("\nWeekly Check-ins and Call Attendance — what the keyboard lands on is never under the frozen names");
  const boards = [{name: "Weekly Check-ins", hash: "#checkins", board: "#ciBoard .tbl", widen: null},
                  {name: "Call Attendance", hash: "#attend", board: "#atBoard .tbl", widen: callEveryWeek, heads: true}];
  const onBoard = (b, width, fn) => onPage(b.hash, {width, height: 1800, ready: "#view .tbl table tr.grp"}, async page => {
    if(b.widen) await page.evaluate(b.widen);
    const st = await page.evaluate(board => { const t = document.querySelector(board);
      return {scrolls: !!t && t.scrollWidth > t.clientWidth + 20, below: !!t && t.getBoundingClientRect().bottom > innerHeight}; }, b.board);
    if(!st.scrolls) throw new Missing(`${b.name} isn't wider than a ${width}px page, so there's no sideways scroll to check`);
    if(st.below) throw new Missing(`the ${b.name} board runs past the bottom of a ${width}x1800 page`);
    await fn(page);
  });
  const squares = b => ({board: b.board, rows: "tbody tr:not(.grp)", ctl: "button.ci"});

  /* Shift+Tab from the far end along a row, Tab along the next and round onto the one after, at a phone's
     width and a laptop's; on Call Attendance, Tab and Shift+Tab across the roll-call headings too */
  for(const b of boards){
    const back = [], fwd = [], heads = [];
    for(const width of [390, 1000]) await onBoard(b, width, async page => {
      const w = s => ({width, ...s});
      back.push(...(await keySweep(page, {...squares(b), row: 1, key: "Shift+Tab", from: "end"})).map(w));
      fwd.push(...(await keySweep(page, {...squares(b), row: 2, key: "Tab", from: "start"})).map(w));
      if(b.heads){
        const hd = {board: b.board, rows: "thead tr", row: 0, ctl: "button.rollhd"};
        heads.push(...(await keySweep(page, {...hd, key: "Tab", from: "start"})).map(w),
                   ...(await keySweep(page, {...hd, key: "Shift+Tab", from: "end", onward: false})).map(w));
      }
    });
    check(`${b.name} (390 and 1000px): Shift+Tab along a row from the far end, every square it lands on is clear of the frozen names`,
          back.length > 20 && back.every(clearOf), back.filter(s => !clearOf(s)));
    check("…and Tab along a row and round onto the next one: the same, at the right edge too",
          fwd.length > 20 && fwd.every(clearOf), fwd.filter(s => !clearOf(s)));
    if(b.heads) check("…and Tab and Shift+Tab across the roll-call headings (and on to the first square): the same",
                      heads.length > 10 && heads.every(clearOf), heads.filter(s => !clearOf(s)));
  }

  /* (in the page) scroll the board so a row's square sits px under the frozen names. With focusNext, the focus
     goes on the square after it, for a Shift+Tab onto it. Its id, and a point on the part still showing. */
  const tuck = (page, b, row, i, px, focusNext) => page.evaluate(([board, row, i, px, focusNext]) => {
    const t = document.querySelector(board), run = t.querySelectorAll("tbody tr:not(.grp)")[row].querySelectorAll("button.ci"), sq = run[i];
    t.scrollLeft += sq.getBoundingClientRect().left - t.querySelector("th.mentee").getBoundingClientRect().right + px;
    if(focusNext) run[i + 1].focus();
    const r = sq.getBoundingClientRect();
    return {at: t.scrollLeft, id: sq.dataset.ci || sq.dataset.atcell, under: Math.round(t.querySelector("th.mentee").getBoundingClientRect().right - r.left),
            x: r.right - 5, y: r.top + r.height / 2};
  }, [b.board, row, i, px, focusNext]);
  /* (in the page) once the board's scroll events have run: where it is, what has the focus and where the square
     `id` sits, whether the Check-ins popover or the Attendance roll is open on it, and whether "Showing Wk a–b"
     is current */
  const now = (page, b, id) => page.evaluate(async ([board, id]) => {
    for(let i = 0; i < 2; i++) await new Promise(ok => requestAnimationFrame(ok));
    await new Promise(ok => setTimeout(ok, 120));                    // openRoll finds the mentee's line 60 ms in
    const t = document.querySelector(board), a = document.activeElement, names = t.querySelector("th.mentee").getBoundingClientRect();
    const sq = [...t.querySelectorAll("button.ci")].find(s => (s.dataset.ci || s.dataset.atcell) === id), r = sq.getBoundingClientRect();
    const p = document.getElementById("ciPop"), pl = parseFloat(p.style.left), pt = parseFloat(p.style.top), cap = document.getElementById("ciScroll");
    const hint = cap && cap.textContent;
    if(cap) ciScrollHint();
    return {at: t.scrollLeft, focused: a === sq, under: Math.round(names.right - r.left), past: Math.round(r.right - t.getBoundingClientRect().right),
            hint, hintCurrent: !cap || cap.textContent === hint,
            pop: CI_OPEN && [CI_OPEN.camp, CI_OPEN.rep, CI_OPEN.week].join("|"),           // the popover's laid-out box, not its spring
            popBy: !p.classList.contains("hidden") && (Math.abs(pt - r.bottom - 8) < 2 || Math.abs(r.top - pt - p.offsetHeight - 8) < 2)
                   && pl <= r.left + r.width / 2 && r.left + r.width / 2 <= pl + p.offsetWidth,
            roll: AT.open};
  }, [b.board, id]);

  await onBoard(boards[0], 390, async page => {
    const sq = await tuck(page, boards[0], 0, 5, 12, true);
    await page.keyboard.press("Shift+Tab");
    const onto = await now(page, boards[0], sq.id);
    check("Weekly Check-ins: Shift+Tab onto a square half under the names brings it out, and \"Showing Wk a–b\" under the board catches up",
          sq.under === 12 && onto.focused && clearOf({on: true, ...onto}) && onto.at < sq.at && onto.hintCurrent && /^Showing Wk/.test(onto.hint),
          {sq, onto});
    await page.keyboard.press("Enter");
    const opened = await now(page, boards[0], sq.id);
    check("…Enter on it opens its popover right by it, and the board doesn't move",
          opened.pop === sq.id && opened.popBy && opened.at === onto.at, {sq, onto, opened});
    await page.keyboard.press("Escape");
    const half = await tuck(page, boards[0], 0, 3, 12, false);
    await page.mouse.click(half.x, half.y);
    const clicked = await now(page, boards[0], half.id);
    check("a click on a square half under the names opens its popover there, and the board stays where it was",
          half.under === 12 && clicked.pop === half.id && clicked.popBy && clicked.at === half.at, {half, clicked});
  });

  await onBoard(boards[1], 390, async page => {
    const sq = await tuck(page, boards[1], 0, 4, 12, true), call = id => String(id).split("|")[0];
    await page.keyboard.press("Shift+Tab");
    const onto = await now(page, boards[1], sq.id);
    await page.keyboard.press("Enter");
    const opened = await now(page, boards[1], sq.id);
    check("Call Attendance: Enter on a square the keyboard brought out from under the names opens that call's roll, and the board doesn't move",
          sq.under === 12 && onto.focused && clearOf({on: true, ...onto}) && onto.at < sq.at && opened.roll === call(sq.id) && opened.at === onto.at,
          {sq, onto, opened});
    await page.keyboard.press("Escape");
    await pause(page, 400);                                          // the dimmed page fades out
    const half = await tuck(page, boards[1], 0, 2, 12, false);
    await page.mouse.click(half.x, half.y);
    const clicked = await now(page, boards[1], half.id);
    check("…a click on a square half under the names opens that call's roll, and the board stays where it was",
          half.under === 12 && clicked.roll === call(half.id) && clicked.at === half.at, {half, clicked});
  });
}

async function calendarPrint(){
  console.log("\nPrinting the calendar — seasons run on across pages; no split week, no stranded heading");
  await onPage("#calendar", {ready: ".week"}, async page => {
    await page.emulateMedia({media: "print"});
    const css = await page.evaluate(() => {
      const s = document.querySelector(".season"), w = document.querySelector(".season .week"), h = document.querySelector(".season-head");
      return {season: getComputedStyle(s).breakInside, week: getComputedStyle(w).breakInside, headAfter: getComputedStyle(h).breakAfter};
    });
    check("in print a season may break, a week may not, and a season's heading stays with its first week",
          css.season === "auto" && css.week === "avoid" && css.headAfter === "avoid", css);
    await page.emulateMedia({media: "screen"});

    /* the real Print path, with window.print held so the PDF sees the page as the print dialog would */
    await page.evaluate(() => {
      window.__prints = 0;
      window.print = () => { window.__prints++; const s = document.getElementById("printOnly").cloneNode(true); s.id = "printHeld"; document.head.appendChild(s); };
    });
    await page.click("#view [data-exportfor]"); await page.click("#menuPop .mi[data-print]");
    if(await prints(page) !== 1) throw new Missing("Print didn't reach window.print");
    await page.evaluate(() => document.body.classList.add("exporting"));
    await page.emulateMedia({media: "print"});
    const now = pdfPages(await page.pdf({preferCSSPageSize: true, printBackground: true}));
    await page.addStyleTag({content: "@media print{.season{break-inside:avoid!important}}"});
    const held = pdfPages(await page.pdf({preferCSSPageSize: true, printBackground: true}));
    check(`the calendar prints on fewer pages than with each season held together (${now} vs ${held})`, now > 0 && now < held, {now, held});
  });
}

async function bizPlaceholders(){
  console.log("\nOrders of Business — unset chips and + note wait for the row to be hovered or focused");
  const state = page => page.evaluate(() => [...document.querySelectorAll(".biz-row")].map((row, i) => ({i,
    ph: [...row.querySelectorAll(".chip.bz.empty, .biz-note [data-ph]")].map(e => Number(getComputedStyle(e).opacity)),
    set: [...row.querySelectorAll(".chip.bz:not(.empty), .biz-note [data-edit]:not([data-ph])")].map(e => Number(getComputedStyle(e).opacity))})));
  const rowWith = rows => rows.findIndex(r => r.ph.length >= 2);

  await onPage("#business", {ready: ".biz-row"}, async page => {
    await page.mouse.move(5, 5);
    await pause(page, 300);
    const rows = await state(page);
    const k = rowWith(rows);
    if(k < 0) throw new Missing("a row with unset chips");
    const n = rows.reduce((s, r) => s + r.ph.length, 0);
    check(`nothing hovered: none of the ${n} placeholders show`, n > 0 && rows.every(r => r.ph.every(o => o === 0)), rows.filter(r => r.ph.some(o => o)));
    check("…and every set chip and note does", rows.every(r => r.set.every(o => o === 1)), rows.filter(r => r.set.some(o => o !== 1)));

    const row = page.locator(".biz-row").nth(k);
    await row.scrollIntoViewIfNeeded();
    await row.locator(".biz-t").hover();
    await pause(page, 50);
    const hov = await state(page);
    check("hover a row: its placeholders show, and only its", hov[k].ph.every(o => o === 1) && hov.every((r, i) => i === k || r.ph.every(o => o === 0)),
          {row: hov[k], others: hov.filter((r, i) => i !== k && r.ph.some(o => o)).length});

    await page.mouse.move(5, 5);
    await page.locator(".biz-row").nth(k).locator(".tick").focus();
    await pause(page, 300);
    const foc = await state(page);
    check("tab into a row (focus, no pointer): its placeholders show", foc[k].ph.every(o => o === 1), foc[k]);

    await page.evaluate(() => document.activeElement.blur());
    await row.locator(".biz-t").hover();
    await row.locator(".chip.bz.empty[data-bizpick='topic']").click();
    await page.mouse.move(5, 5);                                  // pointer off the row, focus in the picker's box
    await pause(page, 300);
    const pick = await state(page);
    check("while a row's topic picker is open its placeholders stay, pointer or no", pick[k].ph.every(o => o === 1), pick[k]);
    await page.keyboard.press("Escape");
    await pause(page, 300);
    check("…and go once it's closed", (await state(page))[k].ph.every(o => o === 0), (await state(page))[k]);
  });

  await onPage("#business", {width: 390, height: 800, touch: true, ready: ".biz-row"}, async page => {
    const rows = await state(page);
    check("on a touch screen (no hover) they all show", rows.length > 0 && rows.every(r => r.ph.every(o => o === 1)),
          rows.filter(r => r.ph.some(o => o !== 1)).slice(0, 3));
  });
}

(async () => {
  const {pw, from} = loadPlaywright();
  if(process.env.BASE) await mustBeDevServer(process.env.BASE);
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
  console.log(`design-check · ${channel ? "Google Chrome" : "Chromium"} ${browser.version()}` +
              `${args.has("--headed") ? ", headed" : ""} · ${BASE} · Playwright from ${from}`);
  let code = 0;
  try{
    await exportMenu();
    await menusFromTheKeyboard();
    await editAddMenu();
    await moneyToolbar();
    await drawerGuard();
    await popoversSpring();
    await switchLook();
    await stickyGroupLabels();
    await frozenNames();
    await frozenNamesKeyboard();
    await calendarPrint();
    await bizPlaceholders();
    console.log("\nScript errors");
    check("no page threw an error along the way", pageErrors.length === 0, pageErrors);
    const failed = results.filter(ok => !ok).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    code = failed ? 1 : 0;
  }catch(e){
    console.error("\ndesign-check: stopped — " + (e instanceof Missing ? e.message : e.stack));
    code = 2;
  }finally{
    await browser.close();
    if(server) server.stop();
  }
  process.exit(code);
})();

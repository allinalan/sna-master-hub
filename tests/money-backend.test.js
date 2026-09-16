// node tests/money-backend.test.js
// SNA-Money.gs on in-memory Apps Script fakes: the key gates, what an entry
// must look like, creates that can be retried without doubling up, updates
// that notice the other person got there first, void and restore, the History
// tab, the test book, receipts, and the guards against Sheets' own parsing.
// Design: docs/superpowers/specs/2026-09-16-money-tab-design.md
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {makeGas, loadGs} = require("./gas-fakes.js");

const GS = path.join(__dirname, "..", "SNA-Money.gs");
const KEY = "test-key";
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const OTHER = Buffer.from("a different receipt, same name").toString("base64");

function setup(opts){
  const gas = makeGas(Object.assign({props:{MONEY_KEY:KEY}}, opts || {}));
  const api = loadGs(GS, gas.globals);
  const call = (action, extra) => api.call(Object.assign({key:KEY, book:"live", action}, extra || {}));
  const ss = () => [...gas.state.spreadsheets.values()][0] || null;
  const tab = name => (ss() ? ss().getSheetByName(name) : null);
  return {gas, api, call, ss, tab};
}
const income = over => Object.assign({id:"mtest0001", kind:"income", date:"2026-09-16", campaign:"Fall 2026",
  who:"Ben", party:"Jordan Sample", repId:"t01", plan:"flat", amount:250, benPct:60, note:""}, over || {});
const expense = over => Object.assign({id:"mtest0002", kind:"expense", date:"2026-09-17", campaign:"Fall 2026",
  who:"Alan", party:"Zoom", category:"Software", amount:"15.99", benPct:60, note:""}, over || {});
const settle = over => Object.assign({id:"mtest0003", kind:"settle", date:"2026-12-31", campaign:"Fall 2026",
  who:"Ben", to:"Alan", amount:100, note:""}, over || {});
const historyActions = t => { const h = t.tab("History"); if(!h) return []; return h.getRange(2, 4, Math.max(h.getLastRow() - 1, 1), 1).getValues().map(r => r[0]).filter(Boolean); };

const cases = [
  ["GET is a liveness check with no data", () => {
    assert.deepStrictEqual(setup().api.get(), {ok:true, service:"SNA Money", version:1});
  }],
  ["without MONEY_KEY every call says the key isn't set", () => {
    const t = setup({props:{}});
    assert.deepStrictEqual(t.call("list"), {ok:false, error:"key not set"});
  }],
  ["a wrong, missing or non-string key is refused", () => {
    const t = setup();
    assert.deepStrictEqual(t.api.call({key:"nope", book:"live", action:"list"}), {ok:false, error:"bad key"});
    assert.deepStrictEqual(t.api.call({book:"live", action:"list"}), {ok:false, error:"bad key"});
    assert.deepStrictEqual(t.api.call({key:12345, book:"live", action:"list"}), {ok:false, error:"bad key"});
  }],
  ["the book has to be named live or test", () => {
    const t = setup();
    assert.deepStrictEqual(t.api.call({key:KEY, action:"list"}), {ok:false, error:"book must be live or test"});
    assert.deepStrictEqual(t.api.call({key:KEY, book:"constructor", action:"list"}), {ok:false, error:"book must be live or test"});
  }],
  ["an unknown action is refused", () => {
    assert.deepStrictEqual(setup().call("delete"), {ok:false, error:"unknown action"});
  }],
  ["a body that isn't JSON is an error, not a crash", () => {
    const t = setup();
    const out = JSON.parse(t.api.doPost({postData:{contents:"<html>"}}).getContent());
    assert.strictEqual(out.ok, false); assert.ok(out.error);
  }],
  ["reading before anything is written creates nothing", () => {
    const t = setup();
    assert.deepStrictEqual(t.call("list"), {ok:true, entries:[], problems:[], sheetUrl:""});
    assert.strictEqual(t.gas.state.spreadsheets.size, 0);
  }],
  ["a save has to be signed Alan or Ben", () => {
    const t = setup();
    assert.match(t.call("save", {entry:income()}).error, /who are you/);
    assert.match(t.call("save", {by:"Carl", entry:income()}).error, /who are you/);
    assert.strictEqual(t.gas.state.spreadsheets.size, 0);
  }],
  ["a flat income entry saves, creates the sheet, and lists back", () => {
    const t = setup();
    const r = t.call("save", {by:"ben", entry:income()});
    assert.strictEqual(r.ok, true);
    const e = r.entry;
    assert.deepStrictEqual([e.status, e.rev, e.createdBy, e.updatedBy, e.amount, e.benPct, e.plan, e.rate, e.base, e.to, e.category],
                           ["live", 1, "Ben", "Ben", 250, 60, "flat", null, null, "", ""]);
    assert.match(e.createdAt, /^\d{4}-\d{2}-\d{2}T/);
    const list = t.call("list");
    assert.deepStrictEqual(list.entries, [e]);
    assert.deepStrictEqual(list.problems, []);
    assert.match(list.sheetUrl, /^https:\/\/docs\.google\.com\/spreadsheets\/d\//);
    assert.strictEqual(t.ss().getName(), "SNA Money");
    assert.strictEqual(t.tab("Ledger").getLastRow(), 2);
    assert.strictEqual(t.tab("Ledger").frozen, 1);
  }],
  ["a % entry's amount is worked out by the script, not taken from the page", () => {
    const r = setup().call("save", {by:"Alan", entry:income({plan:"pct", base:"12,345.67", rate:8, amount:1})});
    assert.strictEqual(r.ok, true);
    assert.deepStrictEqual([r.entry.amount, r.entry.base, r.entry.rate], [987.65, 12345.67, 8]);
  }],
  ["validation says what's wrong, and writes nothing", () => {
    const t = setup();
    const bad = [
      [income({id:"x"}), "the entry's ID is missing or malformed"],
      [income({kind:"refund"}), "Kind must be income, expense or settle"],
      [income({date:"2026-02-30"}), "Date must be a real day, written YYYY-MM-DD"],
      [income({campaign:"Autumn 2026"}), 'Campaign must look like "Fall 2026"'],
      [income({who:"Carl"}), "Received by must be Alan or Ben"],
      [expense({who:""}), "Paid by must be Alan or Ben"],
      [settle({who:"Ben", to:"Ben"}), "A settle-up goes from one of you to the other"],
      [income({amount:0}), "Amount must be more than $0.00"],
      [income({amount:"abc"}), "Amount must be a number"],
      [income({amount:-5}), "Amount must be more than $0.00"],
      [income({amount:1000000.01}), "Amount can't be more than $1,000,000"],
      [income({party:" "}), "Say who paid"],
      [expense({party:""}), "Say what the expense was for"],
      [expense({benPct:101}), "Ben's share must be from 0 to 100%"],
      [expense({benPct:""}), "Ben's share must be from 0 to 100%"],
      [income({plan:"monthly"}), "Plan must be % of commission sales or flat"],
      [income({plan:"pct", base:"", rate:8}), "Commission sales must be a number"],
      [income({plan:"pct", base:1000, rate:0}), "The rate must be more than 0% and no more than 100%"],
      [income({plan:"pct", base:1000, rate:101}), "The rate must be more than 0% and no more than 100%"],
      [income({plan:"pct", base:0.01, rate:1}), "That works out to $0.00"],
      [income({repId:"t 01"}), "the mentee's RepID is malformed"],
    ];
    for(const [entry, want] of bad) assert.deepStrictEqual(t.call("save", {by:"Alan", entry}), {ok:false, error:want}, JSON.stringify(entry));
    assert.strictEqual(t.gas.state.spreadsheets.size, 0);
  }],
  ["the hub's checks say exactly what the script says", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
    const m = src.match(/\/\*MONEY_MATH_BEGIN\*\/([\s\S]*?)\/\*MONEY_MATH_END\*\//);
    assert.ok(m, "no MONEY_MATH block in index.html");
    const {mCheck} = new Function(m[1] + "\n;return {mCheck};")();
    const t = setup();
    const samples = [income({date:"2026-02-30"}), income({campaign:"Autumn 2026"}), income({who:"Carl"}), expense({who:""}),
      settle({to:"Ben"}), income({amount:0}), income({amount:"abc"}), income({amount:"1000000.01"}), income({party:""}),
      expense({party:""}), expense({benPct:"101"}), income({plan:"monthly"}), income({plan:"pct", base:"", rate:"8"}),
      income({plan:"pct", base:"20000000", rate:"8"}), income({plan:"pct", base:"1000", rate:"0"}), income({plan:"pct", base:"0.01", rate:"1"}),
      settle({amount:"x"}), income(), expense(), settle(), income({id:"mtest0101", plan:"pct", base:"12345.67", rate:"8"})];
    for(const e of samples){
      const script = t.call("save", {by:"Alan", entry:e});
      assert.strictEqual(mCheck(e), script.ok ? "" : script.error, JSON.stringify(e));
    }
  }],
  ["a retried create doesn't double up", () => {
    const t = setup();
    const a = t.call("save", {by:"Ben", entry:income()}), b = t.call("save", {by:"Ben", entry:income()});
    assert.strictEqual(b.ok, true); assert.deepStrictEqual(b.entry, a.entry);
    assert.strictEqual(t.tab("Ledger").getLastRow(), 2);
    assert.deepStrictEqual(historyActions(t), ["create"]);
  }],
  ["reusing an ID for different content is a conflict, not an overwrite", () => {
    const t = setup();
    t.call("save", {by:"Ben", entry:income()});
    const r = t.call("save", {by:"Alan", entry:income({amount:300})});
    assert.deepStrictEqual([r.ok, r.conflict, r.entry.amount, r.entry.rev], [false, true, 250, 1]);
  }],
  ["an update carries the rev it was based on", () => {
    const t = setup();
    t.call("save", {by:"Ben", entry:income()});
    const r = t.call("save", {by:"Alan", entry:income({amount:300}), rev:1});
    assert.deepStrictEqual([r.ok, r.entry.rev, r.entry.amount, r.entry.createdBy, r.entry.updatedBy], [true, 2, 300, "Ben", "Alan"]);
    assert.strictEqual(t.call("list").entries[0].amount, 300);
    assert.strictEqual(t.tab("Ledger").getLastRow(), 2);
  }],
  ["a stale update is handed the other person's version", () => {
    const t = setup();
    t.call("save", {by:"Ben", entry:income()});
    t.call("save", {by:"Ben", entry:income({amount:300}), rev:1});
    const r = t.call("save", {by:"Alan", entry:income({amount:275}), rev:1});
    assert.deepStrictEqual([r.ok, r.conflict, r.entry.rev, r.entry.amount], [false, true, 2, 300]);
  }],
  ["a retried update whose first reply was lost is recognised", () => {
    const t = setup();
    t.call("save", {by:"Ben", entry:income()});
    t.call("save", {by:"Alan", entry:income({amount:300}), rev:1});
    const again = t.call("save", {by:"Alan", entry:income({amount:300}), rev:1});
    assert.deepStrictEqual([again.ok, again.entry.rev], [true, 2]);
    assert.deepStrictEqual(historyActions(t), ["create", "update"]);
  }],
  ["an entry can't change kind", () => {
    const t = setup();
    t.call("save", {by:"Ben", entry:income()});
    assert.match(t.call("save", {by:"Ben", entry:expense({id:"mtest0001"}), rev:1}).error, /can't change kind/);
  }],
  ["void and restore, each idempotent, each needing the current rev", () => {
    const t = setup();
    t.call("save", {by:"Ben", entry:income()});
    const v = t.call("void", {by:"Alan", id:"mtest0001", rev:1});
    assert.deepStrictEqual([v.ok, v.entry.status, v.entry.rev, v.entry.updatedBy], [true, "void", 2, "Alan"]);
    const again = t.call("void", {by:"Alan", id:"mtest0001", rev:1});
    assert.deepStrictEqual([again.ok, again.entry.rev], [true, 2]);
    const stale = t.call("restore", {by:"Ben", id:"mtest0001", rev:1});
    assert.deepStrictEqual([stale.ok, stale.conflict, stale.entry.status], [false, true, "void"]);
    const r = t.call("restore", {by:"Ben", id:"mtest0001", rev:2});
    assert.deepStrictEqual([r.ok, r.entry.status, r.entry.rev], [true, "live", 3]);
    assert.match(t.call("void", {by:"Alan", id:"mnothere1", rev:1}).error, /isn't in the sheet any more/);
    assert.match(t.call("void", {id:"mtest0001", rev:3}).error, /who are you/);
  }],
  ["every change lands on the History tab", () => {
    const t = setup();
    t.call("save", {by:"Ben", entry:income()});
    t.call("save", {by:"Alan", entry:income({amount:300}), rev:1});
    t.call("void", {by:"Alan", id:"mtest0001", rev:2});
    t.call("restore", {by:"Ben", id:"mtest0001", rev:3});
    const h = t.tab("History");
    assert.deepStrictEqual(h.getRange(1, 1, 1, 6).getValues()[0], ["At", "By", "Book", "Action", "ID", "Entry"]);
    const rows = h.getRange(2, 1, 4, 6).getValues();
    assert.deepStrictEqual(rows.map(r => [r[1], r[2], r[3], r[4], JSON.parse(r[5]).rev]),
      [["Ben", "live", "create", "mtest0001", 1], ["Alan", "live", "update", "mtest0001", 2],
       ["Alan", "live", "void", "mtest0001", 3], ["Ben", "live", "restore", "mtest0001", 4]]);
  }],
  ["the test book never touches the Ledger", () => {
    const t = setup();
    assert.strictEqual(t.call("save", {book:"test", by:"Ben", entry:income()}).ok, true);
    assert.deepStrictEqual(t.call("list").entries, []);
    assert.strictEqual(t.call("list", {book:"test"}).entries.length, 1);
    assert.strictEqual(t.tab("Test").getLastRow(), 2);
    assert.strictEqual(t.tab("Ledger").getLastRow(), 0);
    assert.strictEqual(t.api.call({key:KEY, book:"test", action:"list"}).entries[0].id, "mtest0001");
  }],
  ["text Sheets would run as a formula comes back as typed", () => {
    const t = setup();
    const e = expense({party:'=HYPERLINK("http://x","x")', note:"+1 more call", category:"@home"});
    assert.strictEqual(t.call("save", {by:"Alan", entry:e}).ok, true);
    const got = t.call("list").entries[0];
    assert.deepStrictEqual([got.party, got.note, got.category], [e.party, e.note, e.category]);
    assert.strictEqual(t.tab("Ledger").get(2, 9), e.party);
  }],
  ["dates stay text, and a date Sheets turned into a Date still reads as the day", () => {
    const t = setup();
    t.call("save", {by:"Ben", entry:income()});
    const sh = t.tab("Ledger");
    assert.strictEqual(sh.get(2, 3), "2026-09-16");
    sh.formats.delete("2:3"); sh.put(2, 3, "2026-09-18");            // a hand edit in a cell that lost its format
    assert.ok(sh.get(2, 3) instanceof Date);
    assert.strictEqual(t.call("list").entries[0].date, "2026-09-18");
  }],
  ["a row the hub can't read is reported, never dropped", () => {
    const t = setup();
    t.call("save", {by:"Ben", entry:income()});
    t.tab("Ledger").put(2, 5, "lots");
    const list = t.call("list");
    assert.deepStrictEqual(list.entries, []);
    assert.deepStrictEqual(list.problems, [{row:2, id:"mtest0001", campaign:"Fall 2026", error:"Amount must be a number"}]);
    assert.match(t.call("save", {by:"Ben", entry:income({amount:260}), rev:1}).error, /row 2 of the Ledger tab needs a look first/);
    assert.match(t.call("void", {by:"Ben", id:"mtest0001", rev:1}).error, /row 2 of the Ledger tab needs a look first/);
  }],
  ["a % row whose amount was edited by hand is a problem", () => {
    const t = setup();
    t.call("save", {by:"Ben", entry:income({plan:"pct", base:12345.67, rate:8})});
    t.tab("Ledger").put(2, 5, 900);
    assert.match(t.call("list").problems[0].error, /isn't 8% of 12345\.67/);
  }],
  ["a hand-typed status or rev that doesn't read is a problem", () => {
    const t = setup();
    t.call("save", {by:"Ben", entry:income()});
    t.tab("Ledger").put(2, 19, "gone");
    assert.strictEqual(t.call("list").problems[0].error, "Status must be live or void");
    t.tab("Ledger").put(2, 19, "live"); t.tab("Ledger").put(2, 24, 0);
    assert.strictEqual(t.call("list").problems[0].error, "Rev must be a whole number, 1 or more");
  }],
  ["a duplicated ID is a problem on the later row", () => {
    const t = setup();
    t.call("save", {by:"Ben", entry:income()});
    const sh = t.tab("Ledger"), row = sh.getRange(2, 1, 1, 24).getValues();
    sh.getRange(3, 1, 1, 24).setNumberFormats([Array(24).fill("@")]);
    sh.getRange(3, 1, 1, 24).setValues(row);
    const list = t.call("list");
    assert.strictEqual(list.entries.length, 1);
    assert.deepStrictEqual(list.problems.map(p => [p.row, p.error]), [[3, "the ID mtest0001 is also on row 2"]]);
  }],
  ["a blank row in the middle is skipped quietly", () => {
    const t = setup();
    t.call("save", {by:"Ben", entry:income()});
    t.call("save", {by:"Alan", entry:expense()});
    const sh = t.tab("Ledger");
    for(let c = 1; c <= 24; c++) sh.put(2, c, "");
    const list = t.call("list");
    assert.deepStrictEqual([list.entries.length, list.problems.length], [1, 0]);
  }],
  ["a changed header row stops everything, and says how to fix it", () => {
    const t = setup();
    t.call("save", {by:"Ben", entry:income()});
    t.tab("Ledger").put(1, 5, "Dollars");
    const r = t.call("list");
    assert.strictEqual(r.ok, false);
    assert.match(r.error, /the Ledger tab's header row was changed \(column 5 should read "Amount"\)/);
  }],
  ["a sheet that won't open is an error with the reason, never a fresh sheet", () => {
    const t = setup({props:{MONEY_KEY:KEY, MONEY_SHEET_ID:"gone"}});
    const r = t.call("list");
    assert.strictEqual(r.ok, false);
    assert.match(r.error, /^couldn't open the SNA Money sheet: Unexpected error while getting the method or property openById/);
    assert.doesNotMatch(r.error, /clear/);                       // no advice that would start a second sheet
    assert.match(t.call("save", {by:"Ben", entry:income()}).error, /couldn't open the SNA Money sheet/);
    assert.strictEqual(t.gas.state.spreadsheets.size, 0);
  }],
  ["a saved row is flushed to the sheet before the reply says ok", () => {
    const t = setup();
    t.call("save", {by:"Ben", entry:income()});
    assert.ok(t.gas.state.flushes >= 1);
  }],
  ["a History line that can't be written doesn't turn a saved entry into an error", () => {
    const t = setup({failSheet:{History:"Service Spreadsheets timed out"}});
    const r = t.call("save", {by:"Ben", entry:income()});
    assert.strictEqual(r.ok, true);
    assert.match(r.warning, /^Saved, but the sheet's History tab couldn't record it \(Service Spreadsheets timed out\)/);
    assert.strictEqual(t.call("list").entries.length, 1);
    const v = t.call("void", {by:"Alan", id:"mtest0001", rev:1});
    assert.deepStrictEqual([v.ok, v.entry.status], [true, "void"]);
    assert.match(v.warning, /History tab couldn't record it/);
    assert.ok(t.gas.state.logs.some(l => /create mtest0001 is saved, but History failed: Service Spreadsheets timed out/.test(l)));
  }],
  ["saving over an entry the other person voided is a conflict, not a quiet success", () => {
    const t = setup();
    t.call("save", {by:"Alan", entry:income()});
    t.call("void", {by:"Ben", id:"mtest0001", rev:1});
    const r = t.call("save", {by:"Alan", entry:income({status:"live"}), rev:1});
    assert.deepStrictEqual([r.ok, r.conflict, r.entry.status, r.entry.rev], [false, true, "void", 2]);
    const again = t.call("save", {by:"Ben", entry:income({status:"void"}), rev:1});
    assert.deepStrictEqual([again.ok, again.entry.rev], [true, 2]);   // the one who voided it, retrying, is recognised
  }],
  ["the ledger and its History grow past a new tab's size", () => {
    const t = setup({maxRows:3});                                   // a header and two rows fit
    for(let i = 1; i <= 5; i++) assert.strictEqual(t.call("save", {by:"Ben", entry:income({id:"mgrow000" + i, amount:100 + i})}).ok, true, "save " + i);
    assert.strictEqual(t.call("list").entries.length, 5);
    assert.strictEqual(historyActions(t).length, 5);
    assert.ok(t.tab("Ledger").getMaxRows() >= 6);
  }],
  ["a sheet sitting in Drive's trash takes no more writes, and says so", () => {
    const t = setup();
    t.call("save", {by:"Ben", entry:income()});
    t.ss().trashed = true;
    const r = t.call("save", {by:"Ben", entry:income({id:"mtest0009"})});
    assert.strictEqual(r.ok, false);
    assert.match(r.error, /^the SNA Money sheet is in Drive's trash — restore it/);
    assert.match(t.call("void", {by:"Ben", id:"mtest0001", rev:1}).error, /in Drive's trash/);
    assert.strictEqual(t.call("list").entries.length, 1);          // reading it still works, so nothing looks lost
  }],
  ["a busy lock is an error, not a silent wait", () => {
    assert.match(setup({lockBusy:true}).call("save", {by:"Ben", entry:income()}).error, /busy/);
  }],
  ["a receipt is filed in Drive and comes back byte for byte", () => {
    const t = setup();
    const r = t.call("save", {by:"Alan", entry:expense(), receipt:{name:"zoom/receipt?.png", mime:"image/png", b64:PNG}});
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.entry.receiptName, "zoom receipt .png");
    const file = t.gas.state.files.get(r.entry.receiptId);
    assert.strictEqual(file.getName(), "2026-09-17 expense 15.99 mtest0002.png");
    const folder = t.gas.state.folders.get(file.parents[0]);
    assert.strictEqual(folder.getName(), "SNA Money Receipts");
    const sha = require("crypto").createHash("sha256").update(Buffer.from(PNG, "base64")).digest("hex");
    assert.strictEqual(r.entry.receiptSha, sha);
    assert.strictEqual(t.tab("Ledger").get(2, 18), sha);
    assert.strictEqual(t.call("list").entries[0].receiptSha, sha);
    assert.deepStrictEqual(t.call("receipt", {id:"mtest0002"}), {ok:true, name:"zoom receipt .png", mime:"image/png", b64:PNG});
  }],
  ["test-book receipts go in a Test folder inside the receipts folder", () => {
    const t = setup();
    const r = t.call("save", {book:"test", by:"Alan", entry:expense(), receipt:{name:"a.png", mime:"image/png", b64:PNG}});
    const file = t.gas.state.files.get(r.entry.receiptId), folder = t.gas.state.folders.get(file.parents[0]);
    assert.strictEqual(folder.getName(), "Test");
    assert.strictEqual(t.gas.state.folders.get(folder.parents[0]).getName(), "SNA Money Receipts");
    assert.strictEqual(t.call("receipt", {book:"test", id:"mtest0002"}).b64, PNG);
    assert.match(t.call("receipt", {id:"mtest0002"}).error, /isn't in the sheet any more/);
  }],
  ["receipt only serves an entry's own file, from its book's folder", () => {
    const t = setup();
    const r = t.call("save", {by:"Alan", entry:expense(), receipt:{name:"a.png", mime:"image/png", b64:PNG}});
    t.call("save", {by:"Ben", entry:income()});
    assert.match(t.call("receipt", {id:"mtest0001"}).error, /has no receipt/);
    const elsewhere = t.gas.globals.DriveApp.createFolder("Somewhere else");
    t.gas.state.files.get(r.entry.receiptId).parents = [elsewhere.getId()];
    assert.match(t.call("receipt", {id:"mtest0002"}).error, /isn't in the SNA Money receipts folder/);
    t.gas.state.files.get(r.entry.receiptId).parents = [t.gas.state.files.get(r.entry.receiptId).parents[0]];
    t.gas.state.files.get(r.entry.receiptId).setTrashed(true);
    assert.match(t.call("receipt", {id:"mtest0002"}).error, /the receipt file is in Drive's trash/);
    t.gas.state.driveDown = "Service error: Drive";
    assert.strictEqual(t.call("receipt", {id:"mtest0002"}).error, "couldn't open the receipt file: Service error: Drive");
  }],
  ["a receipt has to be a photo or a PDF, 5 MB at most, and intact", () => {
    const t = setup();
    assert.match(t.call("save", {by:"Alan", entry:expense(), receipt:{name:"a.html", mime:"text/html", b64:PNG}}).error, /photo or a PDF/);
    assert.match(t.call("save", {by:"Alan", entry:expense(), receipt:{name:"big.pdf", mime:"application/pdf", b64:Buffer.alloc(5 * 1024 * 1024 + 1).toString("base64")}}).error, /too big/);
    assert.match(t.call("save", {by:"Alan", entry:expense(), receipt:{name:"a.png", mime:"image/png", b64:"!!!"}}).error, /didn't arrive intact/);
    assert.strictEqual(t.gas.state.spreadsheets.size, 0);
    assert.strictEqual(t.gas.state.files.size, 0);
  }],
  ["a retried save with the same receipt files it once", () => {
    const t = setup();
    const body = {by:"Alan", entry:expense(), receipt:{name:"a.png", mime:"image/png", b64:PNG}};
    const a = t.call("save", body), b = t.call("save", body);
    assert.deepStrictEqual([b.ok, b.entry.receiptId], [true, a.entry.receiptId]);
    assert.strictEqual(t.gas.state.files.size, 1);
  }],
  ["replacing a receipt with a different file of the same name files the new one", () => {
    const t = setup();
    const a = t.call("save", {by:"Alan", entry:expense(), receipt:{name:"image.jpg", mime:"image/jpeg", b64:PNG}});
    const b = t.call("save", {by:"Alan", entry:expense(), rev:1, receipt:{name:"image.jpg", mime:"image/jpeg", b64:OTHER}});
    assert.deepStrictEqual([b.ok, b.entry.rev], [true, 2]);
    assert.notStrictEqual(b.entry.receiptId, a.entry.receiptId);
    assert.strictEqual(t.call("receipt", {id:"mtest0002"}).b64, OTHER);
  }],
  ["removing a receipt clears it, and a retry of that is recognised", () => {
    const t = setup();
    t.call("save", {by:"Alan", entry:expense(), receipt:{name:"a.png", mime:"image/png", b64:PNG}});
    const r = t.call("save", {by:"Alan", entry:expense(), rev:1, removeReceipt:true});
    assert.deepStrictEqual([r.ok, r.entry.rev, r.entry.receiptId, r.entry.receiptName], [true, 2, "", ""]);
    const again = t.call("save", {by:"Alan", entry:expense(), rev:1, removeReceipt:true});
    assert.deepStrictEqual([again.ok, again.entry.rev], [true, 2]);
    assert.strictEqual(t.gas.state.files.size, 1);                    // the file itself stays in Drive
  }],
  ["a receipts folder that went missing is an error, not a fresh folder", () => {
    const t = setup();
    const r = t.call("save", {by:"Alan", entry:expense(), receipt:{name:"a.png", mime:"image/png", b64:PNG}});
    const folderId = t.gas.state.files.get(r.entry.receiptId).parents[0];
    t.gas.state.folders.get(folderId).setTrashed(true);
    const out = t.call("save", {by:"Alan", entry:expense({id:"mtest0009"}), receipt:{name:"b.png", mime:"image/png", b64:PNG}});
    assert.match(out.error, /^the receipts folder is in Drive's trash/);
    assert.doesNotMatch(out.error, /clear/);
    assert.strictEqual(t.gas.state.folders.size, 1);
  }],
];

let fail = 0;
for(const [label, fn] of cases){
  try{ fn(); console.log("ok   " + label); }
  catch(e){ fail++; console.log("FAIL " + label + "\n     " + String(e && e.message).split("\n").join("\n     ")); }
}
console.log(fail ? `\n${fail} of ${cases.length} failing` : `\nall ${cases.length} passing`);
process.exit(fail ? 1 : 0);

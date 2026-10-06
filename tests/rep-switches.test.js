// node tests/rep-switches.test.js
// The per-mentee switches on the Mentees tab (the REP_SW block of index.html):
// which pills read OFF on a row, and who the Automations card names.
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const m = src.match(/\/\*REP_SW_BEGIN\*\/([\s\S]*?)\/\*REP_SW_END\*\//);
if(!m){ console.error("FAIL: no REP_SW block in index.html"); process.exit(1); }
const {REP_SW, repSwOff, repSwSummary} = new Function(m[1] + "\n;return {REP_SW, repSwOff, repSwSummary};")();

const ON = {checkins:true, assignments:true, emails:true};
const row = (Name, Switches, Active = true) => ({RepID:Name, Name, Active, Switches});
let n = 0;
const t = (name, fn) => { fn(); n++; };

t("the three switches the sheet knows, in the order the pills are drawn", () =>
  assert.deepStrictEqual(REP_SW.map(x => x.k), ["checkins", "assignments", "emails"]));
t("everything on reads as nothing off", () => assert.deepStrictEqual(repSwOff(row("a", ON)), []));
t("each switch reads on its own", () =>
  assert.deepStrictEqual(repSwOff(row("a", {checkins:false, assignments:true, emails:false})), ["checkins", "emails"]));
t("only a real false is OFF: a missing key is not shown as off", () =>
  assert.deepStrictEqual(repSwOff(row("a", {checkins:true})), []));
t("a row from a script that predates the switches has nothing to show", () => {
  assert.deepStrictEqual(repSwOff({RepID:"a", Name:"a", Active:true}), []);
  assert.deepStrictEqual(repSwOff(null), []);
});
t("the card names each active mentee with something off, and what", () =>
  assert.deepStrictEqual(repSwSummary([row("Jordan Sample", ON), row("Casey Example", {checkins:false, assignments:true, emails:false}),
                                       row("Sam Standin", {checkins:true, assignments:false, emails:true})]),
    [{name:"Casey Example", kinds:["check-in texts", "emails"]}, {name:"Sam Standin", kinds:["assignment texts"]}]));
t("a former mentee is never named: nothing is sent to them either way", () =>
  assert.deepStrictEqual(repSwSummary([row("Quinn Former", {checkins:false, assignments:false, emails:false}, false)]), []));
t("nobody off, nobody named", () => assert.deepStrictEqual(repSwSummary([row("a", ON), row("b", ON)]), []));
t("no roster yet is not a crash", () => assert.deepStrictEqual(repSwSummary(null), []));
console.log(`all ${n} passed`);

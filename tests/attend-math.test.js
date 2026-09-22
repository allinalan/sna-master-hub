// node tests/attend-math.test.js
// Call Attendance's rules, pulled out of index.html (the ATTEND_MATH block,
// with the ASSIGN_STATE block it leans on) and run under node: who a call is
// for, the Friday a replay is due, who owes one, and the plan that turns a roll
// into a make-up only the people who missed can see.
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const pick = name => {
  const m = src.match(new RegExp("\\/\\*" + name + "_BEGIN\\*\\/([\\s\\S]*?)\\/\\*" + name + "_END\\*\\/"));
  if(!m){ console.error(`FAIL: no ${name} block in index.html`); process.exit(1); }
  return m[1];
};
const M = new Function(pick("ASSIGN_STATE") + "\n" + pick("ATTEND_MATH") +
  "\n;return {atTier, atExpects, atDueFriday, atCount, atOwes, atPlan, assignState};")();

const rep = (RepID, Tier, Active = true) => ({RepID, Name:RepID, Tier, Active});
const REPS = [rep("d1", "Dojo"), rep("d2", "Dojo"), rep("p1", "Path"), rep("p2", "Path"), rep("m1", "Masters"), rep("gone", "Dojo", false)];
const WANT = {campaign:"Fall 2026", title:"Replay · Phoning 101 · Sep 22", instructions:"Watch it.\n\nPost it.", materialsUrl:"", dueDate:"2026-09-25"};
/* the catalog row the sheet would hold after a save of `plan.save` */
const rowFrom = (id, save) => ({AssignmentID:id, Programs:save.programs.join(", "), Campaign:save.campaign, Title:save.title,
  Instructions:save.instructions, MaterialsURL:save.materialsUrl, DueDate:save.dueDate, Active:save.active === false ? "N" : "Y"});
/* apply a plan's overrides the way setOverride does: one row per mentee, "" clears it */
const applyOps = (overrides, id, ops) => {
  const out = overrides.slice();
  for(const op of ops){
    const i = out.findIndex(o => o.AssignmentID === id && o.RepID === op.repId);
    if(i >= 0) out.splice(i, 1);
    if(op.dueDate) out.push({AssignmentID:id, RepID:op.repId, DueDate:op.dueDate});
  }
  return out;
};
const seen = (a, overrides, r) => M.assignState({id:r.RepID, tier:r.Tier}, a, overrides, [], "2026-09-23").state;

const cases = [
  ["a call is for its tier and everyone above it; untagged is everyone", () => {
    assert.deepStrictEqual(["Dojo", "Path", "Masters"].map(p => M.atExpects(1, p)), [true, true, true]);
    assert.deepStrictEqual(["Dojo", "Path", "Masters"].map(p => M.atExpects(2, p)), [false, true, true]);
    assert.deepStrictEqual(["Dojo", "Path", "Masters"].map(p => M.atExpects(3, p)), [false, false, true]);
    assert.deepStrictEqual(["Dojo", "Path", "Masters"].map(p => M.atExpects(0, p)), [true, true, true]);
    assert.strictEqual(M.atTier(undefined), 1);
  }],
  ["a replay is due the Friday after the call", () => {
    assert.strictEqual(M.atDueFriday("2026-09-22"), "2026-09-25");      // Tuesday → that Friday
    assert.strictEqual(M.atDueFriday("2026-09-24"), "2026-09-25");      // Thursday hot seat → the next day
    assert.strictEqual(M.atDueFriday("2026-09-25"), "2026-10-02");      // a Friday call gets the Friday after
    assert.strictEqual(M.atDueFriday("2026-09-28"), "2026-10-02");      // Monday → that Friday
    assert.strictEqual(M.atDueFriday("2026-09-26"), "2026-10-02");      // Saturday
    assert.strictEqual(M.atDueFriday("2026-12-29"), "2027-01-01");      // across the new year
  }],
  ["the count: on, excused, not marked, drop-ins, guests", () => {
    const roll = {expected:["d1", "p1", "m1"], marks:{d1:"on", p1:"x", z9:"on"}, guests:2};
    assert.deepStrictEqual(M.atCount(roll), {expected:3, on:1, excused:1, unmarked:1, drop:1, guests:2});
    assert.deepStrictEqual(M.atCount(null), {expected:0, on:0, excused:0, unmarked:0, drop:0, guests:0});
  }],
  ["excused still owes the replay; nobody owes one until the roll is in", () => {
    const roll = {expected:["d1", "p1", "m1"], marks:{d1:"on", p1:"x"}};
    assert.deepStrictEqual(M.atOwes(roll), []);
    assert.deepStrictEqual(M.atOwes(Object.assign({done:true}, roll)), ["p1", "m1"]);
    assert.deepStrictEqual(M.atOwes(Object.assign({done:true, skip:true}, roll)), []);
  }],
  ["a first make-up: only the owers' programs, everyone else in them not applicable", () => {
    const plan = M.atPlan(["p1"], REPS, null, [], WANT);
    assert.strictEqual(plan.create, true);
    assert.deepStrictEqual(plan.programs, ["Path"]);
    assert.deepStrictEqual(plan.ops, [{repId:"p2", dueDate:"NA"}]);           // no Dojo or Masters overrides needed
    assert.strictEqual(plan.save.active, true);
    const a = rowFrom("A1", plan.save), ov = applyOps([], "A1", plan.ops);
    assert.strictEqual(seen(a, ov, REPS[2]), "open");                         // p1 owes it
    for(const r of [REPS[0], REPS[1], REPS[3], REPS[4]]) assert.strictEqual(seen(a, ov, r), "na", r.RepID);
    assert.deepStrictEqual(M.atPlan(["p1"], REPS, a, ov, WANT), {create:false, archive:false, ops:[], save:null, programs:["Path"]});
  }],
  ["owers across programs; a former mentee is left alone", () => {
    const plan = M.atPlan(["d1", "m1", "gone"], REPS, null, [], WANT);
    assert.deepStrictEqual(plan.programs, ["Dojo", "Masters"]);
    assert.deepStrictEqual(plan.ops.map(o => o.repId).sort(), ["d2"]);
    /* the assignments sheet writes the flag Y/N rather than true/false */
    const sheet = REPS.map(r => Object.assign({}, r, {Active:r.Active ? "Y" : "N"}));
    assert.deepStrictEqual(M.atPlan(["d1", "m1", "gone"], sheet, null, [], WANT).ops.map(o => o.repId).sort(), ["d2"]);
  }],
  ["the roll changes after the make-up went out", () => {
    const first = M.atPlan(["p1", "p2"], REPS, null, [], WANT);
    const a = rowFrom("A1", first.save);
    let ov = applyOps([], "A1", first.ops);
    /* p2 turns out to have been on it */
    const fewer = M.atPlan(["p1"], REPS, a, ov, WANT);
    assert.deepStrictEqual(fewer.ops, [{repId:"p2", dueDate:"NA"}]);
    assert.strictEqual(fewer.save, null);
    ov = applyOps(ov, "A1", fewer.ops);
    /* and back again: the NA is lifted */
    const more = M.atPlan(["p1", "p2"], REPS, a, ov, WANT);
    assert.deepStrictEqual(more.ops, [{repId:"p2", dueDate:""}]);
    /* a Masters ower joins: Masters is added, with its non-owers covered first */
    const wider = M.atPlan(["p1", "m1"], REPS, a, ov, WANT);
    assert.deepStrictEqual(wider.programs, ["Path", "Masters"]);
    assert.ok(wider.save && wider.save.programs.join() === "Path,Masters");
  }],
  ["nobody owes it any more — the make-up comes down", () => {
    const a = rowFrom("A1", M.atPlan(["p1"], REPS, null, [], WANT).save);
    assert.strictEqual(M.atPlan([], REPS, a, [], WANT).archive, true);
    assert.strictEqual(M.atPlan([], REPS, Object.assign({}, a, {Active:"N"}), [], WANT).archive, false);
    assert.strictEqual(M.atPlan([], REPS, null, [], WANT).create, false);
  }],
  ["a new recording link, or a sheet that tidied the whitespace", () => {
    const plan = M.atPlan(["p1"], REPS, null, [], WANT);
    const a = rowFrom("A1", plan.save), ov = applyOps([], "A1", plan.ops);
    const linked = M.atPlan(["p1"], REPS, a, ov, Object.assign({}, WANT, {materialsUrl:"https://example.com/rec"}));
    assert.ok(linked.save && linked.save.materialsUrl === "https://example.com/rec");
    const tidied = Object.assign({}, a, {Instructions:"Watch it.\r\n\r\nPost it. ", DueDate:"2026-09-25T00:00:00"});
    assert.strictEqual(M.atPlan(["p1"], REPS, tidied, ov, WANT).save, null);
  }],
  ["someone who joins later is taken off it; an inactive row is saved back on", () => {
    const plan = M.atPlan(["p1"], REPS, null, [], WANT);
    const a = rowFrom("A1", plan.save), ov = applyOps([], "A1", plan.ops);
    const reps = REPS.concat([rep("p3", "Path")]);
    assert.deepStrictEqual(M.atPlan(["p1"], reps, a, ov, WANT).ops, [{repId:"p3", dueDate:"NA"}]);
    const off = M.atPlan(["p1"], REPS, Object.assign({}, a, {Active:"N"}), ov, WANT);
    assert.ok(off.save && off.save.active === true);
  }],
];

let failed = 0;
for(const [name, fn] of cases){
  try{ fn(); }
  catch(e){ failed++; console.error("FAIL: " + name + "\n  " + (e && e.message)); }
}
if(failed){ console.error(`\n${failed} of ${cases.length} failing`); process.exit(1); }
console.log(`\nall ${cases.length} passing`);

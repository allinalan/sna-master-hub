// node tests/asubs.test.js
// Assignments ▸ Submissions (the ASUBS block of index.html): the list Ben asked for on
// 2026-10-16, everything turned in sorted by date, and the day each board square shows.
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const m = src.match(/\/\*ASUBS_BEGIN\*\/([\s\S]*?)\/\*ASUBS_END\*\//);
if(!m){ console.error("FAIL: no ASUBS block in index.html"); process.exit(1); }
const {subStamp, subDay, subRows} = new Function(m[1] + "\n;return {subStamp, subDay, subRows};")();

let n = 0;
const t = (name, fn) => { fn(); n++; };
const rep = (RepID, Name) => ({RepID, Name, Tier:"Dojo"});
const asg = (AssignmentID, Title) => ({AssignmentID, Title});
// a stand-in for the board's cellState: whatever state and latest version the test sets
const states = {};
const put = (r, a, state, SubmittedAt, Version) => { states[r + "|" + a] = {state, latest:SubmittedAt === null ? null : {SubmittedAt, Version:Version || "1"}}; };
const stateOf = (r, a) => states[r.RepID + "|" + a.AssignmentID] || {state:"open", latest:null};
const names = rows => rows.map(x => x.rep.Name + "/" + x.a.AssignmentID);

const reps = [rep("r1", "Reed"), rep("r2", "Donal"), rep("r3", "Maddie"), rep("r4", "Sean")];
const list = [asg("a7", "Rec Approach"), asg("a4", "Priority Plan")];
put("r1", "a7", "waiting", "2026-10-14T22:05:00.000Z");
put("r2", "a7", "approved", "2026-10-12T15:00:00.000Z");
put("r3", "a7", "revise", "2026-10-15T01:30:00.000Z", "2");
put("r1", "a4", "approved", "2026-09-27T18:00:00.000Z");
put("r4", "a7", "open", null);                       // nothing turned in: never a row
put("r4", "a4", "na", "2026-09-26T18:00:00.000Z");   // not applicable: never a row, even with a stamp

t("newest first is the default: the latest version decides", () =>
  assert.deepStrictEqual(names(subRows(reps, list, stateOf)), ["Maddie/a7", "Reed/a7", "Donal/a7", "Reed/a4"]));
t("oldest first works the queue in the order it came in", () =>
  assert.deepStrictEqual(names(subRows(reps, list, stateOf, {order:"old"})), ["Reed/a4", "Donal/a7", "Reed/a7", "Maddie/a7"]));
t("nothing turned in and not applicable are never rows", () => {
  const all = names(subRows(reps, list, stateOf));
  assert.ok(!all.some(x => x.startsWith("Sean/")), "Sean has no submission that counts");
});
t("a status filter keeps only that status", () => {
  assert.deepStrictEqual(names(subRows(reps, list, stateOf, {state:"waiting"})), ["Reed/a7"]);
  assert.deepStrictEqual(names(subRows(reps, list, stateOf, {state:"approved", order:"old"})), ["Reed/a4", "Donal/a7"]);
  assert.deepStrictEqual(names(subRows(reps, list, stateOf, {state:"all"})).length, 4);
});
t("a stamp that can't be read sinks to the bottom in either order", () => {
  const rs = [rep("x1", "Ann"), rep("x2", "Bo"), rep("x3", "Cy")], one = [asg("q", "Q")];
  put("x1", "q", "waiting", "");
  put("x2", "q", "waiting", "2026-10-01T10:00:00Z");
  put("x3", "q", "waiting", "2026-10-02T10:00:00Z");
  assert.deepStrictEqual(names(subRows(rs, one, stateOf)), ["Cy/q", "Bo/q", "Ann/q"]);
  assert.deepStrictEqual(names(subRows(rs, one, stateOf, {order:"old"})), ["Bo/q", "Cy/q", "Ann/q"]);
});
t("the same moment falls back to name, then title, so the list never shuffles", () => {
  const rs = [rep("y2", "Zed"), rep("y1", "Amy")], two = [asg("k2", "Beta"), asg("k1", "Alpha")];
  ["y1", "y2"].forEach(r => ["k1", "k2"].forEach(a => put(r, a, "waiting", "2026-10-03T12:00:00Z")));
  assert.deepStrictEqual(names(subRows(rs, two, stateOf)), ["Amy/k1", "Amy/k2", "Zed/k1", "Zed/k2"]);
});
t("stamps: an ISO time reads, anything else is 0", () => {
  assert.strictEqual(subStamp({SubmittedAt:"2026-10-14T22:05:00.000Z"}), Date.UTC(2026, 9, 14, 22, 5));
  assert.strictEqual(subStamp({SubmittedAt:"soon"}), 0);
  assert.strictEqual(subStamp({}), 0);
  assert.strictEqual(subStamp(null), 0);
});
t("the day under a square is short and local, and blank when there's no stamp", () => {
  const noon = new Date(2026, 9, 14, 12, 0).toISOString();   // midday local, so no time zone moves the day
  assert.strictEqual(subDay({SubmittedAt:noon}), "Oct 14");
  assert.strictEqual(subDay({SubmittedAt:""}), "");
  assert.strictEqual(subDay(null), "");
});
console.log(`asubs: ${n} passed`);

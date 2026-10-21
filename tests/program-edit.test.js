// node tests/program-edit.test.js
// Moving a mentee to another program, on the Mentees tab (the PROG block of index.html):
// the programs the picker offers, that the page reads each of them back the way the sheet
// writes them, and what the confirm says a move does before anything is written.
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const m = src.match(/\/\*PROG_BEGIN\*\/([\s\S]*?)\/\*PROG_END\*\//);
if(!m){ console.error("FAIL: no PROG block in index.html"); process.exit(1); }
const {PROGRAMS, programMoveNote} = new Function(m[1] + "\n;return {PROGRAMS, programMoveNote};")();
const po = src.match(/\nfunction programOf\(r\)\{[\s\S]*?\n\}\n/);
if(!po){ console.error("FAIL: no programOf in index.html"); process.exit(1); }
const programOf = new Function(po[0] + ";return programOf;")();

let n = 0;
const t = (name, fn) => { fn(); n++; };
const note = (o) => programMoveNote(Object.assign({name:"Kendall Harrison", from:"Dojo", to:"Path", coach:"", pay:"", active:true}, o));
const has = (s, bit) => assert.ok(s.includes(bit), `expected "${bit}" in:\n${s}`);
const hasnt = (s, bit) => assert.ok(!s.includes(bit), `didn't expect "${bit}" in:\n${s}`);

t("the picker offers the three programs, Dojo first", () => assert.deepStrictEqual(PROGRAMS, ["Dojo", "Path", "Masters"]));
t("the words the sheet writes in Contacts read back as each program", () =>
  assert.deepStrictEqual(PROGRAMS.map(p => programOf({Program:"The " + p})), PROGRAMS));
t("so does the Roster's Tier", () => assert.deepStrictEqual(PROGRAMS.map(p => programOf({Tier:p})), PROGRAMS));
t("Contacts wins over Tier, so the answer's Program is what the row shows", () =>
  assert.strictEqual(programOf({Program:"The Path", Tier:"Dojo"}), "Path"));

t("the question names the mentee and both programs", () =>
  assert.ok(note({}).startsWith("Move Kendall Harrison from The Dojo to The Path?\n")));
t("someone with no program on the sheet is put in one", () =>
  assert.ok(note({from:""}).startsWith("Put Kendall Harrison in The Path?\n")));
t("it always says what they owe goes by the new program", () => {
  for(const to of PROGRAMS) has(note({from:"Path", to}), `their due-date texts go by The ${to} from now on`);
});
t("it always says both cells change", () => has(note({}), "The Contacts sheet and the Roster both change."));

t("up from the Dojo with no coach: they show as Unassigned", () => {
  const s = note({});
  has(s, "The Path gets a coach: Kendall shows as Unassigned until you pick one.");
  has(s, "Kendall joins the Weekly Check-ins board.");
});
t("up from the Dojo with a name left on the row: that's their coach now", () => {
  const s = note({coach:"Ben", to:"Masters"});
  has(s, "Ben's name is already on the row, so Ben is their coach.");
  hasnt(s, "Unassigned");
});
t("down to the Dojo: they leave Weekly Check-ins, and a coach's name stays, faded", () => {
  const s = note({from:"Path", to:"Dojo", coach:"Ben"});
  has(s, "Kendall leaves the Weekly Check-ins board.");
  has(s, "Ben's name stays on the row, faded, with a clear link.");
});
t("down to the Dojo with no coach says nothing about one", () => hasnt(note({from:"Masters", to:"Dojo"}), "coach:"));
t("Path to Masters keeps the coach and the check-ins", () => {
  const s = note({from:"Path", to:"Masters", coach:"Alan"});
  has(s, "Alan stays their coach.");
  hasnt(s, "Weekly Check-ins");
  hasnt(s, "Unassigned");
});
t("Path to Masters with no coach doesn't nag about one", () => hasnt(note({from:"Path", to:"Masters"}), "coach"));
t("a blank program up to the Path asks for a coach, and isn't said to join check-ins it may already be on", () => {
  const s = note({from:"", to:"Path"});
  has(s, "shows as Unassigned");
  hasnt(s, "joins the Weekly Check-ins");
});

t("pay set: it says the pay stays, in the chip's words", () =>
  has(note({pay:"$59.99/mo"}), "Pay stays $59.99/mo. Change it on the Pay chip if the move changes it."));
t("no pay set: nothing about pay", () => hasnt(note({}), "Pay"));
t("a former mentee: it says nothing is sent to them", () =>
  has(note({active:false}), "Kendall is marked former, so nothing is sent to them either way."));
t("an active mentee: no word about former", () => hasnt(note({}), "former"));

t("the page only offers the picker when the script says it can move programs", () => {
  assert.ok(/TEAM\.programEdit = out\.programEdit === true/.test(src), "programEdit isn't read off the roster strictly");
  assert.ok(/if\(!TEAM\.programEdit\) return raw \?/.test(src), "programCell doesn't fall back to the plain chip");
});
t("a move asks the sheet with setProgram and the program's short name", () =>
  assert.ok(/teamCall\(\{action: "setProgram", repId, program: to\}\)/.test(src)));

console.log(`all ${n} passed`);

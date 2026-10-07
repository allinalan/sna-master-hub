// node tests/pay-plan.test.js
// What a mentee pays, on the Mentees tab (the PAY block of index.html): the words on
// the chip, the presets the roster sends for a program, and what the typed line will and
// won't send. It also pins that no program's prices are written into this public page.
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const m = src.match(/\/\*PAY_BEGIN\*\/([\s\S]*?)\/\*PAY_END\*\//);
if(!m){ console.error("FAIL: no PAY block in index.html"); process.exit(1); }
const {PAY_KINDS, payMoney, payLabel, payPresets, paySame, payDraft, payEntry} =
  new Function(m[1] + "\n;return {PAY_KINDS, payMoney, payLabel, payPresets, paySame, payDraft, payEntry};")();

let n = 0;
const t = (name, fn) => { fn(); n++; };
const p = (kind, amount, text) => ({kind, amount, text});
// what coachRoster's payPresets looks like. Made-up prices: the real ones are not in this repo.
const PRESETS = {
  Dojo:[{kind:"full", amount:120}, {kind:"monthly", amount:34.5}],
  Path:[{kind:"monthly", amount:300}, {kind:"monthly", amount:275}, {kind:"pct", amount:6}, {kind:"pct", amount:null}],
  Masters:[{kind:"monthly", amount:400}, {kind:"pct", amount:6}],
};

t("no program's prices are written into the page: they come with the roster", () => {
  assert.ok(!/PAY_PRESETS/.test(src), "a PAY_PRESETS constant is back in index.html");
  assert.ok(!/amount:\s*\d/.test(m[1]), "a literal amount is in the PAY block");
});
t("money: whole dollars carry no cents, cents stay, thousands get a comma", () =>
  assert.deepStrictEqual([300, 34.5, 12.99, 1250].map(payMoney), ["300", "34.50", "12.99", "1,250"]));
t("a flat amount a month shows its dollars", () => assert.strictEqual(payLabel(p("monthly", 300)), "$300/mo"));
t("paid in full says so", () => assert.strictEqual(payLabel(p("full", 120)), "$120 in full"));
t("cents are kept", () => assert.strictEqual(payLabel(p("monthly", 34.5)), "$34.50/mo"));
t("a percent shows its rate", () => assert.strictEqual(payLabel(p("pct", 6)), "6% of sales"));
t("a percent with a fraction", () => assert.strictEqual(payLabel(p("pct", 4.5)), "4.5% of sales"));
t("a percent nobody has put a rate on still says percent", () => assert.strictEqual(payLabel(p("pct", null)), "% of sales"));
t("a cell the hub can't read shows the cell's own words", () => assert.strictEqual(payLabel(p("other", null, "ask Ben")), "ask Ben"));
t("nothing set is no label", () => { assert.strictEqual(payLabel(null), ""); assert.strictEqual(payLabel(undefined), ""); });
t("a flat plan that lost its amount never reads as $0", () => assert.strictEqual(payLabel(p("monthly", null, "flat")), "flat"));

t("the three kinds, in the order the picker lists them", () => assert.deepStrictEqual(PAY_KINDS.map(x => x.k), ["monthly", "full", "pct"]));
t("a program's presets are the ones the roster sent for it, in order", () => {
  assert.deepStrictEqual(payPresets(PRESETS, "Dojo").map(payLabel), ["$120 in full", "$34.50/mo"]);
  assert.deepStrictEqual(payPresets(PRESETS, "Path").map(payLabel), ["$300/mo", "$275/mo", "6% of sales", "% of sales"]);
  assert.deepStrictEqual(payPresets(PRESETS, "Masters").map(payLabel), ["$400/mo", "6% of sales"]);
});
t("no program, or one the roster sent nothing for: no presets, the typed line still works", () => {
  assert.deepStrictEqual(payPresets(PRESETS, ""), []);
  assert.deepStrictEqual(payPresets(PRESETS, "Elsewhere"), []);
});
t("a script that predates the presets sends none: no crash", () => {
  assert.deepStrictEqual(payPresets(undefined, "Path"), []);
  assert.deepStrictEqual(payPresets({}, "Path"), []);
  assert.deepStrictEqual(payPresets({Path:"lots"}, "Path"), []);
});
t("a preset that isn't a plan is dropped, not drawn", () =>
  assert.deepStrictEqual(payPresets({Path:[null, {kind:"flat", amount:300}, {kind:"monthly", amount:0}, {kind:"monthly"}, {kind:"full", amount:-5}, {kind:"monthly", amount:300}]}, "Path"),
    [{kind:"monthly", amount:300}]));
t("every preset is something the typed line would also accept", () => {
  for(const prog of Object.keys(PRESETS)) for(const x of payPresets(PRESETS, prog))
    assert.deepStrictEqual(payEntry(x.kind, x.amount == null ? "" : String(x.amount)), {kind:x.kind, amount:x.amount});
});

t("the preset a mentee is on lights up", () => assert.strictEqual(paySame({kind:"monthly", amount:275}, p("monthly", 275, "$275/mo")), true));
t("another amount doesn't", () => assert.strictEqual(paySame({kind:"monthly", amount:300}, p("monthly", 275)), false));
t("another kind at the same number doesn't", () => assert.strictEqual(paySame({kind:"pct", amount:6}, p("monthly", 6)), false));
t("nothing set lights nothing", () => assert.strictEqual(paySame({kind:"pct", amount:6}, null), false));
t("a percent with no rate isn't the 6% preset", () => assert.strictEqual(paySame({kind:"pct", amount:6}, p("pct", null)), false));
t("a percent with no rate is the no-rate preset", () => assert.strictEqual(paySame({kind:"pct", amount:null}, p("pct", null)), true));

t("the editor opens on the plan they have", () => assert.deepStrictEqual(payDraft(p("monthly", 275), payPresets(PRESETS, "Path")), {kind:"monthly", amount:"275"}));
t("a percent with no rate opens with the amount empty", () => assert.deepStrictEqual(payDraft(p("pct", null), payPresets(PRESETS, "Path")), {kind:"pct", amount:""}));
t("nothing set on a Dojo row opens on its first preset's kind, paid in full", () => assert.deepStrictEqual(payDraft(null, payPresets(PRESETS, "Dojo")), {kind:"full", amount:""}));
t("nothing set on a Path row opens on dollars a month", () => assert.deepStrictEqual(payDraft(null, payPresets(PRESETS, "Path")), {kind:"monthly", amount:""}));
t("no presets at all opens on dollars a month", () => { assert.deepStrictEqual(payDraft(null, []), {kind:"monthly", amount:""}); assert.deepStrictEqual(payDraft(null, undefined), {kind:"monthly", amount:""}); });
t("a cell the hub can't read opens blank, not on its words", () => assert.deepStrictEqual(payDraft(p("other", null, "ask Ben"), payPresets(PRESETS, "Masters")), {kind:"monthly", amount:""}));

t("typed: plain dollars", () => assert.deepStrictEqual(payEntry("monthly", "475"), {kind:"monthly", amount:475}));
t("typed: a $ sign, a comma and spaces are fine", () => assert.deepStrictEqual(payEntry("monthly", " $1,250 "), {kind:"monthly", amount:1250}));
t("typed: cents", () => assert.deepStrictEqual(payEntry("full", "120.50"), {kind:"full", amount:120.5}));
t("typed: a percent with its sign", () => assert.deepStrictEqual(payEntry("pct", "4.5%"), {kind:"pct", amount:4.5}));
t("typed: a percent with nothing typed goes in without a rate", () => assert.deepStrictEqual(payEntry("pct", ""), {kind:"pct", amount:null}));
t("typed: a flat plan with nothing typed is refused", () => assert.strictEqual(payEntry("monthly", "").error, "Type the amount."));
t("typed: paid in full with nothing typed is refused", () => assert.strictEqual(payEntry("full", "  ").error, "Type the amount."));
t("typed: words are refused", () => assert.strictEqual(payEntry("monthly", "three hundred").error, "That isn't a number."));
t("typed: two decimal points are refused", () => assert.strictEqual(payEntry("monthly", "4.5.0").error, "That isn't a number."));
t("typed: a minus sign is refused", () => assert.strictEqual(payEntry("monthly", "-300").error, "That isn't a number."));
t("typed: zero is refused", () => assert.strictEqual(payEntry("monthly", "0").error, "It has to be above zero."));
t("typed: a percent over 100 is refused", () => assert.strictEqual(payEntry("pct", "250").error, "A percent can't be over 100."));
t("typed: a silly amount is refused", () => assert.strictEqual(payEntry("monthly", "5000000").error, "That's too large to be right."));
t("typed: an unknown kind is refused", () => assert.strictEqual(payEntry("flat", "300").error, "Pick a plan first."));
t("typed: amounts are kept to the cent", () => assert.deepStrictEqual(payEntry("monthly", "12.994"), {kind:"monthly", amount:12.99}));
console.log(`all ${n} passed`);

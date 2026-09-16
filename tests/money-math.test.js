// node tests/money-math.test.js
// The Money tab's arithmetic, pulled out of index.html (the MONEY_MATH block)
// and run under node: cents rounding, splits that always add back up, the
// worked example from the design, every settlement state, and the defaults a
// payer's next entry starts from.
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const block = src.match(/\/\*MONEY_MATH_BEGIN\*\/([\s\S]*?)\/\*MONEY_MATH_END\*\//);
if(!block){ console.error("FAIL: no MONEY_MATH block in index.html"); process.exit(1); }
const M = new Function(block[1] + "\n;return {mNum, mCents, mPctCents, mFmt, mShares, mCampaignOf, mCampaignEnd, mCampaignKey, " +
  "mTally, mStatus, mUnsettled, mLastPlan, mPerson, mSplitLabel, mCheck, mEntryLine, mNewId};")();

let seq = 0;
const nextId = () => "mt" + String(++seq).padStart(6, "0");
const inc = o => Object.assign({id:nextId(), kind:"income", date:"2026-09-10", campaign:"Fall 2026", who:"Ben", party:"Jordan Test",
  repId:"", plan:"flat", amount:100, benPct:60, status:"live", createdAt:"2026-09-10T10:00:00.000Z"}, o);
const exp = o => Object.assign({id:nextId(), kind:"expense", date:"2026-09-11", campaign:"Fall 2026", who:"Alan", party:"Zoom",
  category:"Software", amount:10, benPct:60, status:"live", createdAt:"2026-09-11T10:00:00.000Z"}, o);
const stl = o => Object.assign({id:nextId(), kind:"settle", date:"2027-01-03", campaign:"Fall 2026", who:"Ben", to:"Alan",
  amount:1, status:"live", createdAt:"2027-01-03T10:00:00.000Z"}, o);
/* The design's worked example: $10,000 in with Ben; Alan paid $500 out, Ben $300. */
const EXAMPLE = () => [inc({amount:10000}), exp({amount:500, who:"Alan"}), exp({amount:300, who:"Ben"})];

const cases = [
  ["cents round half up, even where floats don't", () => {
    assert.strictEqual(M.mCents(1.005), 101);
    assert.strictEqual(M.mCents("19.99"), 1999);
    assert.strictEqual(M.mCents(0.1 + 0.2), 30);
    assert.strictEqual(M.mCents(120), 12000);
  }],
  ["numbers read the way the script reads them", () => {
    assert.strictEqual(M.mNum("$1,200.50"), 1200.5);
    assert.strictEqual(M.mNum(""), null);
    assert.ok(Number.isNaN(M.mNum("12abc")));
    assert.ok(Number.isNaN(M.mNum("-5")));
  }],
  ["a % amount is commission sales × rate, to the cent", () => {
    assert.strictEqual(M.mPctCents(12345.67, 8), 98765);
    assert.strictEqual(M.mPctCents(100.5, 1), 101);
    assert.strictEqual(M.mPctCents(2000, 7.5), 15000);
  }],
  ["money reads like money", () => {
    assert.strictEqual(M.mFmt(418000), "$4,180.00");
    assert.strictEqual(M.mFmt(-12000), "−$120.00");
    assert.strictEqual(M.mFmt(5), "$0.05");
    assert.strictEqual(M.mFmt(123456789), "$1,234,567.89");
    assert.strictEqual(M.mFmt(0), "$0.00");
  }],
  ["an entry's two shares always add back up to the entry", () => {
    for(const [amount, benPct] of [[0.01, 60], [333.33, 60], [15.99, 60], [100, 50], [7.77, 66.67], [250, 100], [250, 0]]){
      const s = M.mShares({amount, benPct});
      assert.strictEqual(s.Ben + s.Alan, M.mCents(amount), `${amount} at ${benPct}%`);
    }
    assert.deepStrictEqual(M.mShares({amount:15.99, benPct:60}), {Ben:959, Alan:640});
  }],
  ["the worked example: Ben owes Alan $4,180.00", () => {
    const t = M.mTally(EXAMPLE());
    assert.deepStrictEqual([t.income, t.expense, t.profit], [1000000, 80000, 920000]);
    assert.deepStrictEqual(t.share, {Ben:552000, Alan:368000});
    assert.deepStrictEqual(t.holds, {Ben:970000, Alan:-50000});
    assert.strictEqual(t.owedToBen, -418000);
    assert.strictEqual(t.uniform, true);
    assert.strictEqual(t.count, 3);
  }],
  ["a settle-up for the full amount makes it square, and isn't income or expense", () => {
    const t = M.mTally(EXAMPLE().concat([stl({who:"Ben", to:"Alan", amount:4180})]));
    assert.strictEqual(t.owedToBen, 0);
    assert.deepStrictEqual(t.holds, {Ben:552000, Alan:368000});
    assert.deepStrictEqual([t.income, t.expense, t.profit], [1000000, 80000, 920000]);
  }],
  ["void entries count for nothing", () => {
    const t = M.mTally(EXAMPLE().concat([inc({amount:999, status:"void"}), stl({amount:50, status:"void"})]));
    assert.deepStrictEqual([t.income, t.count, t.settles.length, t.owedToBen], [1000000, 3, 0, -418000]);
  }],
  ["income that landed with Alan leaves Alan owing Ben his share", () => {
    assert.strictEqual(M.mTally([inc({amount:200, who:"Alan"})]).owedToBen, 12000);
  }],
  ["any split other than 60/40 marks the totals as mixed", () => {
    assert.strictEqual(M.mTally([inc({benPct:50})]).uniform, false);
    assert.strictEqual(M.mTally([stl()]).uniform, true);
  }],
  ["campaigns follow the hub's calendar months", () => {
    for(const [iso, want] of [["2026-01-01", "Spring 2026"], ["2026-04-30", "Spring 2026"], ["2026-05-01", "Summer 2026"],
                              ["2026-08-31", "Summer 2026"], ["2026-09-01", "Fall 2026"], ["2026-12-31", "Fall 2026"]])
      assert.strictEqual(M.mCampaignOf(iso), want, iso);
    assert.strictEqual(M.mCampaignEnd("Spring 2027"), "2027-04-30");
    assert.strictEqual(M.mCampaignEnd("Summer 2026"), "2026-08-31");
    assert.strictEqual(M.mCampaignEnd("Fall 2026"), "2026-12-31");
    assert.ok(M.mCampaignKey("Fall 2026") > M.mCampaignKey("Summer 2026"));
    assert.ok(M.mCampaignKey("Spring 2027") > M.mCampaignKey("Fall 2026"));
  }],
  ["state: empty when nothing live is logged", () => {
    assert.strictEqual(M.mStatus([inc({status:"void"})], [], "Fall 2026", "2026-10-01").state, "empty");
  }],
  ["state: running while the campaign is still on", () => {
    const s = M.mStatus(EXAMPLE(), [], "Fall 2026", "2026-12-31");
    assert.deepStrictEqual([s.state, s.debtor, s.creditor, s.owed, s.end, s.ended], ["running", "Ben", "Alan", 418000, "2026-12-31", false]);
  }],
  ["state: due once the campaign has ended", () => {
    assert.strictEqual(M.mStatus(EXAMPLE(), [], "Fall 2026", "2027-01-01").state, "due");
  }],
  ["state: settled, naming the latest settle-up", () => {
    const s = M.mStatus(EXAMPLE().concat([stl({amount:4000, date:"2027-01-02"}), stl({amount:180, date:"2027-01-05"})]), [], "Fall 2026", "2027-01-06");
    assert.deepStrictEqual([s.state, s.last.amount, s.owed], ["settled", 180, 0]);
  }],
  ["state: reopened when an entry lands after the settle-up", () => {
    const s = M.mStatus(EXAMPLE().concat([stl({amount:4180}), exp({amount:45, who:"Alan", date:"2027-01-04"})]), [], "Fall 2026", "2027-01-06");
    assert.deepStrictEqual([s.state, s.debtor, s.creditor, s.owed], ["reopened", "Ben", "Alan", 2700]);
  }],
  ["state: square when nothing is owed and nothing was settled", () => {
    assert.strictEqual(M.mStatus([inc({amount:100, benPct:100})], [], "Fall 2026", "2027-01-06").state, "square");
  }],
  ["state: blocked by a problem row in the campaign, or one whose campaign can't be read", () => {
    assert.strictEqual(M.mStatus(EXAMPLE(), [{row:5, campaign:"Fall 2026", error:"x"}], "Fall 2026", "2027-01-06").state, "blocked");
    assert.strictEqual(M.mStatus(EXAMPLE(), [{row:5, campaign:"Summer 2026", error:"x"}], "Fall 2026", "2027-01-06").state, "due");
    assert.strictEqual(M.mStatus(EXAMPLE(), [{row:5, campaign:"", error:"x"}], "Fall 2026", "2027-01-06").state, "blocked");
  }],
  ["unsettled lists ended campaigns that still need settling, oldest first", () => {
    const entries = EXAMPLE().concat([inc({campaign:"Summer 2026", date:"2026-06-01", amount:50}),
                                      inc({campaign:"Spring 2026", date:"2026-02-01", amount:50, benPct:100})]);
    assert.deepStrictEqual(M.mUnsettled(entries, [], "2027-01-06").map(s => s.campaign + ":" + s.state), ["Summer 2026:due", "Fall 2026:due"]);
    assert.deepStrictEqual(M.mUnsettled(entries, [], "2026-12-01").map(s => s.campaign), ["Summer 2026"]);
    assert.deepStrictEqual(M.mUnsettled([], [{row:3, campaign:"Spring 2026", error:"x"}], "2027-01-06").map(s => s.state), ["blocked"]);
  }],
  ["a payer's next entry starts from their latest live plan", () => {
    const entries = [
      inc({repId:"t01", plan:"pct", base:1000, rate:8, amount:80, date:"2026-09-01"}),
      inc({repId:"t01", plan:"flat", amount:150, date:"2026-10-01"}),
      inc({repId:"t01", plan:"pct", base:100, rate:9, amount:9, date:"2026-11-01", status:"void"}),
      inc({party:"Casey Other", plan:"pct", base:100, rate:10, amount:10, date:"2026-12-01"}),
    ];
    assert.deepStrictEqual(M.mLastPlan(entries, "Jordan Test", "t01"), {plan:"flat", rate:null, amount:150});
    assert.deepStrictEqual(M.mLastPlan(entries, "casey other", ""), {plan:"pct", rate:10, amount:null});
    assert.strictEqual(M.mLastPlan(entries, "Nobody", ""), null);
    assert.strictEqual(M.mLastPlan(entries, "", ""), null);
  }],
  ["who-am-I maps to Alan or Ben by first word", () => {
    assert.strictEqual(M.mPerson("alan h"), "Alan");
    assert.strictEqual(M.mPerson(" BEN"), "Ben");
    assert.strictEqual(M.mPerson("someone"), "");
    assert.strictEqual(M.mPerson("Benjamin"), "");
  }],
  ["split labels", () => {
    assert.strictEqual(M.mSplitLabel(60), "60/40");
    assert.strictEqual(M.mSplitLabel(50), "50/50");
    assert.strictEqual(M.mSplitLabel(100), "all Ben");
    assert.strictEqual(M.mSplitLabel(0), "all Alan");
    assert.strictEqual(M.mSplitLabel(66.67), "66.67/33.33");
  }],
  ["the drawer's checks pass a good entry and name the first thing wrong", () => {
    const ok = {kind:"income", date:"2026-09-16", campaign:"Fall 2026", who:"Ben", party:"Jordan", plan:"flat", amount:"250", benPct:60};
    assert.strictEqual(M.mCheck(ok), "");
    assert.strictEqual(M.mCheck(Object.assign({}, ok, {date:""})), "Date must be a real day, written YYYY-MM-DD");
    assert.strictEqual(M.mCheck(Object.assign({}, ok, {plan:"pct", base:"1,000", rate:"10", amount:""})), "");
    assert.strictEqual(M.mCheck({kind:"settle", date:"2027-01-03", campaign:"Fall 2026", who:"Ben", to:"Alan", amount:"4180"}), "");
  }],
  ["an entry reads as one line for the conflict dialog", () => {
    assert.strictEqual(M.mEntryLine(inc({amount:250, date:"2026-09-16"})), "2026-09-16 · Jordan Test, Ben received · $250.00 · 60/40");
    assert.strictEqual(M.mEntryLine({kind:"income", date:"2026-09-16", who:"Ben", party:"Jordan", plan:"pct", base:"12345.67", rate:"8", benPct:60}),
                       "2026-09-16 · Jordan, Ben received · $987.65 · 60/40");
    assert.strictEqual(M.mEntryLine(exp({amount:15.99, date:"2026-09-17", status:"void"})), "2026-09-17 · Zoom, Alan paid · $15.99 · 60/40 · void");
    assert.strictEqual(M.mEntryLine(stl({amount:4180, date:"2027-01-03"})), "2027-01-03 · Ben → Alan · $4,180.00");
  }],
  ["new IDs are the shape the script accepts, and never repeat", () => {
    const ids = new Set(Array.from({length:500}, () => M.mNewId()));
    assert.strictEqual(ids.size, 500);
    for(const id of ids) assert.match(id, /^[A-Za-z0-9_-]{6,40}$/);
  }],
];

let fail = 0;
for(const [label, fn] of cases){
  try{ fn(); console.log("ok   " + label); }
  catch(e){ fail++; console.log("FAIL " + label + "\n     " + String(e && e.message).split("\n").join("\n     ")); }
}
console.log(fail ? `\n${fail} of ${cases.length} failing` : `\nall ${cases.length} passing`);
process.exit(fail ? 1 : 0);

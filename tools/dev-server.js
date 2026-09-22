#!/usr/bin/env node
// Preview the hub on this machine with fake backends, so the Money tab and the
// Call Attendance make-ups can be driven end to end without touching Google or
// the shared hub copy.
//
//   node tools/dev-server.js        → http://localhost:8830/#money   (coach key: dev)
//                                     http://localhost:8830/#attend
//
// The page it serves is index.html with three constants rewritten; nothing in
// index.html knows about this server:
//   SYNC.url  → ""        hub sync off — the shared calendar is never read or written
//   TEAM_API  → /__team   invented mentees, and an in-memory assignments sheet
//                         (catalog, per-mentee overrides, submissions)
//   MONEY_API → /__money  the real SNA-Money.gs, running on in-memory fakes
// It refuses to start if any of the three can't be found, rather than serve a
// page that talks to the real backends.
//
//   SLOW=1500 node tools/dev-server.js      every backend reply takes 1.5 s
//   MONEY_KEY=other node tools/dev-server.js the money script expects a different key than the roster
//   NO_KEY=1 node tools/dev-server.js        the money script has no MONEY_KEY set at all
//   FAIL_HISTORY=1 node tools/dev-server.js  every History write fails (the entry itself still saves)
//   curl -X POST localhost:8830/__fail -d 2  the next 2 money calls get an HTML error page,
//                                           the way Apps Script's /exec sometimes answers
//   curl -X POST localhost:8830/__cell -d '{"book":"test","row":2,"col":5,"value":"lots"}'
//                                           a hand edit in the sheet (row 1 is the header)
//   curl -X POST localhost:8830/__submit -d '{"repId":"t02","assignmentId":"A1","text":"posted it"}'
//                                           a mentee turns something in from their dashboard
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const {makeGas, loadGs} = require("../tests/gas-fakes.js");

const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.PORT || 8830);
const SLOW = Number(process.env.SLOW || 0);
const KEY = "dev";

const REWRITES = [
  [/(url:\s*)"https:\/\/script\.google\.com\/macros\/s\/[^"]+\/exec"/, '$1""', "SYNC.url"],
  [/(const TEAM_API = )"https:\/\/script\.google\.com\/macros\/s\/[^"]+\/exec"/, '$1"/__team"', "TEAM_API"],
  [/(const MONEY_API\s*= )"[^"]*"/, '$1"/__money"', "MONEY_API"],
];
function page(){
  let html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  for(const [re, to, name] of REWRITES){
    if(!re.test(html)) throw new Error(`couldn't find ${name} in index.html — refusing to serve a page that would talk to a real backend`);
    html = html.replace(re, to);
  }
  if(/script\.google\.com\/macros\/s\//.test(html)) throw new Error("a script.google.com web app URL is still in the page after the rewrites — refusing to serve it");
  return html;
}
page();                                              // fail at start, not on the first request

const gas = makeGas({props:process.env.NO_KEY ? {} : {MONEY_KEY:process.env.MONEY_KEY || KEY},
                    failSheet:process.env.FAIL_HISTORY ? {History:"Service Spreadsheets timed out"} : {}});
const money = loadGs(path.join(ROOT, "SNA-Money.gs"), gas.globals);
const ROSTER = [
  ["t01", "Jordan Sample", "The Path", "Alan"], ["t02", "Casey Example", "The Dojo"], ["t03", "Riley Placeholder", "Masters", "Ben"],
  ["t04", "Morgan Testcase", "The Path", "Ben"], ["t05", "Quinn Former", "The Path", "", false],
  ["t06", "Sam Standin", "The Dojo"], ["t07", "Drew Dummy", "The Dojo"], ["t08", "Kai Mockup", "Masters", "Alan"],
].map(([RepID, Name, Program, Coach = "", Active = true]) => ({RepID, Name, Program, Tier:Program.replace("The ", ""), Active, OnRoster:true,
  CutcoRepNo:"", Phone:"", Email:"", Division:"", Manager:"", ManagerPhone:"", ManagerEmail:"", CareerSales:"", Joined:"", Coach, Goal:"", JoinWeek:""}));
/* the assignments sheet, the way the check-in script's assignmentBoard hands
   it over: catalog rows, per-mentee overrides (a date, or "NA"), submissions */
const BOARD = {assignments:[], overrides:[], submissions:[]};
let nextAssign = 0, nextSub = 0;
let failNext = 0;

function team(body){
  if(body.key !== KEY) return {ok:false, error:"bad key"};
  if(body.action === "coachRoster") return {ok:true, reps:ROSTER, coaches:[{Name:"Alan", Phone:""}, {Name:"Ben", Phone:""}]};
  if(body.action === "getSettings") return {ok:true, switches:{texts:false, digest:false, emails:false, replinks:false, assignments:false}};
  if(body.action === "assignmentBoard") return {ok:true, assignments:BOARD.assignments, overrides:BOARD.overrides, submissions:BOARD.submissions,
    reps:ROSTER.map(r => ({RepID:r.RepID, Name:r.Name, Tier:r.Tier, Active:r.Active, HasEmail:false}))};
  if(body.action === "saveAssignment"){
    const a = body.a || {};
    let row = a.id && BOARD.assignments.find(x => x.AssignmentID === a.id);
    if(a.id && !row) return {ok:false, error:"no assignment " + a.id};
    if(!row){ row = {AssignmentID:"A" + (++nextAssign)}; BOARD.assignments.push(row); }
    Object.assign(row, {Programs:(a.programs || []).join(", "), Campaign:a.campaign || "", Title:a.title || "", Instructions:a.instructions || "",
      MaterialsURL:a.materialsUrl || "", DueDate:a.dueDate || "", Active:a.active === false ? "N" : "Y"});
    console.log(`[assignments] ${a.id ? "saved" : "created"} ${row.AssignmentID} · ${row.Title} · ${row.Programs} · active ${row.Active}`);
    return {ok:true, id:row.AssignmentID};
  }
  if(body.action === "setOverride"){
    const i = BOARD.overrides.findIndex(o => o.AssignmentID === body.assignmentId && o.RepID === body.repId);
    if(i >= 0) BOARD.overrides.splice(i, 1);
    if(body.dueDate) BOARD.overrides.push({AssignmentID:body.assignmentId, RepID:body.repId, DueDate:body.dueDate});
    return {ok:true};
  }
  if(body.action === "reviewSubmission"){
    const sub = BOARD.submissions.find(x => x.SubmissionID === body.submissionId);
    if(!sub) return {ok:false, error:"no submission " + body.submissionId};
    Object.assign(sub, {Status:body.status, Feedback:body.feedback || "", ReviewedBy:body.by || "", ReviewedAt:new Date().toISOString()});
    return {ok:true, emailed:false, hasEmail:false};
  }
  if(body.action === "remindAssignment") return {ok:true, emailed:false, hasEmail:false};
  return {ok:false, error:"the dev server doesn't fake " + body.action};
}

http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const send = (code, type, body) => { res.writeHead(code, {"Content-Type":type, "Cache-Control":"no-store"}); res.end(body); };
  if(req.method === "POST" && ["/__money", "/__team", "/__fail", "/__cell", "/__submit"].includes(url.pathname)){
    let data = "";
    req.on("data", chunk => { data += chunk; });
    req.on("end", () => {
      if(url.pathname === "/__fail"){ failNext = Number(data) || 1; return send(200, "text/plain", `next ${failNext} money call(s) fail\n`); }
      if(url.pathname === "/__submit"){
        try{
          const b = JSON.parse(data), prior = BOARD.submissions.filter(x => x.AssignmentID === b.assignmentId && x.RepID === b.repId).length;
          BOARD.submissions.push({SubmissionID:"S" + (++nextSub), AssignmentID:b.assignmentId, RepID:b.repId, Version:String(prior + 1), Text:b.text || "",
            LinkURL:"", FileURL:"", FileName:"", SubmittedAt:new Date().toISOString(), Status:"submitted", Feedback:"", ReviewedBy:"", ReviewedAt:""});
          return send(200, "text/plain", `${b.repId} turned in ${b.assignmentId}\n`);
        }catch(e){ return send(400, "text/plain", String(e.message) + "\n"); }
      }
      if(url.pathname === "/__cell"){
        try{
          const c = JSON.parse(data), ss = [...gas.state.spreadsheets.values()][0];
          const sh = ss && ss.getSheetByName(c.book === "live" ? "Ledger" : "Test");
          if(!sh) throw new Error("that tab doesn't exist yet — save an entry first");
          sh.put(Number(c.row), Number(c.col), c.value);
          return send(200, "text/plain", `row ${c.row} col ${c.col} is now ${JSON.stringify(sh.get(Number(c.row), Number(c.col)))}\n`);
        }catch(e){ return send(400, "text/plain", String(e.message) + "\n"); }
      }
      if(url.pathname === "/__money" && failNext > 0){
        failNext--;
        return setTimeout(() => send(200, "text/html", "<html><body>Sorry, unable to open the file at this time.</body></html>"), SLOW);
      }
      let out;
      try{
        out = url.pathname === "/__team" ? team(JSON.parse(data || "{}"))
                                         : JSON.parse(money.doPost({postData:{contents:data}}).getContent());
      }catch(e){ out = {ok:false, error:String((e && e.message) || e)}; }
      for(const line of gas.state.logs.splice(0)) console.log("[SNA-Money.gs] " + line);     // what Apps Script's Executions log would show
      setTimeout(() => send(200, "application/json", JSON.stringify(out)), SLOW);
    });
    return;
  }
  if(req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")){
    try{ return send(200, "text/html; charset=utf-8", page()); }
    catch(e){ return send(500, "text/plain", e.message); }
  }
  send(404, "text/plain", "not found");
}).listen(PORT, () => console.log(`hub with fake backends: http://localhost:${PORT}/#money · coach key "${KEY}" · data lives in memory until this stops`));

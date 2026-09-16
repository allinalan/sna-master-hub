#!/usr/bin/env node
// Preview the hub on this machine with fake backends, so the Money tab can be
// driven end to end without touching Google or the shared hub copy.
//
//   node tools/dev-server.js        → http://localhost:8830/#money   (coach key: dev)
//
// The page it serves is index.html with three constants rewritten; nothing in
// index.html knows about this server:
//   SYNC.url  → ""        hub sync off — the shared calendar is never read or written
//   TEAM_API  → /__team   invented mentees, so the payer picker has names
//   MONEY_API → /__money  the real SNA-Money.gs, running on in-memory fakes
// It refuses to start if any of the three can't be found, rather than serve a
// page that talks to the real backends.
//
//   SLOW=1500 node tools/dev-server.js      every backend reply takes 1.5 s
//   MONEY_KEY=other node tools/dev-server.js the money script expects a different key than the roster
//   NO_KEY=1 node tools/dev-server.js        the money script has no MONEY_KEY set at all
//   curl -X POST localhost:8830/__fail -d 2  the next 2 money calls get an HTML error page,
//                                           the way Apps Script's /exec sometimes answers
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
  return html;
}
page();                                              // fail at start, not on the first request

const gas = makeGas({props:process.env.NO_KEY ? {} : {MONEY_KEY:process.env.MONEY_KEY || KEY}});
const money = loadGs(path.join(ROOT, "SNA-Money.gs"), gas.globals);
const ROSTER = [
  ["t01", "Jordan Sample", "The Path"], ["t02", "Casey Example", "The Dojo"], ["t03", "Riley Placeholder", "Masters"],
  ["t04", "Morgan Testcase", "The Path"], ["t05", "Quinn Former", "The Path", false],
].map(([RepID, Name, Program, Active = true]) => ({RepID, Name, Program, Tier:Program.replace("The ", ""), Active, OnRoster:true,
  CutcoRepNo:"", Phone:"", Email:"", Division:"", Manager:"", ManagerPhone:"", ManagerEmail:"", CareerSales:"", Joined:"", Coach:"", Goal:"", JoinWeek:""}));
let failNext = 0;

function team(body){
  if(body.key !== KEY) return {ok:false, error:"bad key"};
  if(body.action === "coachRoster") return {ok:true, reps:ROSTER, coaches:[{Name:"Alan", Phone:""}, {Name:"Ben", Phone:""}]};
  if(body.action === "getSettings") return {ok:true, switches:{texts:false, digest:false, emails:false, replinks:false, assignments:false}};
  return {ok:false, error:"the dev server only fakes coachRoster and getSettings"};
}

http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const send = (code, type, body) => { res.writeHead(code, {"Content-Type":type, "Cache-Control":"no-store"}); res.end(body); };
  if(req.method === "POST" && ["/__money", "/__team", "/__fail"].includes(url.pathname)){
    let data = "";
    req.on("data", chunk => { data += chunk; });
    req.on("end", () => {
      if(url.pathname === "/__fail"){ failNext = Number(data) || 1; return send(200, "text/plain", `next ${failNext} money call(s) fail\n`); }
      if(url.pathname === "/__money" && failNext > 0){
        failNext--;
        return setTimeout(() => send(200, "text/html", "<html><body>Sorry, unable to open the file at this time.</body></html>"), SLOW);
      }
      let out;
      try{
        out = url.pathname === "/__team" ? team(JSON.parse(data || "{}"))
                                         : JSON.parse(money.doPost({postData:{contents:data}}).getContent());
      }catch(e){ out = {ok:false, error:String((e && e.message) || e)}; }
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

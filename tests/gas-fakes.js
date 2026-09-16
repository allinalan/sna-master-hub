// In-memory stand-ins for the Apps Script services SNA-Money.gs uses, so the
// backend runs under node — for tests/money-backend.test.js and for
// tools/dev-server.js.
//
// The fake sheet copies the Sheets behaviours that have broken this repo
// before (hub sync PRs #14 and #15): setValues() runs any string that starts
// with "=" as a formula, and a formula made of prose reads back as "#ERROR!";
// a date- or number-looking string in a cell that isn't plain-text formatted
// comes back as a Date or a number. A leading ' keeps a string as text and
// isn't stored, as in Sheets.
"use strict";
const fs = require("fs");
const crypto = require("crypto");

const TZ = "America/Phoenix";                        // UTC-7 all year, so a date needs no DST logic

function makeGas(opts){
  const o = opts || {};
  const state = {props:new Map(Object.entries(o.props || {})), spreadsheets:new Map(), files:new Map(),
                 folders:new Map(), lockBusy:!!o.lockBusy, seq:0, flushes:0,
                 failSheet:o.failSheet || {},       // {TabName: "message"} — every range on that tab throws
                 driveDown:"",                      // a message here makes DriveApp's lookups throw it
                 logs:[],                           // what the script wrote to console (Apps Script's Executions log)
                 maxRows:o.maxRows || 1000};        // a new tab's size, as in Sheets; writing past it throws
  const newId = prefix => prefix + String(++state.seq).padStart(4, "0") + "Zx9";

  class Range {
    constructor(sheet, row, col, rows, cols){
      if(row < 1 || col < 1 || rows < 1 || cols < 1) throw new Error("The coordinates or dimensions of the range are invalid.");
      Object.assign(this, {sheet, row, col, rows, cols});
    }
    each(fn){ for(let i = 0; i < this.rows; i++) for(let j = 0; j < this.cols; j++) fn(this.row + i, this.col + j, i, j); }
    fits(grid){ return grid.length === this.rows && grid.every(line => line.length === this.cols); }
    getValues(){
      const out = [];
      for(let i = 0; i < this.rows; i++){ const line = []; for(let j = 0; j < this.cols; j++) line.push(this.sheet.get(this.row + i, this.col + j)); out.push(line); }
      return out;
    }
    getValue(){ return this.sheet.get(this.row, this.col); }
    setValues(grid){
      if(!this.fits(grid)) throw new Error(`The number of rows or columns in the data does not match the range (${this.rows}x${this.cols}).`);
      this.each((r, c, i, j) => this.sheet.put(r, c, grid[i][j]));
      return this;
    }
    setValue(v){ this.sheet.put(this.row, this.col, v); return this; }
    setNumberFormat(f){ this.each((r, c) => this.sheet.formats.set(r + ":" + c, f)); return this; }
    setNumberFormats(grid){
      if(!this.fits(grid)) throw new Error("The number formats do not match the range.");
      this.each((r, c, i, j) => this.sheet.formats.set(r + ":" + c, grid[i][j]));
      return this;
    }
  }

  class Sheet {
    constructor(name){ this.name = name; this.cells = new Map(); this.formats = new Map(); this.frozen = 0; this.maxRows = state.maxRows; }
    get(r, c){ const v = this.cells.get(r + ":" + c); return v === undefined ? "" : v; }
    put(r, c, v){
      const plain = this.formats.get(r + ":" + c) === "@";
      if(typeof v === "string"){
        if(v.startsWith("'")) v = v.slice(1);                                     // forced text
        else if(v.startsWith("=")) v = "#ERROR!";                                 // ran as a formula
        else if(!plain && /^\d{4}-\d{2}-\d{2}$/.test(v)){                         // became a date, midnight in Phoenix
          const [y, m, d] = v.split("-").map(Number); v = new Date(Date.UTC(y, m - 1, d, 7));
        }
        else if(!plain && /^-?\d+(\.\d+)?$/.test(v)) v = Number(v);             // became a number
      }
      if(v === "" || v === null || v === undefined) this.cells.delete(r + ":" + c); else this.cells.set(r + ":" + c, v);
    }
    getName(){ return this.name; }
    setName(n){ this.name = n; return this; }
    getRange(row, col, rows, cols){
      if(state.failSheet[this.name]) throw new Error(state.failSheet[this.name]);
      const n = rows === undefined ? 1 : rows;
      if(row + n - 1 > this.maxRows) throw new Error("The coordinates of the range are outside the dimensions of the sheet.");
      return new Range(this, row, col, n, cols === undefined ? 1 : cols);
    }
    getMaxRows(){ return this.maxRows; }
    insertRowsAfter(after, how){ if(after > this.maxRows) throw new Error("Those rows are out of bounds."); this.maxRows += how; return this; }
    getLastRow(){ let m = 0; for(const k of this.cells.keys()) m = Math.max(m, Number(k.split(":")[0])); return m; }
    getLastColumn(){ let m = 0; for(const k of this.cells.keys()) m = Math.max(m, Number(k.split(":")[1])); return m; }
    setFrozenRows(n){ this.frozen = n; return this; }
  }

  class Spreadsheet {
    constructor(name){ this.id = newId("ss"); this.name = name; this.sheets = [new Sheet("Sheet1")]; this.trashed = false; }
    getId(){ return this.id; }
    getName(){ return this.name; }
    getUrl(){ return "https://docs.google.com/spreadsheets/d/" + this.id + "/edit"; }
    getSheets(){ return this.sheets.slice(); }
    getSheetByName(n){ return this.sheets.find(s => s.name === n) || null; }
    insertSheet(n){
      if(this.getSheetByName(n)) throw new Error(`A sheet with the name "${n}" already exists.`);
      const s = new Sheet(n); this.sheets.push(s); return s;
    }
    getSpreadsheetTimeZone(){ return TZ; }
  }
  const SpreadsheetApp = {
    create(name){ const ss = new Spreadsheet(name); state.spreadsheets.set(ss.id, ss); return ss; },
    openById(id){
      const ss = state.spreadsheets.get(id);
      if(!ss) throw new Error("Unexpected error while getting the method or property openById on object SpreadsheetApp.");
      return ss;
    },
    flush(){ state.flushes++; }
  };

  const iterate = list => { let i = 0; return {hasNext:() => i < list.length, next:() => list[i++]}; };
  class Folder {
    constructor(name, parentId){ this.id = newId("fo"); this.name = name; this.parents = parentId ? [parentId] : []; this.trashed = false; state.folders.set(this.id, this); }
    getId(){ return this.id; }
    getName(){ return this.name; }
    isTrashed(){ return this.trashed; }
    setTrashed(t){ this.trashed = !!t; return this; }
    createFolder(name){ return new Folder(name, this.id); }
    createFile(blob){ return new DriveFile(blob, this.id); }
  }
  class DriveFile {
    constructor(blob, parentId){ this.id = newId("fi"); this.blob = blob; this.name = blob.getName(); this.parents = [parentId]; this.description = null; this.trashed = false; state.files.set(this.id, this); }
    getId(){ return this.id; }
    getName(){ return this.name; }
    getDescription(){ return this.description; }
    setDescription(d){ this.description = d; return this; }
    isTrashed(){ return this.trashed; }
    setTrashed(t){ this.trashed = !!t; return this; }
    getParents(){ return iterate(this.parents.map(id => state.folders.get(id)).filter(Boolean)); }
    getBlob(){ return this.blob; }
  }
  const down = () => { if(state.driveDown) throw new Error(state.driveDown); };
  const DriveApp = {
    createFolder(name){ down(); return new Folder(name, null); },
    getFolderById(id){ down(); const f = state.folders.get(id); if(!f) throw new Error("No item with the given ID could be found."); return f; },
    getFileById(id){
      down();
      const ss = state.spreadsheets.get(id);                  // a spreadsheet is a Drive file too
      if(ss) return {getId:() => ss.id, getName:() => ss.name, isTrashed:() => ss.trashed, setTrashed(t){ ss.trashed = !!t; return this; }};
      const f = state.files.get(id); if(!f) throw new Error("No item with the given ID could be found."); return f;
    }
  };

  const signed = buf => Array.from(buf, b => (b > 127 ? b - 256 : b));           // Apps Script bytes are signed
  const unsigned = bytes => Buffer.from(bytes.map(b => b & 255));
  const Utilities = {
    DigestAlgorithm:{SHA_256:"SHA_256"},
    base64Decode(s){
      if(typeof s !== "string" || s.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(s)) throw new Error("Could not decode string.");
      return signed(Buffer.from(s, "base64"));
    },
    base64Encode(bytes){ return unsigned(bytes).toString("base64"); },
    computeDigest(alg, bytes){
      if(alg !== "SHA_256") throw new Error("the fake only digests SHA_256");
      return signed(crypto.createHash("sha256").update(unsigned(bytes)).digest());
    },
    newBlob(bytes, mime, name){
      let n = name;
      return {getBytes:() => bytes.slice(), getContentType:() => mime, getName:() => n, setName(v){ n = v; return this; }};
    },
    formatDate(date, tz, pattern){
      if(pattern !== "yyyy-MM-dd") throw new Error("the fake only formats yyyy-MM-dd");
      const parts = new Intl.DateTimeFormat("en-CA", {timeZone:tz, year:"numeric", month:"2-digit", day:"2-digit"}).formatToParts(date);
      const get = t => parts.find(p => p.type === t).value;
      return `${get("year")}-${get("month")}-${get("day")}`;
    }
  };

  const PropertiesService = {getScriptProperties:() => ({
    getProperty:k => (state.props.has(k) ? state.props.get(k) : null),
    setProperty(k, v){ state.props.set(k, String(v)); return this; },
    deleteProperty(k){ state.props.delete(k); return this; }
  })};
  const LockService = {getScriptLock:() => ({
    tryLock:() => !state.lockBusy,
    waitLock(){ if(state.lockBusy) throw new Error("Lock timeout: another process was holding the lock for too long."); },
    releaseLock(){}
  })};
  const ContentService = {
    MimeType:{JSON:"application/json"},
    createTextOutput(s){ return {setMimeType(){ return this; }, getContent:() => s}; }
  };
  const Logger = {log(){}};
  const console = {error:(...a) => state.logs.push(a.join(" ")), log:(...a) => state.logs.push(a.join(" "))};

  return {globals:{SpreadsheetApp, DriveApp, PropertiesService, LockService, ContentService, Utilities, Logger, console}, state};
}

/* Run a .gs file with the fakes as its globals. Returns its entry points plus
   call()/get(), which speak JSON the way the hub does. */
function loadGs(file, globals){
  const src = fs.readFileSync(file, "utf8");
  const names = Object.keys(globals);
  const api = new Function(...names, src + "\n;return {doGet, doPost};")(...names.map(n => globals[n]));
  api.call = body => JSON.parse(api.doPost({postData:{contents:JSON.stringify(body)}}).getContent());
  api.get = () => JSON.parse(api.doGet({parameter:{}}).getContent());
  return api;
}

module.exports = {makeGas, loadGs};

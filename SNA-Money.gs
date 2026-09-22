/**
 * Sharp Ninja Academy — Master Hub · Money
 * ─────────────────────────────────────────────────────────────────────────
 * The private ledger behind the hub's Money tab: income, expenses and
 * settle-ups between Alan and Ben, one row each in the "SNA Money" Google
 * Sheet, receipts in the "SNA Money Receipts" Drive folder.
 *
 * Every call needs the key held in Script Properties as MONEY_KEY — the same
 * value as the coach key. This file lives in a public repo next to a public
 * page, so it holds no secrets; the script records its own sheet and folder
 * IDs in Script Properties the first time it needs them.
 *
 * DEPLOY (once): script.google.com ▸ New project "SNA Money" ▸ paste this
 *   file ▸ Deploy ▸ New deployment ▸ Web app ▸ Execute as: Me ▸ Who has
 *   access: Anyone ▸ copy the /exec URL into MONEY_API in index.html.
 *   Project Settings ▸ Script properties ▸ MONEY_KEY = the coach key.
 * CHANGES: Deploy ▸ Manage deployments ▸ edit ▸ New version. Never a new
 *   deployment: the /exec URL would change under the live page.
 * Tests: node tests/money-backend.test.js
 * Design: docs/superpowers/specs/2026-09-16-money-tab-design.md
 */

var VERSION = 2;

/* The first 24 columns of the Ledger and Test tabs, in this order. */
var HEAD = ['ID', 'Kind', 'Date', 'Campaign', 'Amount', 'Who', 'To', 'BenPct', 'Party', 'RepID', 'Plan', 'Rate',
            'Base', 'Category', 'Note', 'ReceiptID', 'ReceiptName', 'ReceiptSHA', 'Status', 'CreatedBy',
            'CreatedAt', 'UpdatedBy', 'UpdatedAt', 'Rev'];
var FIELD = {ID: 'id', Kind: 'kind', Date: 'date', Campaign: 'campaign', Amount: 'amount', Who: 'who', To: 'to',
             BenPct: 'benPct', Party: 'party', RepID: 'repId', Plan: 'plan', Rate: 'rate', Base: 'base',
             Category: 'category', Note: 'note', ReceiptID: 'receiptId', ReceiptName: 'receiptName',
             ReceiptSHA: 'receiptSha', Status: 'status', CreatedBy: 'createdBy', CreatedAt: 'createdAt', UpdatedBy: 'updatedBy',
             UpdatedAt: 'updatedAt', Rev: 'rev'};
var NUMBER_FORMAT = {Amount: '0.00', BenPct: '0.00', Rate: '0.00', Base: '0.00', Rev: '0'};   // every other column is plain text
/* What a person changes on an entry; the rest is bookkeeping. */
var CONTENT = ['kind', 'date', 'campaign', 'amount', 'who', 'to', 'benPct', 'party', 'repId', 'plan', 'rate',
               'base', 'category', 'note'];
var HISTORY_HEAD = ['At', 'By', 'Book', 'Action', 'ID', 'Entry'];
var TABS = {live: 'Ledger', test: 'Test'};
/* The split each campaign's new entries start from, income and expenses
   alike: one row per change, "from this campaign on, Ben's share is X%".
   Before the first row the hub uses its own starting split (M_FIRST_SPLIT in
   index.html). It's only where a new entry starts — every entry keeps the
   split it was saved with. */
var SPLIT_HEAD = ['From', 'BenPct', 'SetBy', 'SetAt'];
var SPLIT_FORMAT = ['@', '0.00', '@', '@'];
var SPLIT_TABS = {live: 'Splits', test: 'Test Splits'};
var FOLDER_PROP = {live: 'MONEY_FOLDER_ID', test: 'MONEY_TEST_FOLDER_ID'};
var KINDS = ['income', 'expense', 'settle'];
var WHO_LABEL = {income: 'Received by', expense: 'Paid by', settle: 'From'};
var CAMPAIGN_RE = /^(Spring|Summer|Fall) \d{4}$/;
var MAX_AMOUNT = 1000000, MAX_BASE = 10000000;
var MAX_RECEIPT = 5 * 1024 * 1024;
var RECEIPT_MIME = /^(image\/(jpeg|png|gif|webp|heic|heif)|application\/pdf)$/;

/* ── entry points ───────────────────────────────────────────────────── */
function doGet() {
  return json_({ok: true, service: 'SNA Money', version: VERSION});
}

function doPost(e) {
  var out;
  try {
    out = route_(JSON.parse((e && e.postData && e.postData.contents) || '{}'));
  } catch (err) {
    console.error('SNA Money: ' + errText_(err));                 // Executions log — the reply alone isn't a record
    out = {ok: false, error: errText_(err)};
  }
  return json_(out);
}

function route_(b) {
  var want = PropertiesService.getScriptProperties().getProperty('MONEY_KEY');
  if (!want) return {ok: false, error: 'key not set'};
  if (typeof b.key !== 'string' || b.key !== want) return {ok: false, error: 'bad key'};
  if (b.book !== 'live' && b.book !== 'test') return {ok: false, error: 'book must be live or test'};
  switch (b.action) {
    case 'list':    return list_(b.book);
    case 'receipt': return receipt_(b.book, b);
    case 'save':    return locked_(function () { return save_(b.book, b); });
    case 'void':    return locked_(function () { return setStatus_(b.book, b, 'void'); });
    case 'restore': return locked_(function () { return setStatus_(b.book, b, 'live'); });
    case 'split':   return locked_(function () { return split_(b.book, b); });
  }
  return {ok: false, error: 'unknown action'};
}

function locked_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return {ok: false, error: 'the sheet is busy with another save — try again'};
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ── actions ────────────────────────────────────────────────────────── */
function list_(book) {
  var ss = sheet_(false);
  if (!ss) return {ok: true, entries: [], problems: [], splits: [], splitProblems: [], sheetUrl: ''};
  var t = load_(ss, book), s = splits_(ss, book);
  return {ok: true, entries: t.entries, problems: t.problems, splits: splitsOut_(s), splitProblems: s.problems,
          sheetUrl: ss.getUrl()};
}

/* Create or change one entry. A create carries an ID the page minted, so a
   retry after a lost reply finds its own row instead of adding a second. An
   update carries the rev it was based on; if the other person saved first
   they get a conflict with the current row — unless the row already holds
   exactly what they sent, which is the same lost-reply retry. */
function save_(book, b) {
  var by = person_(b.by);
  if (!by) return {ok: false, error: 'who are you? The entry has to be signed Alan or Ben'};
  var c = clean_(b.entry || {});
  if (c.error) return {ok: false, error: c.error};
  var e = c.entry, upload = null;
  if (b.receipt) {
    upload = receiptIn_(b.receipt);
    if (upload.error) return {ok: false, error: upload.error};
  }
  var drop = !upload && b.removeReceipt === true;

  var ss = sheet_(true);
  writable_(ss);
  var sh = tab_(ss, TABS[book], HEAD), t = load_(ss, book);
  var item = t.byId[e.id], now = new Date().toISOString();
  var expects = (b.entry && b.entry.status) === 'void' ? 'void' : 'live';     // the status the sender was looking at

  if (!item) {
    if (Number(b.rev || 0) !== 0) return {ok: false, error: 'that entry isn\'t in the sheet any more — reload the tab'};
    e.status = 'live'; e.receiptId = ''; e.receiptName = ''; e.receiptSha = '';
    e.createdBy = by; e.createdAt = now; e.updatedBy = by; e.updatedAt = now; e.rev = 1;
    if (upload) storeReceipt_(book, e, upload);
    writeRow_(sh, sh.getLastRow() + 1, e);
    return logged_(ss, by, book, 'create', e);
  }
  if (item.problem) return {ok: false, error: needsLook_(book, item)};
  var cur = item.entry;
  if (cur.kind !== e.kind) return {ok: false, error: 'an entry can\'t change kind — void it and add a new one'};
  if (sameContent_(cur, e) && cur.status === expects && receiptSame_(cur, upload, drop)) return {ok: true, entry: cur};
  if (Number(b.rev) !== cur.rev) return {ok: false, conflict: true, entry: cur};

  var next = copy_(cur);
  CONTENT.forEach(function (f) { next[f] = e[f]; });
  if (upload) storeReceipt_(book, next, upload);
  else if (drop) { next.receiptId = ''; next.receiptName = ''; next.receiptSha = ''; }
  next.updatedBy = by; next.updatedAt = now; next.rev = cur.rev + 1;
  writeRow_(sh, item.row, next);
  return logged_(ss, by, book, 'update', next);
}

function setStatus_(book, b, status) {
  var by = person_(b.by);
  if (!by) return {ok: false, error: 'who are you? The change has to be signed Alan or Ben'};
  var ss = sheet_(false), item = ss ? load_(ss, book).byId[String(b.id || '')] : null;
  if (!item) return {ok: false, error: 'that entry isn\'t in the sheet any more — reload the tab'};
  if (item.problem) return {ok: false, error: needsLook_(book, item)};
  var cur = item.entry;
  if (cur.status === status) return {ok: true, entry: cur};
  if (Number(b.rev) !== cur.rev) return {ok: false, conflict: true, entry: cur};
  writable_(ss);
  var next = copy_(cur);
  next.status = status; next.updatedBy = by; next.updatedAt = new Date().toISOString(); next.rev = cur.rev + 1;
  writeRow_(ss.getSheetByName(TABS[book]), item.row, next);
  return logged_(ss, by, book, status === 'void' ? 'void' : 'restore', next);
}

/* Set or take out the split that starts at one campaign. The sender says what
   it saw there (was: Ben's share, or null for no change there); if the other
   person changed it first they get a conflict with the schedule as it is now
   — unless it already reads what was asked for, which is the same lost-reply
   retry as a save. */
function split_(book, b) {
  var by = person_(b.by);
  if (!by) return {ok: false, error: 'who are you? The change has to be signed Alan or Ben'};
  var from = String(b.from === null || b.from === undefined ? '' : b.from).trim();
  if (!CAMPAIGN_RE.test(from)) return {ok: false, error: 'Campaign must look like "Fall 2026"'};
  var want = null;
  if (b.remove !== true) {
    want = pct_(b.benPct);
    if (want === null) return {ok: false, error: 'Ben\'s share must be from 0 to 100%'};
  }
  var ss = sheet_(true);
  writable_(ss);
  var s = splits_(ss, book), stuck = s.problems.filter(function (p) { return p.row === 1 || p.from === from; })[0];
  if (stuck) return {ok: false, error: 'row ' + stuck.row + ' of the ' + SPLIT_TABS[book] + ' tab needs a look first: ' + stuck.error};
  var cur = s.byFrom[from] || null, now = cur ? cur.benPct : null;
  if (now === want) return {ok: true, splits: splitsOut_(s)};
  var was = b.was === null || b.was === undefined ? null : pct_(b.was);
  if (now !== was) return {ok: false, conflict: true, splits: splitsOut_(s)};

  var sh = tab_(ss, SPLIT_TABS[book], SPLIT_HEAD), at = new Date().toISOString();
  var row = cur ? cur.row : sh.getLastRow() + 1;
  room_(sh, row);
  var range = sh.getRange(row, 1, 1, SPLIT_HEAD.length);
  range.setNumberFormats([SPLIT_FORMAT]);
  range.setValues([want === null ? ['', '', '', ''] : [guard_(from), want, by, at]]);
  if (want === null) delete s.byFrom[from];
  else s.byFrom[from] = {from: from, benPct: want, setBy: by, setAt: at, row: row};
  var warning = recorded_(ss, by, book, want === null ? 'unsplit' : 'split', from,
                          want === null ? {from: from, removed: true} : {from: from, benPct: want});
  var out = {ok: true, splits: splitsOut_(s)};
  if (warning) out.warning = warning;
  return out;
}

/* The row is already written when this runs: commit it, then add the History
   line. A History failure must not read as "nothing was saved" — the entry
   went in; only its History line didn't, and the reply says exactly that. */
function logged_(ss, by, book, action, e) {
  var warning = recorded_(ss, by, book, action, e.id, e);
  return warning ? {ok: true, entry: e, warning: warning} : {ok: true, entry: e};
}
function recorded_(ss, by, book, action, id, what) {
  SpreadsheetApp.flush();
  try {
    history_(ss, by, book, action, id, what);
    SpreadsheetApp.flush();
  } catch (err) {
    console.error('SNA Money: ' + action + ' ' + id + ' is saved, but History failed: ' + errText_(err));
    return 'Saved, but the sheet\'s History tab couldn\'t record it (' + errText_(err) + ').';
  }
  return '';
}

/* Hands back one entry's receipt. It looks the file up through the entry and
   checks it sits in that book's receipts folder; it never takes a Drive file
   ID from the caller, because this script runs as Alan with his whole Drive. */
function receipt_(book, b) {
  var ss = sheet_(false), item = ss ? load_(ss, book).byId[String(b.id || '')] : null;
  if (!item) return {ok: false, error: 'that entry isn\'t in the sheet any more — reload the tab'};
  if (item.problem) return {ok: false, error: needsLook_(book, item)};
  var e = item.entry;
  if (!e.receiptId) return {ok: false, error: 'this entry has no receipt'};
  var file;
  try { file = DriveApp.getFileById(e.receiptId); }
  catch (err) { return {ok: false, error: 'couldn\'t open the receipt file: ' + errText_(err)}; }
  if (file.isTrashed()) return {ok: false, error: 'the receipt file is in Drive\'s trash — restore it to see it here'};
  var folderId = PropertiesService.getScriptProperties().getProperty(FOLDER_PROP[book]);
  var home = false, parents = file.getParents();
  while (folderId && parents.hasNext()) if (parents.next().getId() === folderId) { home = true; break; }
  if (!home) return {ok: false, error: 'that receipt isn\'t in the SNA Money receipts folder, so it won\'t be sent'};
  var blob = file.getBlob();
  return {ok: true, name: e.receiptName || file.getName(), mime: blob.getContentType(),
          b64: Utilities.base64Encode(blob.getBytes())};
}

function needsLook_(book, item) {
  return 'row ' + item.row + ' of the ' + TABS[book] + ' tab needs a look first: ' + item.problem;
}

/* ── the sheet ──────────────────────────────────────────────────────── */
/* The spreadsheet, created on the first write; reads before then get null.
   A recorded sheet that won't open is an error with Google's reason — often a
   passing outage — and never a fresh start, which would split the ledger. */
function sheet_(create) {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('MONEY_SHEET_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); }
    catch (err) {
      throw new Error('couldn\'t open the SNA Money sheet: ' + errText_(err) +
                      ' — try again in a minute; if it keeps failing, check the sheet is still in Alan\'s Drive');
    }
  }
  if (!create) return null;
  var ss = SpreadsheetApp.create('SNA Money');
  ss.getSheets()[0].setName(TABS.live);
  props.setProperty('MONEY_SHEET_ID', ss.getId());
  return ss;
}

/* openById happily opens a sheet sitting in Drive's trash, and saves would
   keep landing there until Drive purges it 30 days later. Refuse to write. */
function writable_(ss) {
  var trashed;
  try { trashed = DriveApp.getFileById(ss.getId()).isTrashed(); }
  catch (err) { throw new Error('couldn\'t check the SNA Money sheet in Drive: ' + errText_(err) + ' — try again in a minute'); }
  if (trashed) throw new Error('the SNA Money sheet is in Drive\'s trash — restore it before anything more is saved');
}

/* A new tab has 1,000 rows, and writing below the last one throws — add room first. */
function room_(sh, row) {
  var max = sh.getMaxRows();
  if (row > max) sh.insertRowsAfter(max, Math.max(500, row - max));
}

function tab_(ss, name, head) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    var r = sh.getRange(1, 1, 1, head.length);
    r.setNumberFormat('@');
    r.setValues([head]);
    sh.setFrozenRows(1);
  }
  return sh;
}

/* Every row of one book, parsed. A row that doesn't read cleanly is a
   problem, reported with its row number — never dropped — and the hub won't
   state a settlement for its campaign until someone fixes it. */
function load_(ss, book) {
  var out = {entries: [], problems: [], byId: {}};
  var sh = ss.getSheetByName(TABS[book]);
  if (!sh || sh.getLastRow() === 0) return out;
  var values = sh.getRange(1, 1, sh.getLastRow(), Math.max(sh.getLastColumn(), HEAD.length)).getValues();
  checkHeader_(values[0], TABS[book]);
  var tz = ss.getSpreadsheetTimeZone();
  for (var i = 1; i < values.length; i++) {
    var cells = values[i].slice(0, HEAD.length);
    if (cells.every(function (v) { return v === '' || v === null; })) continue;
    var item = readRow_(cells, tz);
    item.row = i + 1;
    if (item.id && out.byId[item.id]) {
      item.problem = 'the ID ' + item.id + ' is also on row ' + out.byId[item.id].row;
      item.entry = null;
    } else if (item.id) {
      out.byId[item.id] = item;
    }
    if (item.problem) out.problems.push({row: item.row, id: item.id, campaign: item.campaign, error: item.problem});
    else out.entries.push(item.entry);
  }
  return out;
}

function checkHeader_(row, name) {
  for (var i = 0; i < HEAD.length; i++) {
    if (String(row[i] === null ? '' : row[i]).trim() !== HEAD[i]) {
      throw new Error('the ' + name + ' tab\'s header row was changed (column ' + (i + 1) + ' should read "' + HEAD[i] +
                      '"). Its first ' + HEAD.length + ' columns must read: ' + HEAD.join(', '));
    }
  }
}

function readRow_(cells, tz) {
  var g = {};
  HEAD.forEach(function (h, i) { g[h] = cells[i]; });
  var id = text_(g.ID), campaign = text_(g.Campaign);
  var bad = function (why) { return {id: id, campaign: campaign, problem: why}; };
  var c = clean_({id: id, kind: text_(g.Kind), date: day_(g.Date, tz), campaign: campaign, amount: g.Amount,
                  who: text_(g.Who), to: text_(g.To), benPct: g.BenPct, party: text_(g.Party), repId: text_(g.RepID),
                  plan: text_(g.Plan), rate: g.Rate, base: g.Base, category: text_(g.Category), note: text_(g.Note)});
  if (c.error) return bad(c.error);
  var e = c.entry;
  if (numIn_(g.Amount) !== e.amount) {
    return bad(e.plan === 'pct'
      ? 'Amount ' + g.Amount + ' isn\'t ' + e.rate + '% of ' + e.base + ' (that\'s ' + e.amount.toFixed(2) + ')'
      : 'Amount ' + g.Amount + ' has to be dollars and cents');
  }
  e.status = text_(g.Status);
  if (e.status !== 'live' && e.status !== 'void') return bad('Status must be live or void');
  e.rev = numIn_(g.Rev);
  if (!(e.rev >= 1) || e.rev % 1 !== 0) return bad('Rev must be a whole number, 1 or more');
  e.receiptId = text_(g.ReceiptID); e.receiptName = text_(g.ReceiptName); e.receiptSha = text_(g.ReceiptSHA);
  e.createdBy = text_(g.CreatedBy); e.createdAt = text_(g.CreatedAt);
  e.updatedBy = text_(g.UpdatedBy); e.updatedAt = text_(g.UpdatedAt);
  return {id: id, campaign: campaign, entry: e};
}

function writeRow_(sh, row, e) {
  var values = [], formats = [];
  HEAD.forEach(function (h) {
    var v = e[FIELD[h]];
    if (NUMBER_FORMAT[h]) {
      formats.push(NUMBER_FORMAT[h]);
      values.push(v === null || v === undefined || v === '' ? '' : Number(v));
    } else {
      formats.push('@');
      values.push(guard_(v));
    }
  });
  room_(sh, row);
  var range = sh.getRange(row, 1, 1, HEAD.length);
  range.setNumberFormats([formats]);
  range.setValues([values]);
}

function history_(ss, by, book, action, id, what) {
  var sh = tab_(ss, 'History', HISTORY_HEAD), row = sh.getLastRow() + 1;
  room_(sh, row);
  var range = sh.getRange(row, 1, 1, HISTORY_HEAD.length);
  range.setNumberFormat('@');
  range.setValues([[new Date().toISOString(), by, book, action, id, JSON.stringify(what)]]);
}

/* One book's split changes, oldest campaign first. A row that doesn't read is
   reported with its row number and left out, so the campaigns it covered start
   from the change before it until someone fixes it; a changed header row
   leaves out the whole tab. None of it stops the ledger reading. */
function splits_(ss, book) {
  var out = {byFrom: {}, problems: []};
  var sh = ss.getSheetByName(SPLIT_TABS[book]);
  if (!sh || sh.getLastRow() === 0) return out;
  var values = sh.getRange(1, 1, sh.getLastRow(), SPLIT_HEAD.length).getValues();
  for (var i = 0; i < SPLIT_HEAD.length; i++) {
    if (text_(values[0][i]) !== SPLIT_HEAD[i]) {
      out.problems.push({row: 1, from: '', error: 'the header row was changed (column ' + (i + 1) + ' should read "' +
                         SPLIT_HEAD[i] + '"). Its first ' + SPLIT_HEAD.length + ' columns must read: ' + SPLIT_HEAD.join(', ')});
      return out;
    }
  }
  for (var r = 1; r < values.length; r++) {
    var cells = values[r];
    if (cells.every(function (v) { return v === '' || v === null; })) continue;
    var from = text_(cells[0]), share = pct_(cells[1]);
    var why = !CAMPAIGN_RE.test(from) ? 'From must look like "Fall 2026"'
      : share === null ? 'BenPct must be a number from 0 to 100'
      : out.byFrom[from] ? 'the split from ' + from + ' is also on row ' + out.byFrom[from].row : '';
    if (why) { out.problems.push({row: r + 1, from: from, error: why}); continue; }
    out.byFrom[from] = {from: from, benPct: share, setBy: text_(cells[2]), setAt: text_(cells[3]), row: r + 1};
  }
  return out;
}
function splitsOut_(s) {
  return Object.keys(s.byFrom).map(function (k) {
    var x = s.byFrom[k];
    return {from: x.from, benPct: x.benPct, setBy: x.setBy, setAt: x.setAt};
  }).sort(function (a, b) { return campaignKey_(a.from) - campaignKey_(b.from); });
}
function campaignKey_(label) {
  var p = String(label).split(' ');
  return Number(p[1]) * 3 + ({Spring: 0, Summer: 1, Fall: 2}[p[0]] || 0);
}

/* Sheets runs a string that starts with = as a formula whatever the cell's
   format says (hub sync PR #15), and reads + - @ as the start of one too. A
   leading ' keeps it text; text_() takes it back off if Sheets kept it. */
function guard_(v) {
  var s = String(v === null || v === undefined ? '' : v);
  return /^[=+\-@]/.test(s) ? '\'' + s : s;
}
function text_(v) {
  var s = isDate_(v) ? v.toISOString() : String(v === null || v === undefined ? '' : v);
  if (s.charAt(0) === '\'' && /^[=+\-@]/.test(s.charAt(1))) s = s.slice(1);
  return s.trim();
}
/* A Date cell (someone typed a date into a cell that lost its text format)
   still means the day it shows in the sheet's own time zone. */
function day_(v, tz) {
  return isDate_(v) ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : text_(v);
}
function isDate_(v) {
  return Object.prototype.toString.call(v) === '[object Date]';
}
function errText_(err) {
  return String((err && err.message) || err);
}
function copy_(o) {
  var out = {};
  for (var k in o) out[k] = o[k];
  return out;
}

/* ── receipts ───────────────────────────────────────────────────────── */
function receiptIn_(r) {
  var mime = String(r.mime || '').toLowerCase();
  if (!RECEIPT_MIME.test(mime)) return {error: 'a receipt has to be a photo or a PDF'};
  var bytes;
  try { bytes = Utilities.base64Decode(String(r.b64 || '')); }
  catch (err) { return {error: 'the receipt didn\'t arrive intact — attach it again'}; }
  if (!bytes.length) return {error: 'the receipt file is empty'};
  if (bytes.length > MAX_RECEIPT) return {error: 'that receipt is too big — 5 MB max'};
  var name = String(r.name || '').replace(/[\\\/:*?"<>| -]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  return {bytes: bytes, mime: mime, name: name || 'receipt', sha: sha256_(bytes)};
}

/* Files the receipt and points the entry at it. The entry keeps the file's
   SHA-256 (ReceiptSHA), which is how a retried save recognises a receipt it
   already filed — phones name every photo image.jpg, so the name can't tell,
   and the check needs no trip to Drive that could fail on its own. */
function storeReceipt_(book, e, up) {
  var ext = up.mime === 'application/pdf' ? 'pdf' : up.mime.split('/')[1].replace('jpeg', 'jpg');
  var fileName = e.date + ' ' + e.kind + ' ' + e.amount.toFixed(2) + ' ' + e.id + '.' + ext;
  var file = folder_(book).createFile(Utilities.newBlob(up.bytes, up.mime, fileName));
  e.receiptId = file.getId();
  e.receiptName = up.name;
  e.receiptSha = up.sha;
}

function receiptSame_(cur, upload, drop) {
  if (upload) return !!cur.receiptId && cur.receiptSha === upload.sha;
  if (drop) return !cur.receiptId;
  return true;
}

/* The receipts folder, made the first time a receipt arrives. A recorded
   folder that won't open, or sits in the trash, is an error with the reason —
   never a reason to start another, which would lose every receipt filed. */
function folder_(book) {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(FOLDER_PROP[book]);
  if (id) {
    var f;
    try { f = DriveApp.getFolderById(id); }
    catch (err) { throw new Error('couldn\'t open the receipts folder: ' + errText_(err) + ' — try again in a minute'); }
    if (f.isTrashed()) throw new Error('the receipts folder is in Drive\'s trash — restore it (Script Property ' + FOLDER_PROP[book] + ')');
    return f;
  }
  var made = book === 'test' ? folder_('live').createFolder('Test') : DriveApp.createFolder('SNA Money Receipts');
  props.setProperty(FOLDER_PROP[book], made.getId());
  return made;
}

function sha256_(bytes) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes).map(function (b) {
    return ('0' + (b & 255).toString(16)).slice(-2);
  }).join('');
}

/* ── validation ─────────────────────────────────────────────────────── */
/* One entry, as the hub sends it or as a sheet row reads. Returns {entry},
   every field normalised, or {error} in words the hub shows as they are.
   index.html's mCheck() says the same things; a test holds them together. */
function clean_(raw) {
  var t = function (v, max) {
    return String(v === null || v === undefined ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
  };
  var e = {id: t(raw.id, 40), kind: t(raw.kind, 10), date: t(raw.date, 10), campaign: t(raw.campaign, 20),
           amount: null, who: person_(raw.who), to: '', benPct: null, party: '', repId: '', plan: '',
           rate: null, base: null, category: '', note: t(raw.note, 500)};
  var a;
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(e.id)) return {error: 'the entry\'s ID is missing or malformed'};
  if (KINDS.indexOf(e.kind) < 0) return {error: 'Kind must be income, expense or settle'};
  if (!validDay_(e.date)) return {error: 'Date must be a real day, written YYYY-MM-DD'};
  if (!CAMPAIGN_RE.test(e.campaign)) return {error: 'Campaign must look like "Fall 2026"'};
  if (!e.who) return {error: WHO_LABEL[e.kind] + ' must be Alan or Ben'};
  if (e.kind === 'settle') {
    e.to = person_(raw.to);
    if (!e.to || e.to === e.who) return {error: 'A settle-up goes from one of you to the other'};
    a = dollars_(raw.amount, 'Amount', MAX_AMOUNT);
    if (a.error) return a;
    e.amount = a.value;
    return {entry: e};
  }
  e.party = t(raw.party, 120);
  if (!e.party) return {error: e.kind === 'income' ? 'Say who paid' : 'Say what the expense was for'};
  var share = numIn_(raw.benPct);
  if (share === null || isNaN(share) || share < 0 || share > 100) return {error: 'Ben\'s share must be from 0 to 100%'};
  e.benPct = Math.round(share * 100) / 100;
  if (e.kind === 'expense') {
    e.category = t(raw.category, 40);
    a = dollars_(raw.amount, 'Amount', MAX_AMOUNT);
    if (a.error) return a;
    e.amount = a.value;
    return {entry: e};
  }
  e.repId = t(raw.repId, 20);
  if (e.repId && !/^[A-Za-z0-9_-]+$/.test(e.repId)) return {error: 'the mentee\'s RepID is malformed'};
  e.plan = t(raw.plan, 4);
  if (e.plan === 'flat') {
    a = dollars_(raw.amount, 'Amount', MAX_AMOUNT);
    if (a.error) return a;
    e.amount = a.value;
    return {entry: e};
  }
  if (e.plan !== 'pct') return {error: 'Plan must be % of commission sales or flat'};
  a = dollars_(raw.base, 'Commission sales', MAX_BASE);
  if (a.error) return a;
  e.base = a.value;
  var rate = numIn_(raw.rate);
  if (rate === null || isNaN(rate) || rate <= 0 || rate > 100) return {error: 'The rate must be more than 0% and no more than 100%'};
  e.rate = Math.round(rate * 10000) / 10000;
  var cents = Math.round(Number((e.base * e.rate).toFixed(4)));          // base × rate% in dollars = base × rate in cents
  if (cents <= 0) return {error: 'That works out to $0.00'};
  e.amount = cents / 100;
  return {entry: e};
}

function dollars_(v, label, max) {
  var n = numIn_(v);
  if (n === null || isNaN(n)) return {error: label + ' must be a number'};
  var cents = Math.round(Number((n * 100).toFixed(4)));
  if (cents <= 0) return {error: label + ' must be more than $0.00'};
  if (cents > max * 100) return {error: label + ' can\'t be more than $' + String(max).replace(/\B(?=(\d{3})+$)/g, ',')};
  return {value: cents / 100};
}

/* A number from JSON or from a cell. "$1,200.50" reads as 1200.5, blank as
   null; anything else that isn't a plain number is NaN. A negative number
   passes through so the caller can say it must be more than $0.00. */
function numIn_(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : NaN;
  var s = String(v).trim().replace(/^\$/, '').replace(/,/g, '');
  if (s === '') return null;
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

/* Ben's share of something, 0–100 to the hundredth; null if it isn't one. */
function pct_(v) {
  var n = numIn_(v);
  return n === null || isNaN(n) || n < 0 || n > 100 ? null : Math.round(n * 100) / 100;
}

function person_(v) {
  var s = String(v === null || v === undefined ? '' : v).trim().toLowerCase();
  return s === 'alan' ? 'Alan' : s === 'ben' ? 'Ben' : '';
}

function validDay_(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  if (!m) return false;
  var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

function sameContent_(a, b) {
  for (var i = 0; i < CONTENT.length; i++) {
    var x = a[CONTENT[i]], y = b[CONTENT[i]];
    if (String(x === null || x === undefined ? '' : x) !== String(y === null || y === undefined ? '' : y)) return false;
  }
  return true;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

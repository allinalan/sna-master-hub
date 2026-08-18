/**
 * Sharp Ninja Academy — Master Hub shared storage
 * ─────────────────────────────────────────────────────────────────────────
 * Gives the hub (https://allinalan.github.io/sna-master-hub/) one shared copy
 * of its data so Alan and Ben both see each other's edits.
 *
 * SETUP — about three minutes, once:
 *   1. script.google.com  ▸  New project  ▸  paste this whole file over
 *      whatever is there  ▸  name it "SNA Hub Sync".
 *   2. Run  setup()  once. Approve the permission prompt (it's your own
 *      script asking to make a spreadsheet). The Execution log prints the
 *      new sheet's URL — that's where the data will live.
 *   3. Deploy ▸ New deployment ▸ type "Web app"
 *        Execute as:      Me
 *        Who has access:  Anyone
 *      ▸ Deploy ▸ copy the /exec URL.
 *   4. Send that URL to Claude (or paste it into SYNC.url in index.html).
 *
 * If you ever change this file, you must Deploy ▸ Manage deployments ▸ edit ▸
 * New version, or the web app keeps serving the old code.
 */

// Must match SYNC.token in the hub's index.html.
var TOKEN = 'sharpninja';

// Filled in by setup(). Don't edit by hand.
var PROP_SHEET = 'HUB_SHEET_ID';
var TAB = 'HubData';
var CHUNK = 40000;          // a cell holds ~50k chars; leave headroom

/* ── one-time setup ─────────────────────────────────────────────────── */
function setup() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(PROP_SHEET);
  var ss;
  if (id) {
    ss = SpreadsheetApp.openById(id);
    Logger.log('Already set up. Reusing: ' + ss.getUrl());
  } else {
    ss = SpreadsheetApp.create('SNA Master Hub Data');
    props.setProperty(PROP_SHEET, ss.getId());
    Logger.log('Created: ' + ss.getUrl());
  }
  var sh = ss.getSheetByName(TAB) || ss.insertSheet(TAB);
  if (!sh.getRange('A1').getValue()) {
    sh.getRange('A1:B4').setValues([
      ['rev', 0], ['updated', ''], ['by', ''], ['json', '']
    ]);
    sh.getRange('A1:A4').setFontWeight('bold');
    sh.setColumnWidth(1, 90);
  }
  Logger.log('Tab "' + TAB + '" ready.');
  Logger.log('NEXT: Deploy > New deployment > Web app > Execute as Me, Access Anyone.');
  return ss.getUrl();
}

function sheet_() {
  var id = PropertiesService.getScriptProperties().getProperty(PROP_SHEET);
  if (!id) throw new Error('Run setup() first');
  return SpreadsheetApp.openById(id).getSheetByName(TAB);
}

/* ── read ───────────────────────────────────────────────────────────── */
function doGet(e) {
  try {
    if ((e.parameter.token || '') !== TOKEN) return json_({ ok: false, error: 'bad token' });
    var sh = sheet_();
    var rev = Number(sh.getRange('B1').getValue() || 0);
    var updated = String(sh.getRange('B2').getValue() || '');
    var by = String(sh.getRange('B3').getValue() || '');
    var text = readChunks_(sh);
    return json_({
      ok: true, rev: rev, updated: updated, by: by,
      data: text ? JSON.parse(text) : null
    });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/* ── write ──────────────────────────────────────────────────────────── */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var body = JSON.parse(e.postData.contents);
    if ((body.token || '') !== TOKEN) return json_({ ok: false, error: 'bad token' });

    var sh = sheet_();
    var rev = Number(sh.getRange('B1').getValue() || 0);

    // someone else saved since the sender last synced — hand back their copy
    if (Number(body.baseRev) !== rev) {
      var text = readChunks_(sh);
      return json_({
        ok: false, conflict: true, rev: rev,
        by: String(sh.getRange('B3').getValue() || ''),
        updated: String(sh.getRange('B2').getValue() || ''),
        data: text ? JSON.parse(text) : null
      });
    }

    var next = rev + 1;
    var stamp = new Date().toISOString();
    writeChunks_(sh, JSON.stringify(body.data));
    sh.getRange('B1').setValue(next);
    sh.getRange('B2').setValue(stamp);
    sh.getRange('B3').setValue(String(body.by || ''));
    SpreadsheetApp.flush();
    return json_({ ok: true, rev: next, updated: stamp });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

/* ── the blob is split across cells so it can grow past one cell's limit ── */
function writeChunks_(sh, text) {
  var parts = [];
  for (var i = 0; i < text.length; i += CHUNK) parts.push([text.substr(i, CHUNK)]);
  if (!parts.length) parts = [['']];
  var last = Math.max(sh.getLastRow(), 4);
  if (last >= 4) sh.getRange(4, 2, last - 3, 1).clearContent();
  sh.getRange(4, 2, parts.length, 1).setValues(parts);
}
function readChunks_(sh) {
  var last = sh.getLastRow();
  if (last < 4) return '';
  var vals = sh.getRange(4, 2, last - 3, 1).getValues();
  return vals.map(function (r) { return String(r[0] || ''); }).join('');
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}

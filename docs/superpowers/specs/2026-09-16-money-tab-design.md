# Money tab — design

2026-09-16 · Alan Hernandez & Claude · status: approved ("all defaults" + answers below)

A private place in the master hub where Alan and Ben log Sharp Ninja Academy income and
expenses, and the hub works out the split between them for each campaign.

## Decisions (Alan, 2026-09-16)

| # | Question | Answer |
|---|---|---|
| 1 | Do expenses split 60/40 like income? | **Yes.** They split the profit; whoever paid an expense gets the other's share back. |
| 2 | What is the % taken from? | **Commission sales**, charged on the back end. "We just need a place to write it down." |
| 3 | Where does money land? | **Ben's account, nearly always.** Occasionally a mentee Venmos Alan. |
| 4 | When does income count? | When it actually arrives. No "owed but unpaid" tracking. |
| 5 | How do they settle up? | **At the end of each campaign.** |
| 6 | What does "upload" mean? | Type the entry; optionally attach a receipt photo or PDF. |
| 7 | Which key? | The **coach key**. One unlock covers every private tab. |
| 8 | Name and place | A new bold tab **Money**, last in the top bar. |
| 9 | Past records | Start empty. |
| 10 | Backend setup | Claude creates and deploys it through Alan's Chrome. Alan clicks Google's **Allow**, types the key into the script's settings, and merges the PR. |

Split: **Ben 60 · Alan 40**, stored on every entry so a future change of deal never rewrites
old campaigns.

## Architecture

```
index.html (public GitHub Pages)
  Money tab ──POST text/plain {key, action, book, …}──▶  "SNA Money" Apps Script web app
                                                            (standalone project, Execute as Alan,
                                                             access Anyone, key-gated)
                                                              │
                                              ┌───────────────┼────────────────┐
                                              ▼               ▼                ▼
                                    "SNA Money" sheet   History tab     "SNA Money Receipts"
                                    Ledger + Test tabs  (append-only)    private Drive folder
```

- **Why a new standalone script, not the existing ones.** The hub sync script's data is
  readable by anyone who reads the page source (its token is in the page), so money cannot go
  there. The SharpNinja script is production for the Mac mini's texting feed, and the sheet it
  is bound to is link-shared. A separate project isolates the money from both, and nothing the
  mini runs changes.
- **Source** lives in this repo as `SNA-Money.gs`, next to `SharpNinja-Hub-Sync.gs`. The repo
  is public, so the file holds no secrets: the key is the Script Property `MONEY_KEY`; the sheet
  and folder IDs are Script Properties the script writes itself (`MONEY_SHEET_ID`,
  `MONEY_FOLDER_ID`, `MONEY_TEST_FOLDER_ID`).
- **Nothing to run by hand.** The script creates the sheet (both tabs plus History) under the
  lock on the first write, and the receipts folder on the first upload. Reads before any write
  return an empty ledger rather than creating anything.
- **Scopes:** Sheets (`spreadsheets`) and Drive (`drive`, which `DriveApp` needs to make the
  folder and files). Same scopes Alan already granted the SharpNinja script.
- **Books.** `book: "live"` → tab `Ledger`; `book: "test"` → tab `Test` (and a `Test` receipts
  subfolder). The page uses `test` whenever it is served from `localhost`, the same way
  `DASH_BASE` already switches on localhost. Post-deploy verification only ever writes to the
  test book.

## Data model

One row per entry. Header row, frozen. Column order is the contract; the script looks
columns up by header name so a hand-inserted column can't shift values.

| Column | Type | Meaning |
|---|---|---|
| ID | text | Minted by the page before the first send (`m` + base36 time + random). Makes a retried create idempotent. |
| Kind | text | `income` · `expense` · `settle` |
| Date | text `YYYY-MM-DD` | When the money moved. |
| Campaign | text | `Spring 2026` · `Summer 2026` · `Fall 2026` … — which campaign's settlement it counts toward. |
| Amount | number, 2 dp | Always positive. For a % income entry the script computes it: `round2(Base × Rate / 100)`. |
| Who | text | income: **received by** · expense: **paid by** · settle: **from**. `Alan` or `Ben`. |
| To | text | settle only: `Alan` or `Ben`, never equal to Who. |
| BenPct | number 0–100 | Ben's share of this entry, up to 2 dp; Alan's is `100 − BenPct`. Income and expense only. Default 60. |
| Party | text ≤120 | income: who paid (mentee name or anyone) · expense: what it was for. Required for both. |
| RepID | text | income from a roster mentee: their RepID; blank otherwise. |
| Plan | text | income only: `pct` (% of commission sales) or `flat`. |
| Rate | number | `pct` only: the percentage, 0 < Rate ≤ 100. |
| Base | number | `pct` only: the commission sales figure, > 0. |
| Category | text ≤40 | expense only. Starter set in the hub; any new name allowed. |
| Note | text ≤500 | optional. |
| ReceiptID / ReceiptName | text | Drive file id and original name, expense or income (optional). |
| Status | text | `live` · `void`. Voided rows stay in the sheet and the list, out of every total. |
| CreatedBy / CreatedAt / UpdatedBy / UpdatedAt | text | Hub name (`Alan`/`Ben`) and ISO timestamps. |
| Rev | number | Starts at 1, +1 on every change. Optimistic concurrency. |

**History tab** (append-only): `At · By · Book · Action (create/update/void/restore) · ID ·
Entry JSON`. Written in the same lock as the change.

**Guarding against Sheets' own parsing** (lesson from hub sync PRs #14/#15): the row's cells
get plain-text format before `setValues`, except the numeric columns. Human text that begins
with `= + - @` is written with a leading `'` and read back without it (a leading `'` is only
stripped when a `= + - @` follows it). The reader never trusts the sheet's types: a Date cell
that came back as a `Date` is re-formatted to `YYYY-MM-DD` in the sheet's time zone, a
timestamp to ISO; a number that doesn't parse marks the row as a problem.

**Unreadable rows** (hand edits gone wrong: unknown Kind, bad date, non-numeric amount, Who not
Alan/Ben) are returned in `problems: [{row, id, error}]`, never silently dropped. The page
lists them in red and refuses to state a settlement for any campaign with a problem row
(fail closed).

## API

Every call: `POST` to `/exec`, `Content-Type: text/plain;charset=utf-8` (no CORS preflight),
body JSON. Reply is JSON `{ok: true, …}` or `{ok: false, error: "…"}`.

| Gate | Reply |
|---|---|
| `MONEY_KEY` not set | `{ok:false, error:"key not set"}` |
| wrong key | `{ok:false, error:"bad key"}` |
| unknown action | `{ok:false, error:"unknown action"}` |

`GET /exec` → `{ok:true, service:"SNA Money", version:N}` with no data: a liveness check that
needs no key.

**Actions**

- `list {book}` → `{ok, entries:[…], problems:[…], sheetUrl}`. `sheetUrl` is empty until the
  first write created the sheet. No lock.
- `save {book, by, entry, rev?, receipt?, removeReceipt?}` → `{ok, entry}` · conflict ·
  error. Under the script lock.
  - `entry` is the whole row minus the audit fields. The script validates every field (below),
    computes Amount for `pct`, and ignores fields that don't apply to the kind.
  - **Create:** no row has `entry.id`. `rev` must be absent or 0.
  - **Update:** `rev` equals the row's Rev → write, Rev + 1.
  - **Same content already stored** (a retry whose first reply was lost): `{ok:true, entry}`
    without writing, whatever `rev` says. "Same" compares every editable field plus Status.
  - Otherwise `{ok:false, conflict:true, entry:<current row>}`.
  - `receipt: {name, mime, b64}` (≤ 5 MB decoded; images, PDF) → file saved in the receipts
    folder (Test subfolder for the test book) as `<date> <kind> <amount> <id>.<ext>` before
    the row is written. `removeReceipt: true` clears ReceiptID/ReceiptName (the file stays in
    Drive).
- `void {book, by, id, rev}` / `restore {book, by, id, rev}` → `{ok, entry}` · conflict · error.
  Idempotent: voiding a void row is ok.
- `receipt {book, id}` → `{ok, name, mime, b64}`. Looks up the **entry** and returns only that
  entry's file, and only if the file sits in that book's receipts folder (the Test subfolder
  for the test book). It never takes a Drive file
  id from the caller: the script runs as Alan with full Drive access, and an id-taking action
  would hand any key-holder all of Alan's Drive.

**Validation** (script-side, the page mirrors it for instant messages):

- `kind` ∈ income/expense/settle · `date` real calendar date `YYYY-MM-DD` · `campaign`
  `^(Spring|Summer|Fall) \d{4}$` · `who` ∈ Alan/Ben · settle `to` ∈ Alan/Ben and ≠ `who`.
- `amount` > 0 and ≤ 1,000,000, rounded to cents (settle, expense, flat income).
- `pct` income: `base` > 0 and ≤ 10,000,000 · 0 < `rate` ≤ 100.
- `benPct` 0–100 (income, expense). `party` required (income, expense). `plan` required
  (income). Text fields trimmed and capped (Party 120, Category 40, Note 500).
- `by` must be `Alan` or `Ben` (case-insensitive, stored capitalised); anything else → error
  `"who are you?"`, so every row names a real person. The page maps its who-am-I name to
  Alan/Ben by first word ("alan h" → Alan) before sending.

## Settlement math

All arithmetic in integer cents. Per **live** entry:

- income/expense shares: `ben = round(cents × BenPct / 100)`, `alan = cents − ben`
  (the two always sum to the entry exactly).

Per campaign, over its live entries:

```
share[P]  = Σ income share[P]  − Σ expense share[P]
holds[P]  = Σ income received by P − Σ expenses paid by P
          + Σ settle-ups to P − Σ settle-ups from P
owed[P]   = share[P] − holds[P]            owed[Ben] = −owed[Alan]
owed[Ben] > 0  →  "Alan owes Ben $owed"    < 0  →  "Ben owes Alan $|owed|"    0 → square
```

Worked example (the normal shape: income lands with Ben, both pay expenses):

| Entry | |
|---|---|
| Income $10,000, received by Ben | shares Ben 6,000 · Alan 4,000 |
| Expense $500, paid by Alan | shares Ben 300 · Alan 200 |
| Expense $300, paid by Ben | shares Ben 180 · Alan 120 |

share Ben = 6,000 − 480 = 5,520 · share Alan = 4,000 − 320 = 3,680 (profit 9,200 ✓)
holds Ben = 10,000 − 300 = 9,700 · holds Alan = −500
owed Ben = 5,520 − 9,700 = −4,180 → **Ben owes Alan $4,180.00**. A settle-up Ben → Alan
$4,180 makes it square: holds become Ben 5,520 · Alan 3,680.

**Campaign dates.** Spring = Jan–Apr, Summer = May–Aug, Fall = Sep–Dec (the hub's
`campaignLabelOf`). A campaign **ends** Apr 30 / Aug 31 / Dec 31.

**Campaign states** (the settlement card), checked in this order — the first that matches wins:

| State | When | Card says |
|---|---|---|
| blocked | a problem row carries this campaign | "Can't work out Fall 2026: N rows in the sheet need a look." (no amount shown) |
| empty | no live entries | "Nothing logged for Fall 2026 yet." |
| reopened | owed ≠ 0 and a live settle-up exists | "Settled Jan 3, but entries since leave Ben owing Alan $X" · **Record settle-up** |
| running | owed ≠ 0, today ≤ end | "So far: Ben owes Alan $X" · settles after Dec 31 · **Settle up now** (secondary) |
| due | owed ≠ 0, today > end | "Ben owes Alan $X for Fall 2026" · **Record settle-up** (primary) |
| settled | owed = 0 and a live settle-up exists | "Settled ✓ Ben paid Alan $X on Jan 3" (the latest settle-up) |
| square | owed = 0 | "Square — nobody owes anything." |

A problem row with no readable campaign blocks every campaign (it could belong to any).

## The Money tab

- **Nav:** `SECTIONS` gets `{id:"money", label:"Money"}` last; `TABS` gets one page. The tab
  count is neutral ("12 this campaign") — no dollar figures in the nav, which is on screen
  whenever the hub is shared on a call.
- **Gate:** the existing coach-key gate (`TEAM.key`, localStorage `sna_coach_key`). On
  `bad key` from the money script the page asks the SharpNinja script whether the key is good
  there: if not, it clears the key and shows the gate ("That key wasn't right"); if it is, it
  says exactly what is wrong ("The Money sheet doesn't accept the coach key — MONEY_KEY in the
  SNA Money script must match it") and keeps the key. `key not set` names the Script Property
  and where to add it.
- **Toolbar:** campaign picker (every campaign with entries plus the current one, newest first,
  then **All campaigns**) · **+ Income** · **+ Expense** · **Settle up** · kind filter
  (All/Income/Expenses/Settle-ups) · who filter (Anyone/Alan/Ben) · category dropdown ·
  search · **Show voided** · Refresh · Export PNG · Print. A link **Open the sheet ↗** when
  `sheetUrl` is known.
- **Unsettled earlier campaigns:** a red line above everything for any campaign that has
  ended and is in state due, reopened or blocked: "Summer 2026 isn't settled — Ben owes Alan
  $X · Open".
- **Stats** for the chosen campaign: Income · Expenses · Profit · Ben's share · Alan's share
  (meta shows "60%" when every entry used 60/40, else "mixed splits").
- **Settlement card** (one campaign): the states above.
- **All campaigns:** the stats cover everything; the card becomes a table, one row per
  campaign: Income · Expenses · Profit · Ben · Alan · status.
- **The list:** newest date first (then newest created). Columns: Date · Entry (kind chip,
  party, category or plan math "8% of $12,500.00", note, 📎) · Who ("Ben received", "Alan
  paid", "Ben → Alan") · Split ("60/40", "50/50", "all Ben") · Amount (right-aligned: income
  `+$1,000.00`, expense `−$120.00`, settle-up `$4,180.00`) · Campaign (only in All). Void rows
  struck through, hidden
  unless **Show voided**. Clicking a row opens it. On phones the table reads as cards,
  like the other plain tables.
- **The drawer** (the Assignments drawer shell, `#adrawer`) for add and edit, explicit
  **Save** — money never autosaves. A kind switch at the top while the entry is new; kind is
  fixed once saved.
  - Common: date (calendar picker, default today) · campaign (select; default = the campaign
    being viewed, or the date's campaign under All, following the date until changed by hand)
    · note.
  - Income: **From** (select of active roster mentees, then names used before, then
    "Someone else…" → text) · **Plan** (% of commission sales / Flat; default = this payer's
    last plan, else %) · % → commission sales $ and rate % (rate defaults to their last) with
    the computed amount shown live · Flat → amount (defaults to their last flat amount) ·
    **Received by** Ben (default) / Alan · **Split** 60/40 (default) · 50/50 · all Ben · all
    Alan · custom Ben % · receipt.
  - Expense: **What** · **Category** (select: categories used before plus Software, Prizes &
    gifts, Meals, Events & venues, Travel, Marketing, Fees, Other; "New category…" → text) ·
    amount · **Paid by** (default = the hub's who-am-I when it is Alan or Ben; otherwise
    nothing is picked and Save asks) · split · receipt.
  - Settle-up: **From** Alan/Ben → To (the other) · amount. Opened from the card, it is
    prefilled with the debtor, creditor, exact amount and campaign; the amount stays editable
    for a partial payment.
  - Existing entry: the same fields, **Save**, **Void** (confirm: "Void this $120.00
    expense? It stays in the list, crossed out, and stops counting. You can restore it.") or
    **Restore**, the receipt (view · replace · remove), and "Added by Ben Sep 16 · edited by
    Alan Sep 18".
- **Receipts:** file input `image/*,application/pdf`. Images larger than 1.5 MB or 2000 px on
  the long edge are redrawn to 2000 px JPEG q0.85 in the browser; anything the browser can't
  decode (HEIC on desktop) goes up as-is. More than 5 MB after that → "That file is too big —
  5 MB max". Viewing fetches it through `receipt` and shows an image inline or a PDF in a
  frame, with Open-in-new-tab and Download links.
- **Who am I:** saves carry `by: whoAmI()`; when that isn't Alan or Ben the hub's existing
  `askWho(true)` prompt runs first, and the save refuses without a real name.

## Failure handling (loud, never silent)

- **Nothing shows as saved until the sheet said ok.** While a save is in flight the button
  reads "Saving…" and the form is locked. On failure the drawer stays open with the reason in
  red: "Didn't save — the sheet said: …", or "Couldn't reach the sheet. Nothing was saved —
  try again."
- **Transport retries:** reads retry 3× with backoff (Apps Script `/exec` intermittently serves
  an HTML error page, seen ~1 in 5 on 2026-08-24). A write retries once, automatically, and
  only because creates are idempotent by ID and updates recognise their own content.
- **Conflict** (the other person changed the entry first): a dialog shows theirs next to
  yours — **Keep mine** re-sends on top of their rev; **Take theirs** closes the form.
- **Load failure:** the tab shows the error and a Try again button instead of an empty ledger.
  An empty ledger is only ever shown after a successful `list`.
- **Blocked campaigns** (problem rows) never show an amount owed.

## Testing

- `tests/money-math.test.js` (node, no deps): the settlement math block, extracted from
  `index.html` between `/*MONEY_MATH_BEGIN*/ … /*MONEY_MATH_END*/` — the same technique as
  sharpninja's `resolve-rep-id.test.js`. Cases: share rounding sums, the worked example, every
  campaign state, void exclusion, custom splits, % amounts, campaign ends, unsettled-earlier
  detection, problem rows blocking.
- `tests/money-backend.test.js` (node, no deps): `SNA-Money.gs` run in a `vm` with in-memory
  fakes for SpreadsheetApp, DriveApp, PropertiesService, LockService, ContentService,
  Utilities (`tests/gas-fakes.js`). The fake sheet mimics the parsing hazards: an unguarded
  `=` string becomes a formula error and an unguarded date string becomes a `Date`. Cases:
  key gates, validation, create / idempotent retry / update / conflict / same-content
  recognition, void/restore, history rows, test vs live books, receipt round trip and the
  receipt-by-entry rule, formula and date guards, problem rows, lazy sheet creation.
- `tools/dev-server.js` (node, no deps): serves `index.html` on localhost with
  `window.SNA_DEV = {moneyApi, teamApi}` injected, backs `/__money` with the real
  `SNA-Money.gs` in the fakes and `/__team` with a fake roster (invented names). `index.html`
  reads `SNA_DEV` only when present, so production is untouched. Used to drive the whole tab in
  a browser: add/edit/void each kind, receipts, conflicts, settle-up flow, phone width, export.
- **Live verification after deploy** (Alan's Chrome, on the live hub page so the stored coach
  key is used without anyone reading it out): liveness GET; `bad key` with a wrong key; with
  the real key, on the **test book** only: list → create income (%) → list shows it with the
  computed amount → update → void → restore → expense with a tiny PNG receipt → `receipt`
  returns the same bytes. Then read the sheet's Test and History tabs back.

## Deploy & recovery

1. Code lands in PR `claude/money-tab` (`SNA-Money.gs`, `index.html`, tests, tools, README,
   this spec and the plan).
2. Apps Script (Alan's Chrome): new standalone project **SNA Money** → paste `SNA-Money.gs`
   (verify the editor text hashes to the repo file) → save → Deploy ▸ New deployment ▸ Web
   app, Execute as **Me**, access **Anyone** → **Alan: Allow** on Google's screen → copy the
   `/exec` URL into `MONEY_API` in `index.html`.
3. **Alan:** Project Settings ▸ Script properties ▸ `MONEY_KEY` = the coach key.
4. Live verification (above), then Alan merges the PR; Pages publishes the tab.
5. Later changes to the `.gs`: Deploy ▸ Manage deployments ▸ edit ▸ **New version**, never a new
   deployment (the URL would change).
6. Registry: `~/ai-system/REGISTRY.yaml` gets the `sna-money` service (project id, deployment
   id, sheet, folder, used_by) and the `sna-money-key` secret by name only.
7. Recovery: the sheet and folder are ordinary Drive files owned by Alan (version history
   applies); a lost project is rebuilt from `SNA-Money.gs` plus the three ID Script Properties
   pointed at the existing sheet and folders.

## Out of scope (v1)

Billing / owed-but-unpaid tracking, pulling commission sales from the dashboard, bank or
Venmo CSV import, tax-year reports, a separate money key, rate limiting bad keys (the coach
key is memorable; a longer key is the fix and covers Mentees too).

# Sharp Ninja Academy — Master Hub

One page that holds everything Alan and Ben need to run the Academy program.
Built to be printed: plan the calls, then export a clean image.

**Live:** https://allinalan.github.io/sna-master-hub/

---

## What's in it

The bold tabs across the top: **Campaign Calendar** · **Performance** · **Mentees** ·
**Assignments** · **Orders of Business** · **Money**. A tab with more than one page grows a row
of sub-tabs under it.

| Tab | What it's for |
|---|---|
| **Campaign Calendar** | Every call night, one year at a time — topic, track, who's hosting, second call, notes. Filter by campaign or by host. |
| **Orders of Business** | Everything you two still owe each other, one flat list. Tick it off, put a name on it (Alan, Ben, or both), give it a note, a due date, a section, a topic, an urgency and an importance. Overdue goes red, due-within-a-fortnight goes amber. Filter by any of those, and sort by **Priority** (urgency and importance added together, so 1+1 is first), urgency, importance, due date or section. Sections aren't headers any more — each row wears its section as a chip; click it to move the item, or type a new section name right there. |
| **Performance** | The [mentee dashboard](https://allinalan.github.io/sna-dashboard/), embedded live (`?embed=1` drops its chrome). One codebase serves this tab and every rep's private `?rep=` link — so they can never drift out of sync. A bare visit to the old standalone URL redirects here. Every mentee now has **two boards** in there — **Performance** and **Skillset** — on their own tabs. |
| ↳ Skillset | The skills off Alan's skillset sheet, rated **1–10**. Reps rate themselves on their own tab; you read those ratings from **Rep ▸ pick a mentee ▸ Skillset**, and can put your own number beside theirs — **they never see your column**. Anywhere the two are **3 or more apart** is flagged as a blind spot. Reps star five focus skills, ranked, and the top three are the ones that count. Ratings are **versioned, never reset**: a board stays editable for a week, then the next rating opens a new dated one carrying everything forward, so you get the growth and not just the number. The team board at the foot of Performance says who has actually done it, who is moving, and **where the academy is thinnest** — which is where the next campaign's call topics should come from. Coaches can add, rename and retire skills from the board itself. |
| **Mentees ▸ Roster** | Everyone on the Academy, live from the private contacts sheet (behind the coach key). Each row links out to that mentee's **dashboard** and straight to their **skillset**. **Program** and **Coach** filters are multi-select — light up Path *and* Masters, or Alan *and* Ben, to see them side by side; **Group** splits the board into labelled blocks per coach or per program. Assign a coach on any Path or Masters row. The Dojo doesn't get check-in calls, so Dojo rows show no coach picker, never count as Unassigned, and sit in their own block when grouping by coach; the day someone's program changes to Path they flip to Unassigned on their own. A coach name left on a Dojo row from before shows faintly with a `clear` link. |
| ↳ Weekly Check-ins | One coloured square per Path/Masters mentee per Vector week (Tuesday to Monday) of the campaign, each column headed "Wk 1 · 9/1–9/7" (The Dojo doesn't get check-in calls, so it isn't on this board). Click a square: **green** check-in call · **purple** 1-1 call · **blue** voice note / texts · **red** missed · **black** not needed (vacation etc.). Same filters and grouping as the roster; the board starts clean each campaign and older campaigns stay in the picker. Marks are shared between Alan and Ben. A **purple** square also counts as that mentee's formal 1-on-1 for the month on the Performance tab's Calls board (booked while the week is running, completed once it ends) — so Ben's calls, which book on his calendar and never reach the Calls sheet, still show up there. |
| **Assignments** | The homework loop, behind the coach key. **Catalog**: what each program owes this campaign (tick which programs an assignment applies to — a Dojo assignment pre-ticks Path and Masters). **Board**: one row per mentee, one column per assignment — yellow not due, red overdue, black not applicable, green submitted (● waiting on you · ✎ waiting on them · ✓ approved). Click a cell to read the work, post feedback, approve, set a per-mentee due date, or email a reminder. Mentees submit from their dashboard; they get an email when you reply. Mark someone **former** on the roster and they drop off the board and out of its counts straight away; their work stays in the sheet, and **reactivate** brings them back. **Show former** lists them at the foot of the board, faded and never counted, so you can still look up what they turned in — their cells open read only, so nobody emails someone who has left. |
| **Money** | What came in, what went out, and who owes whom — behind the coach key. **+ Income** from a mentee as **% of commission sales** (type the sales and the rate; the hub does the multiplying) or **flat**, received by Ben unless you pick Alan; **+ Expense** with who paid, a category and a receipt photo or PDF; **Settle up**. Every entry splits **Ben 60 · Alan 40** unless you change it on that entry. Pick a campaign for its income, expenses, profit, each share and a card saying who owes whom; when the campaign ends, **Record settle-up** and the card reads **Settled ✓**. Details in [Money](#money). |
| ↳ Topic Bank | All 71 topics we can teach, by category. Each is auto-checked against the archive and the calendar, so you can see what's been run, what's still scheduled, and what's never been touched. A call that has already happened counts as run, automatically. |
| ↳ Call Archive | Every group call back to Dec 2024 — so we don't repeat a topic by accident. |
| ↳ Guest Speakers | The bench, what they'd teach, when we last asked. |

Source: the Google Sheet **Group Calls 2026**.

---

## Printing an image

On any tab:

- **Export PNG** — downloads a PNG of just that board (no toolbars, no browser chrome). Fonts are embedded, so it looks exactly like the screen. Filter to one campaign first if you want something short enough to read in a text.
- **Print / PDF** — opens the print dialog. Choose "Save as PDF" for a multi-page version.

---

## Editing

Hit **Edit** in the header, then click any field and type. It saves as you type — you
don't have to press anything. Enter or clicking away finishes the field.

Edit mode also turns on the structural controls, so the hub never needs a code change:

| To do this | Where |
|---|---|
| Plan a week | Click the "+ open — click to plan" line |
| Move a call to a different night | Click that call's date and pick the night — see below |
| Change a call's time | Click its time and pick one — all times are Central |
| Change who's on a call | Click the name chip and pick — Alan, Ben, both, or any wording already in use |
| Move every call's time at once | Click the standing time in the line under the page title |
| Remove a week entirely | `×` next to the weekday |
| Add a track, 2nd call, note, or long detail to a week | The small `+ track` / `+ 2nd call` / `+ note` / `+ detail` buttons under it |
| Wipe a week back to open | `clear` on that week |
| Add a whole year | `+ 2028` next to the year picker |
| Add or delete a topic | `+ topic` at the bottom of a category, `×` on any topic |
| Add, rename, or delete a category | `+ category` in the toolbar; click a category's name to rename; `×` in its header |
| Add or delete a backlog list | `+ list` next to Backlog |
| Add or delete an archived call / guest speaker | `+ call` / `+ speaker` in the toolbar, `×` at the end of the row |
| Add or delete an order of business | `+ item` at the foot of the list (it lands in the section you're filtered to, else the first), `×` on the row. A new section is typed into the section chip's picker; a section empties itself out of existence when its last item leaves |

Emptying an optional field (track, note, 2nd call, detail) removes it rather than
leaving a blank chip behind.

### Orders of Business works without Edit mode

Ticking a box, assigning an owner, setting a due date, writing a note, and giving an item
a section, a topic, an urgency and an importance are the whole point of that tab, so they
all stay clickable with Edit **off**. Edit mode there is only for adding and deleting.
Click a due date to pick one off the calendar, same as anywhere else in the hub. Every
row has a note line — it reads as a faint `+ note` until you click into it.

### Urgency and importance are 1 to 5, and 1 is the top

Think of both scales as a countdown, not a score: **1 means do it now / it really
matters, 5 means whenever / barely matters.** The names are just labels for the numbers,
so sorting always puts the sharpest items first.

| | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| **Urgency** | Now | This week | Soon | Can wait | Whenever |
| **Importance** | Critical | High | Medium | Low | Minor |

Each item shows three small chips under its title: **topic**, **urgency**, **importance**.
Click one to set it. Unset chips sit faintly until you hover the row, and they never
print or export. A topic is a free tag (`Recruiting`, `Curriculum`, whatever you like):
the picker lists every topic already on the board so the spelling stays consistent, and
has a box for a new one. Topics aren't sections — a section is where an item lives, a
topic is what it's about, and an item in any section can carry any topic.

Ticking something off does **not** hide it. It gets crossed out, sinks to the bottom of
its section, and flashes for a moment so you can see where it went. Click the box again
to put it back. Once an item is ticked, a `×` appears on its row so you can bin it for
good without turning on Edit — that one asks for confirmation.

Filters across the top, in two rows:

- **Everything** (the default) · **Hide done** · **Done only**
- **Who** — Anyone / Alan / Ben / Unassigned
- **Due** — Any / Overdue / 7 days / 14 days / Dated / Undated. The 7- and 14-day windows
  include anything overdue: something due last Friday still needs doing this week.
- **Urgency** and **Importance** — Any / 1 / 2 / 3 / 4 / 5 / Unrated. These are
  multi-select, like the Mentees filters: light up 1 *and* 2 to see both.
- **Section** and **Topic** — pick one from the dropdown, or **No topic** for the untagged.
- **Sort** — Due date (the default), Urgency or Importance.

A **Clear filters** button appears whenever anything is narrowed. Sections sort open
items first, then by the chosen sort (urgency or importance, with the other as the
tie-break), then soonest date first, undated last, done at the bottom. Adding an item
while a filter would hide it clears the filters first, so a new task never lands out of
sight.

### Dates and times are picked, never typed

**Every date in the hub is a button.** Click it and a small calendar opens — pick the day
and you're done. Nothing anywhere asks you to type a date: not call nights, not due dates
on Orders of Business, not "last asked" on the guest bench, not the due dates in
Assignments.

**Times work the same way, and they are all Central.** Click any call's time and pick one
off the list — quarter-hour steps around the clock, opened scrolled to whatever it's on
now, the picker's header naming the zone once. Times are stored as plain 24-hour values
behind the scenes, so Alan's board and Ben's can never disagree about what "7PM" meant,
but **the board never shows you 24-hour time** — it reads `3:30PM CDT`, always with AM/PM,
even on a phone whose clock is set to 24 hours. The `CST` / `CDT` half of that label is
worked out from the call's own night, so a summer call says `CDT` and a January one says
`CST` without anyone maintaining it.

There are two levels:

- **The standing time**, in the line under the page title. Change it and every call moves
  with it — that's the one to touch when the whole programme shifts an hour.
- **One call's time.** Click the time on that call. The footer says what clearing it does:
  the first call on a week goes back to the standing time; an added call simply shows no
  time at all, which is what it does today when you never set one.

The calendar's columns run **Tue → Mon**, so **every row of it is one Vector week** — the
same week the check-in board counts in. Moving a call inside its own week is one step
sideways, and the week the call already sits in is shaded so you can see where it ends.

`‹` and `›` change month. Today has a ring around it. Where it makes sense the footer
offers a shortcut — **Today**, **Clear**, or, on an added call, **On the week's night**,
which drops the call back onto whatever night its week runs.

### Who's on the call

**Presenters are picked too.** Click the name chip on any call — **Alan**, **Ben** and
**Alan & Ben** sit at the top, and everything already in use on the board is listed
underneath: `Ben (no Alan)`, `Alan (Ben tiny part)`, `Alan–Ben (hunting)` and the rest,
spelled exactly the way they already are. The shades matter, so the picker keeps them
rather than flattening every call to one of three names. Clearing puts a call back to
**TBD**, and the Host TBD count at the top of the board follows.

The same chip does the job on the **Call Archive**, and on **Orders of Business** — where
it says who owns an item, offers Alan, Ben, or **Alan & Ben** for something you're both on,
and works without turning Edit on, same as the due date beside it. The **Who** filter's
Alan and Ben buttons include shared items; **Both** shows only the shared ones.

### Moving a call

**Every call has its own night.** In Edit mode each call on a week shows its date —
`Mon Sep 14`, `Tue Sep 8` — click it to pick a new one. A week isn't locked to Tuesday,
and neither is anything on it: a week can hold a Tuesday call, a Thursday hot seat and a
Monday call.

**Which date you click matters:**

- **The first (main) call's date** — or the big date on the left of the row — moves the
  **whole week**. Everything on it that hasn't been given its own night comes along, the
  weekday label and week numbers update themselves, and the board re-sorts. Page the
  picker into another year and the week moves to that year's board, taking you with it.
- **Any additional call's date** moves **just that call**. **On the week's night** in the
  picker's footer puts it back.

With Edit off, a date only shows on a call that has moved off the week's night — so the
printed board stays clean. The week lists its calls in the order they actually run —
Tuesday, then the Thursday hot seat, then the Monday that closes it — and **Next call
night** counts them one by one, so a call that has moved shows up when it actually runs.

If you move a call onto a night that already has one, it lets you — two calls in a night
is a real thing — but it says so.

### Shared editing is ON

Alan and Ben edit the same copy. Your changes push about a second after you stop
typing; theirs arrive within 25 seconds, or instantly when you switch back to the tab.
Other tabs of your own browser follow each other the instant one of them saves, so a
tab left open on another board never falls behind the one you're typing in.
The header shows `shared · Ben 3m ago` instead of `seed data`.

The shared copy lives in the Google Sheet **SNA Master Hub Data**, written by the
Apps Script project **SharpNinja Hub** ([`SharpNinja-Hub-Sync.gs`](SharpNinja-Hub-Sync.gs)).
The first time you open the hub it asks whether you're Alan or Ben, so edits get labelled.

If you edit the `.gs`, you must **Deploy ▸ Manage deployments ▸ edit ▸ New version** —
otherwise the web app keeps serving the old code. If you ever create a *new* deployment
instead, the /exec URL changes and `SYNC.url` in `index.html` has to be updated to match.

**If you both edit at once**, whoever saves second gets a "Both of you edited this"
prompt with *Keep mine* / *Take theirs*. Nothing is ever really lost — the Google Sheet
keeps its own version history (File ▸ Version history).

**The prompt names you?** Then another copy of the hub signed with your name saved —
your phone, another browser, or a tab that was already behind — and this copy hadn't
caught up before you edited it. It says so ("You saved this from another tab or device"),
and *Take the other copy* is the default: keeping this copy would silently overwrite
everything the other one saved, whereas taking it costs you just the one thing you last
changed here. Redo that and carry on.

**A save whose reply never came back** (lid closed on "saving…", a WiFi blip) does not
raise the prompt. The Sheet had already taken it, so the retry recognises its own copy
and just moves on. Until this was added, that retry read "Ben saved changes while you
were editing" on Ben's own screen — the hub only knows names, not tabs, so it couldn't
tell Ben from Ben.

**A note on the write endpoint.** Because this page is public and static, the /exec URL
and its token sit in the page source. That's enough to keep out drive-by traffic, but
someone who went looking could write to the sheet. The exposure is a planning calendar,
every save is versioned, and the sheet's history can roll anything back — but that's the
trade for a free, no-login, works-anywhere setup. If you'd rather not take it, leave
`SYNC.url` empty and use the Data ▸ Copy / Load hand-off instead.

## Money

What came in, what went out, and who owes whom — between Alan and Ben, settled once a
campaign. It sits behind the coach key like Mentees and Assignments, and it does **not** use
the shared hub copy: that copy is readable by anyone who reads this page's source, so the
books live in their own private Google Sheet.

### Logging

- **+ Income** — who paid (a mentee off the roster, someone who paid before, or anyone) and
  how: **% of commission sales** (type their commission sales and the rate; the amount shows
  as you type, and the sheet works it out again itself) or **Flat**. A mentee's next entry
  starts from the plan and rate they were on last time. **Received by** starts on **Ben**,
  because that's where the money lands; pick **Alan** for the odd Venmo.
- **+ Expense** — what it was for, a category (pick one or type a new one), the amount,
  **Paid by**, and a receipt photo or PDF if you have one. Big phone photos are shrunk before
  they're sent.
- **Settle up** — who paid whom, and how much.

Every income and expense entry carries its own split: **Ben 60 · Alan 40** unless you pick
50 · 50, all Ben, all Alan or a custom share on that entry. The split is stored on the entry,
so if the deal ever changes, old campaigns keep the math they were settled on.

Each entry also carries its **campaign** (Spring Jan–Apr · Summer May–Aug · Fall Sep–Dec). A
new entry goes into the campaign you're looking at, so a back-end charge for Fall that lands in
January still counts toward Fall — look at Fall, then add it. Under **All campaigns** the
campaign follows the date until you pick one.

Nothing autosaves. **Save** sends the entry, and the drawer only closes once the sheet has
said yes. If it didn't go through, the drawer stays open and says why in red. If the reply
never came back, it says the entry *may* be in — pressing Save again can't add it twice, and
closing the drawer reloads the list so you can see whether it landed.

### Settling a campaign

Pick the campaign. The stats show its income, expenses, profit and each of your shares, and
the card says who owes whom:

- each person's **share** = their % of the income − their % of the expenses
- what each person **holds** = income they received − expenses they paid ± settle-ups
- the difference is what one of you owes the other.

Say $10,000 came in to Ben, Alan paid $500 of expenses and Ben paid $300: profit is $9,200, so
Ben's share is $5,520 and Alan's $3,680. Ben holds $9,700 and Alan is $500 out of pocket, so
**Ben owes Alan $4,180.00**.

While a campaign runs the card reads **So far:** and offers **Settle up now**. Once it has
ended it reads **Ben owes Alan $4,180.00 for Fall 2026** with **Record settle-up**, which opens
a settle-up already filled in (change the amount for a part payment). After that the card
reads **Settled ✓**. Adding or changing an entry after the settle-up reopens it with whatever is
left. A campaign that ended and never settled shows as a red line at the top of every other
campaign until it is.

### Nothing disappears

- **Void** takes an entry out of every total but keeps it — crossed out, behind **Show
  voided** — and **Restore** brings it back.
- If the other person changed an entry while you had it open, saving asks whose version wins.
- Every change is also written to the sheet's **History** tab (who, when, what the entry
  became), on top of Google's own version history.
- A row edited by hand in the sheet so that it no longer reads (a word in the Amount column,
  say) is listed in red with its row number, its campaign's figures show as **—**, and it won't
  show a settlement until
  the row is fixed. The first 24 columns of the Ledger tab have to keep their headers, in
  order; add your own columns after them.

### Where it lives

| What | Where |
|---|---|
| The web app | Apps Script project **SNA Money**, code in [`SNA-Money.gs`](SNA-Money.gs); its `/exec` URL is `MONEY_API` in `index.html` |
| The ledger | Google Sheet **SNA Money** in Alan's Drive — tabs **Ledger**, **History** and **Test**. Only the published hub (allinalan.github.io) reads and writes **Ledger**; any other copy of the page — your machine, a file, a LAN address — uses **Test**, and says so in a yellow badge. |
| Receipts | Drive folder **SNA Money Receipts** (test receipts in its **Test** folder) |
| The key | Script property `MONEY_KEY` in the SNA Money project — the same value as the coach key. The script records the sheet and folder IDs as script properties itself (`MONEY_SHEET_ID`, `MONEY_FOLDER_ID`, `MONEY_TEST_FOLDER_ID`). |

Changing the coach key? Change `MONEY_KEY` to match, or the Money tab will say the sheet
doesn't accept the key.

After editing `SNA-Money.gs`, paste it into the project and **Deploy ▸ Manage deployments ▸
edit ▸ New version**. A new deployment would change the `/exec` URL.

### Trying it out and testing it

```bash
node tests/money-backend.test.js
```

```bash
node tests/money-math.test.js
```

```bash
node tools/dev-server.js
```

The backend test runs `SNA-Money.gs` on fake Apps Script services; the math test runs the
settlement arithmetic out of `index.html`. The dev server serves this page at
`http://localhost:8830/#money` (coach key `dev`) with hub sync switched off and both backends
replaced by in-memory fakes — invented mentees and the real `SNA-Money.gs` — so nothing it does
reaches Google. It refuses to start if it can't switch all three off.

## Weekly check-ins

Weeks are Vector weeks, **Tuesday to Monday**, headed with their dates ("Wk 1 · 9/1–9/7").
A week belongs to the campaign its **Friday** (the week's middle day) falls in
(Spring Jan–Apr · Summer May–Aug · Fall Sep–Dec), so the week that straddles a campaign
boundary shows up on exactly one board: Fall 2026 opens with Wk 1 = 9/1–9/7 and runs 17
weeks to 12/22–12/28. If Vector ever counts a boundary week differently, `weekCampaign()`
in `index.html` is the one place that decides. A month band runs across the top of the board.
Vector months aren't calendar months: each month of a campaign is **four weeks** and the
campaign's last month takes what's left, so Fall is Sep · Wk 1–4, Oct · Wk 5–8, Nov · Wk 9–12,
Dec · Wk 13–17 (Wk 13 starts 11/24 but counts as December). A heavier rule marks where each
month starts and alternate months are faintly shaded. `MONTH_SPLIT` in `index.html` holds the
split per campaign length; an 18-week campaign currently gives its last month six weeks —
change that line if the Vector calendar says otherwise. The current week's column is
highlighted; a past week left blank gets a dashed outline so an unrecorded check-in is easy to spot.

The stat strip counts what's on screen after filters: this week's tally, how many squares
are still blank this week, red squares this campaign, and coverage (green + purple + blue,
over every past week that wasn't marked black). The number at the end of each row is the
same thing per mentee.

Marks live in the shared hub data (`checkins[campaign][RepID][week]`), synced like the
calendar, so both coaches see the same board. Because you two will often be marking the
same board on the same call, a check-in mark never triggers the "Both of you edited this"
prompt: if a save collides, the hub takes the other person's copy, puts your marks back on
top, and saves again. Any other kind of edit still asks, as before.

## Adding a tab

`index.html` is one self-contained file with no dependencies. To add a tab:

1. Add your data under a new key in `SEED` (near the top of the `<script>`).
2. Write a render function that returns an HTML string.
3. Add one line to the `TABS` array, naming the section it belongs under:

```js
{id:"notes", label:"Notes", sub:"Notes", section:"business", count:()=>DATA.notes.length, render:renderNotes}
```

Use `section:"calendar"` or `section:"business"` to nest it as a sub-tab, or add an
entry to `SECTIONS` to give it a bold tab of its own. A section with more than one page
grows its sub-tab row automatically.

The tab bar, routing, edit mode, saving, PNG export and printing all pick it up. Use
`ed("path.to.field", value)` to make a field editable, or `edLive(...)` for a field that
stays editable with Edit mode off.

---

## The calendar rolls itself forward

The hub always keeps **this year and next year** on the board. Open it any time in 2026
and Spring 2027 is already there to plan; on 1 January 2027 it quietly adds 2028. Nobody
has to remember, and I don't have to touch the code.

Switch years with the picker on the left of the calendar toolbar. `+ 2028` adds a year
by hand if you want to get further ahead. New years are generated on the same weekday
your existing calls use — read off the data, not hardcoded to Tuesday — so if the call
night ever moves, next year follows it.

Everything stays on one board: 2026 doesn't get archived when it ends, you just switch
the year. The **Call Archive** tab remains the record of the calls that predate this hub.

## Notes

- No build step, no dependencies, no framework. Double-clicking `index.html` works
  offline (PNG export falls back to system fonts in that case).
- The calendar shows an **alt draft** line on some weeks — a second 2026 plan that was
  sitting at the bottom of the sheet's archive tab. It's kept on screen so you can pick
  between the two, and it's hidden from exports and printouts.
- Four August weeks show a **proposed** topic (Summer Game Plan, Time/Energy/Health,
  Summer Standards, Obstacle Proofing). Those came from the "Units" column lined up
  against those rows — confirm or clear them.
- Related: the [SNA mentee dashboard](https://allinalan.github.io/sna-dashboard/), which
  reads live rep performance data from a separate sheet.

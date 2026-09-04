# Sharp Ninja Academy — Master Hub

One page that holds everything Alan and Ben need to run the Academy program.
Built to be printed: plan the calls, then export a clean image.

**Live:** https://allinalan.github.io/sna-master-hub/

---

## What's in it

Two things matter most, so they're the bold tabs across the top:

**Campaign Calendar** · **Orders of Business**

Everything else lives as a sub-tab under Campaign Calendar.

| Tab | What it's for |
|---|---|
| **Campaign Calendar** | Every call night, one year at a time — topic, track, who's hosting, second call, notes. Filter by campaign or by host. |
| **Orders of Business** | Everything you two still owe each other, in sections. Tick it off, put a name on it, give it a due date. Overdue goes red, due-within-a-fortnight goes amber. |
| **Performance** | The [mentee dashboard](https://allinalan.github.io/sna-dashboard/), embedded live (`?embed=1` drops its chrome). One codebase serves this tab and every rep's private `?rep=` link — so they can never drift out of sync. A bare visit to the old standalone URL redirects here. |
| **Mentees ▸ Roster** | Everyone on the Academy, live from the private contacts sheet (behind the coach key). **Program** and **Coach** filters are multi-select — light up Path *and* Masters, or Alan *and* Ben, to see them side by side; **Group** splits the board into labelled blocks per coach or per program. Assign a coach on any Path or Masters row. The Dojo doesn't get check-in calls, so Dojo rows show no coach picker, never count as Unassigned, and sit in their own block when grouping by coach; the day someone's program changes to Path they flip to Unassigned on their own. A coach name left on a Dojo row from before shows faintly with a `clear` link. |
| ↳ Weekly Check-ins | One coloured square per Path/Masters mentee per Vector week (Tuesday to Monday) of the campaign, each column headed "Wk 1 · 9/1–9/7" (The Dojo doesn't get check-in calls, so it isn't on this board). Click a square: **green** check-in call · **purple** 1-1 call · **blue** voice note / texts · **red** missed · **black** not needed (vacation etc.). Same filters and grouping as the roster; the board starts clean each campaign and older campaigns stay in the picker. Marks are shared between Alan and Ben. |
| **Assignments** | The homework loop, behind the coach key. **Catalog**: what each program owes this campaign (tick which programs an assignment applies to — a Dojo assignment pre-ticks Path and Masters). **Board**: one row per mentee, one column per assignment — yellow not due, red overdue, black not applicable, green submitted (● waiting on you · ✎ waiting on them · ✓ approved). Click a cell to read the work, post feedback, approve, set a per-mentee due date, or email a reminder. Mentees submit from their dashboard; they get an email when you reply. |
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
| Remove a week entirely | `×` next to the weekday |
| Add a track, 2nd call, note, or long detail to a week | The small `+ track` / `+ 2nd call` / `+ note` / `+ detail` buttons under it |
| Wipe a week back to open | `clear` on that week |
| Add a whole year | `+ 2028` next to the year picker |
| Add or delete a topic | `+ topic` at the bottom of a category, `×` on any topic |
| Add, rename, or delete a category | `+ category` in the toolbar; click a category's name to rename; `×` in its header |
| Add or delete a backlog list | `+ list` next to Backlog |
| Add or delete an archived call / guest speaker | `+ call` / `+ speaker` in the toolbar, `×` at the end of the row |
| Add or delete an order of business / section | `+ item` at the foot of a section, `+ section` in the toolbar, `×` on the row |

Emptying an optional field (track, note, 2nd call, detail) removes it rather than
leaving a blank chip behind.

### Orders of Business works without Edit mode

Ticking a box, assigning an owner and setting a due date are the whole point of that
tab, so they stay clickable with Edit **off**. Edit mode there is only for adding and
deleting. Click a due date to pick one off the calendar, same as anywhere else in the hub.

Ticking something off does **not** hide it. It gets crossed out, sinks to the bottom of
its section, and flashes for a moment so you can see where it went. Click the box again
to put it back. Once an item is ticked, a `×` appears on its row so you can bin it for
good without turning on Edit — that one asks for confirmation.

Filters across the top: **Everything** (the default), **Hide done**, **Has a date**,
**Done only**, plus Alan / Ben / Unassigned. Sections sort open items first, soonest
date first, undated last, done at the bottom.

### Dates are picked, never typed

**Every date in the hub is a button.** Click it and a small calendar opens — pick the day
and you're done. Nothing anywhere asks you to type a date: not call nights, not due dates
on Orders of Business, not "last asked" on the guest bench, not the due dates in
Assignments.

The calendar's columns run **Tue → Mon**, so **every row of it is one Vector week** — the
same week the check-in board counts in. Moving a call inside its own week is one step
sideways, and the week the call already sits in is shaded so you can see where it ends.

`‹` and `›` change month. Today has a ring around it. Where it makes sense the footer
offers a shortcut — **Today**, **Clear**, or, on an added call, **On the week's night**,
which drops the call back onto whatever night its week runs.

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

**A note on the write endpoint.** Because this page is public and static, the /exec URL
and its token sit in the page source. That's enough to keep out drive-by traffic, but
someone who went looking could write to the sheet. The exposure is a planning calendar,
every save is versioned, and the sheet's history can roll anything back — but that's the
trade for a free, no-login, works-anywhere setup. If you'd rather not take it, leave
`SYNC.url` empty and use the Data ▸ Copy / Load hand-off instead.

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
{id:"money", label:"Money", sub:"Money", section:"business", count:()=>DATA.money.length, render:renderMoney}
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

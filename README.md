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
| Move a call to a different night | Click the date and retype it — see below |
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
deleting. Due dates take the same forgiving formats as call dates ("Sep 3", "9/3").

Ticking something off does **not** hide it. It gets crossed out, sinks to the bottom of
its section, and flashes for a moment so you can see where it went. Click the box again
to put it back. Once an item is ticked, a `×` appears on its row so you can bin it for
good without turning on Edit — that one asks for confirmation.

Filters across the top: **Everything** (the default), **Hide done**, **Has a date**,
**Done only**, plus Alan / Ben / Unassigned. Sections sort open items first, soonest
date first, undated last, done at the bottom.

### Moving a call

Click the date on any week and type the new one. It's forgiving about format — all of
these work:

```
Jan 6      January 6th      6 Jan      1/6      1/6/27      01-06-2027      2026-01-06
```

Leave the year off and the week keeps the year it's already in, so nudging a 2027 call
to "Jan 13" won't drag it back to this year. The weekday label and the week numbers
update themselves, and the board re-sorts. Put a year on it and the week moves to that
year's board, taking you with it.

Nonsense ("Feb 30", "next tuesday") is rejected and the week is left exactly as it was.
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

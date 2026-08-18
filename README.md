# Sharp Ninja Academy — Master Hub

One page that holds everything Alan and Ben need to run the Academy program.
Built to be printed: plan the calls, then export a clean image.

**Live:** https://allinalan.github.io/sna-master-hub/

---

## What's in it

| Tab | What it's for |
|---|---|
| **Campaign Calendar** | Every call night, one year at a time — topic, track, who's hosting, second call, notes. Filter by campaign or by host. |
| **Topic Bank** | All 71 topics we can teach, by category. Each one is auto-checked against the archive and the calendar, so you can see what's been run, what's still scheduled, and what's never been touched. A call that has already happened counts as run, automatically. |
| **Call Archive** | Every group call back to Dec 2024 — so we don't repeat a topic by accident. |
| **Guest Speakers** | The bench, what they'd teach, when we last asked. |

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
| Add a track, 2nd call, note, or long detail to a week | The small `+ track` / `+ 2nd call` / `+ note` / `+ detail` buttons under it |
| Wipe a week back to open | `clear` on that week |
| Add a whole year | `+ 2028` next to the year picker |
| Add or delete a topic | `+ topic` at the bottom of a category, `×` on any topic |
| Add, rename, or delete a category | `+ category` in the toolbar; click a category's name to rename; `×` in its header |
| Add or delete a backlog list | `+ list` next to Backlog |
| Add or delete an archived call / guest speaker | `+ call` / `+ speaker` in the toolbar, `×` at the end of the row |

Emptying an optional field (track, note, 2nd call, detail) removes it rather than
leaving a blank chip behind.

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
3. Add one line to the `TABS` array:

```js
{id:"money", label:"Money", count:()=>DATA.money.length, render:renderMoney, printable:true}
```

The tab bar, routing, edit mode, saving, PNG export and printing all pick it up
automatically. Use the `ed("path.to.field", value)` helper to make a field editable.

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

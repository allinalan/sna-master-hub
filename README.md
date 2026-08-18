# Sharp Ninja Academy — Master Hub

One page that holds everything Alan and Ben need to run the Academy program.
Built to be printed: plan the calls, then export a clean image.

**Live:** _(GitHub Pages URL goes here once deployed)_

---

## What's in it

| Tab | What it's for |
|---|---|
| **Campaign Calendar** | Every Tuesday of 2026 — topic, track, who's hosting, second call, notes. Filter by campaign or by host. |
| **Topic Bank** | All 71 topics we can teach, by category. Each one is auto-checked against the archive and the 2026 calendar, so you can see what's been run, what's scheduled, and what's never been touched. |
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

Hit **Edit** in the header, then click any field and type. Enter saves, Escape cancels.

Everything you type saves to **your own browser** (localStorage) — it does not sync
between Alan and Ben automatically. To hand a plan over:

1. **Data ▸ Copy** (or **Download**)
2. Send it to the other person
3. They open **Data**, paste it in, hit **Load pasted JSON**

**Data ▸ Reset to seed** throws away local edits and goes back to the version baked
into this file.

To make an edit permanent for everyone, send the downloaded JSON to Claude and ask
for it to be committed — it replaces the `SEED` block in `index.html`.

---

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

## Notes

- No build step, no dependencies, no server. Double-clicking `index.html` works offline
  (PNG export falls back to system fonts in that case).
- Related: the [SNA mentee dashboard](https://allinalan.github.io/sna-dashboard/), which
  reads live rep performance data from a separate sheet.

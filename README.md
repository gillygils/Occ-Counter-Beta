# Operation Christmas Child – Shoebox Counter

A super simple page with a big **Total Packed** number and **+1 / −1** buttons.

## Option A: one device (no setup)

Double-click `index.html` to open it in a browser. The total is saved in that browser.

## Option B: shared total across phones/laptops

Needs [Node.js](https://nodejs.org) (no `npm install` required).

```sh
node server.js
```

Open `http://localhost:3000` on that computer, or `http://<that-computer's-IP>:3000`
from phones on the same Wi-Fi. Everyone sees the same total (updates every 2 seconds),
and it's saved to `count.json` so it survives a restart.

Use a different port with `PORT=8080 node server.js`.

## Your own logo

Put an image named `logo.png` in this folder and it replaces the built-in gift-box graphic.

## Pages

Tap the gift-box logo on any page to open the menu:

- **Counter** – +1 / −1 buttons, the church name, and **Save to log**
- **TV display** – full-screen total (same as adding `#tv` to the address)
- **Packing log** – saved totals with their date and church and a total line. Opens on
  this year; pick another year or one church from the dropdowns
- **Packing history** – a total for every year; tap a year to see each church's total

## Church name and the packing log

Type the church in **Church packing** on the counter page. It shows as
"*Church Name* Total Packed" on phones and the TV.

Pick the **Date packed** (defaults to today) and tap **Save to log**. Saving the same
church and date again updates that row instead of adding a duplicate. Delete a row on
the Packing log page (tap Delete twice).

The log needs `server.js`. It's stored in `log.json`; the current total and church
are in `count.json`.

## Shortcuts

- `+` or ↑ adds one, `-` or ↓ subtracts one
- **Reset to 0** (bottom right) sets the total back to 0 and clears the church name, after a second tap

## TV display

Add `#tv` to the end of the address, e.g. `http://localhost:3000/#tv` or
`https://boxes.yourdomain.com/#tv`. The page fills the screen with a huge total and
hides the buttons. With `server.js` it updates live as phones add boxes. Press F11
for full screen in most browsers.

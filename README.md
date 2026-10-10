# Operation Christmas Child – Shoebox Counter (beta)

Live shoebox counter for packing parties. Up to 5 churches can pack at the same time,
each with its own PIN-protected counter, a TV display, and a shared packing log.

## Run it

Needs [Node.js](https://nodejs.org) (no `npm install` required).

```sh
node server.js
```

Open `http://localhost:3000`, or `http://<that-computer's-IP>:3000` from phones on the
same network. Use a different port with `PORT=8080 node server.js`.

Data lives next to `server.js`:

- `data.json` – church accounts (PINs are stored hashed), running sessions, sign-ins
- `log.json` – the packing log

## How a church uses it

1. **Create an account**: church name and a 4–8 digit PIN. Share the PIN with your packers.
2. **Sign in** on each phone: pick the church, enter the PIN.
3. **Start a new session** or **Continue** the running one. The phone remembers this
   choice for 72 hours, so closing the tab goes straight back to the counter.
4. **New session walkthrough**: confirm the church name, then set a **packing goal**.
5. Tap **+1 / −1**. Every phone signed in to the same church shares one count.
   The count saves to the log automatically (one row per session).
6. **Finish session** when packing is done. **Sign out** just signs this phone out.

After 5 wrong PINs, that church's sign-in is locked for 5 minutes.
If 5 churches already have sessions running, a sixth has to wait until one finishes
(sessions untouched for 72 hours stop counting).

## Pages

Tap the gift-box logo on any page to open the menu:

- **Counter** – sign in and count
- **TV display** – `#tv` shows the last church picked on that TV (or the only one
  packing); `#tv-pick` always shows the list
- **Packing log** – saved totals by date and church, with a total line, year and church filters
- **Packing history** – a total for every year; tap a year to see each church's total

## Celebrations

- Every **50 boxes**: confetti shoots up from the bottom of the screen (phones and TV).
- **Goal reached**: the screen goes black, the goal shows in gold with fireworks, then
  returns to normal after about 8 seconds (tap to skip).
- On the TV, a **wall of shoebox bricks** fills from the bottom: one brick per box,
  and the wall is full at the goal.

## Your own logo

Put an image named `logo.png` in this folder and it replaces the built-in gift-box graphic.

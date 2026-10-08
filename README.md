# Splash Pressure Washing — Scheduler

A Calendly-style day picker for [Splash Pressure Washing](https://splashwashing.com), a veteran and firefighter owned company in Chesapeake, VA. Customers pick a **day**, not a time slot.

| Page | URL path | Who uses it |
|---|---|---|
| **Scheduler** | `/scheduler/` | You. Set the days you work, block days off, text a customer a booking link, and get alerted when they pick, change, or cancel a day. Locked with your passcode. |
| **Booking page** | `/book/?l=…` | Your customer. They see only the days in the window you chose, pick one, and enter a name (phone and address optional). No account. |

### Retired tools
The older tools that used to live here (Quote Builder, Content Creator, Wash Window, Pace Gauge, Lead Tracker, Quote Follow-Up, Pricing Agent) have been removed. Their addresses now forward to [splashwashing.com](https://splashwashing.com).

Those tools saved customer info only on the phone or computer that used them, never on a server. Opening this site or the Scheduler on that device deletes what they left behind: saved quotes, leads, settings, offline copies, and their background workers. The Scheduler's own data and sign-in are not touched. Their code is still in this repo's git history if it's ever needed again. That history holds code only, no customer data.

---

## How it flows
1. **Scheduler → Send link.** Optional customer name and service, then choose what they can see: *October*, *November*, *Next 2 weeks*, *Next 30 days*, or a custom range. The preview shows how many open days that window has. **Create link** → **Text it** (your SMS app opens with a ready message), **Share…**, or **Copy**.
2. **The customer opens the link.** They see only that window. Pick October and October is all they get, with no arrows to other months. Only days you're open are tappable. They tap a day, enter their **name (required)** and optionally **phone** and **service address**, and confirm. They can add the day to Google Calendar or Apple/Outlook.
3. **You get alerted.** You get an email, an optional instant phone push, and an all-day event on your Google Calendar. The Scheduler's **Bookings** tab shows a red badge and the new activity.
4. **Changes later.** The same link is the customer's booking page. Reopening it shows their day with **Change day** and **Cancel booking**. Every change or cancellation alerts you again and moves or removes the calendar event.

## Availability tab
- **Days you work:** weekday toggles (default Mon–Sat).
- **Calendar:** tap any day to block it; tap again to reopen it. Tapping a normal day off opens it as a one-off extra day. Booked days show a green count; full days get an amber ring. Day taps and range blocks come with an **Undo**.
- **Block a date range:** for vacations, equipment down, or a rain week.
- **Jobs per day:** a day disappears from every link once it has this many bookings. The default is 1.
- **Earliest booking:** same day, tomorrow, 2 or 3 days out, or 1 or 2 weeks out.

Changes save automatically and apply to every link immediately, including links you already sent.

---

## Who can see what
- **Your bookings** live in a Google Sheet in your own Google account. The booking server only hands the full list to the Scheduler after it checks your passcode.
- **A customer's link** shows that one customer their own booking and nothing else. Anyone holding that link can see and change that one booking, so it's as private as the text you sent it in. Link IDs are 10 random characters and can't realistically be guessed.
- **The pages themselves are public files.** GitHub Pages on a free account can't password-protect a site, so anyone can load the Scheduler's screens. Without your passcode they get the lock screen and no data. No customer data is stored in this repo.
- **The server address in `book/config.js` is public on purpose.** The booking page needs it. It does nothing without your passcode or a customer's link.
- **Your passcode is the one real key.** After 10 wrong tries the server stops accepting passcodes for 15 minutes. That slows guessing but doesn't stop a weak passcode from being guessed eventually, so use 10+ characters that aren't a word or a date. A stranger making wrong guesses also locks you out for those 15 minutes.
- **The Scheduler remembers your passcode on your phone** so you don't retype it. On a device other people use, tap **Settings → Lock this device** when you're done.

---

## Live setup (Google Apps Script)
GitHub Pages only serves static files, so the booking data lives in a free **Google Apps Script** that runs in your own Google account and stores bookings in a Google Sheet you own. One-time setup is about 10 minutes on a computer. The steps are also in **Scheduler → Settings**.

1. Open [sheets.new](https://sheets.new) and name the sheet **Splash Bookings**. Then **Extensions → Apps Script** and delete the sample code.
2. Paste in all of [`scheduler/backend/Code.js`](scheduler/backend/Code.js). Change `ADMIN_PASSCODE` from `'CHANGE-ME'` to your own passcode. Save.
3. Select **setup** in the function menu → **Run** → approve the permissions. Google shows an "unverified app" warning because it's your own private script. Choose **Advanced → Go to … (unsafe) → Allow**.
4. **Deploy → New deployment →** gear → **Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Deploy, then copy the Web app URL (ends in `/exec`).
5. Put that URL in [`book/config.js`](book/config.js). That takes every device live at once and keeps customer links short. This site's `config.js` already has it.
6. Open the Scheduler and enter your passcode.

If you edit the script later, use **Deploy → Manage deployments → Edit → Version: New version** so the URL stays the same.

With `book/config.js` empty, both pages run in **demo mode**. Everything is stored on the one device, so you can click through the whole flow, but customers can't use the links and nothing is emailed.

## Alerts — read this
- **Email** goes to the address in Settings, or to your Google account if that's blank. Gmail may not ring your phone for a message your own account sends to itself, so either use a different address (like a business email) or turn on push.
- **Phone push** uses the free [ntfy](https://ntfy.sh) app: tap **Generate** in Settings, save, subscribe to that topic in the ntfy app, then **Send test alert**. Push alerts pass through ntfy.sh's public server and include the customer's name, phone, and address. Anyone who knows the topic name can read them, so use the generated name (it's random and unguessable), never one you make up, and keep it private.
- **Google Calendar:** bookings become all-day events and move or disappear when the customer changes or cancels. You can turn this off in Settings.

## Things to know
- **Customers aren't notified when *you* cancel.** They don't leave an email. Cancelling from the Scheduler offers a pre-written text to send them, and they'll also see the cancellation if they reopen their link.
- **The default link address looks like `…github.io/skills-github-pages/book/?l=…`.** For a more professional link, point a subdomain such as `book.splashwashing.com` at GitHub Pages using a custom domain. It's a DNS change and nothing in the pages needs to change.
- **Google's script server isn't instant.** Expect a brief loading shimmer when the page opens and a second or two after **Confirm**.
- **Quotas:** a free Google account can send email to 100 recipients a day through Apps Script. That's far above what booking alerts need.
- **Spam guard:** a single link allows 8 customer changes per hour.
- Your bookings live in the Google Sheet (**Links** and **Activity** tabs), so you can view, sort, or export them there anytime.

## Install on your phone
Open `/scheduler/` in Chrome → menu (three dots) → **Add to Home screen** → **Install**. It gets its own icon and opens like an app.

## Files
```
index.html         Forwards to splashwashing.com (and clears the retired tools' data)
cleanup.js         Deletes what the retired tools saved on a device
sw.js              Uninstalls the retired Quote Builder's background worker
book/
  index.html       Customer booking page
  app.js           Calendar, details form, change/cancel, add-to-calendar
  style.css        Styles
  api.js           Talks to the booking server (or runs demo mode)
  config.js        Your Apps Script URL goes here
  logo.svg         Logo
scheduler/
  index.html       Owner app (Bookings / Availability / Send link / Settings)
  app.js           Owner app logic
  style.css        Styles
  manifest.json    Installable app manifest
  sw.js            Service worker (offline app shell, scoped to /scheduler/)
  icons/icon.svg   App icon
  backend/Code.js  Booking server — paste into Google Apps Script
content/, follow-up/, lead-tracker/, pricing-agent/, splash-pace-tracker/, wash-window/
                   Forwarding stubs for the retired tools, plus a worker that uninstalls each one
```

## License

MIT.

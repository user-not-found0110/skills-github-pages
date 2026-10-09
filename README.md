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
- **A customer's link** shows that one customer their own booking (name, day, and service) and nothing else; never their phone or address. Anyone holding that link can see and change that one booking, so it's as private as the text you sent it in. Link IDs are 10 random characters and can't realistically be guessed.
- **Links expire.** A link stops working 30 days after its service day, or 30 days after its window ends if nothing was booked, so an old text can't show a name and date forever. You keep the record in the Scheduler and the sheet.
- **The pages themselves are public files.** GitHub Pages on a free account can't password-protect a site, so anyone can load the Scheduler's screens. Without your passcode they get the lock screen and no data. No customer data is stored in this repo.
- **The server address in `book/config.js` is public on purpose.** The booking page needs it. It does nothing without your passcode or a customer's link, and opening it in a browser only shows a status line.
- **No outside services see your visitors.** The pages load nothing from other sites (the font is served from this site) and never pass their own address to other sites.
- **Your passcode is the one real key.** New passcodes need 10 or more characters. Pick ones that aren't a word, name, date, or phone number. If you sign in with a shorter one saved before this rule, the Scheduler suggests changing it.
- **Ten wrong passcodes pause every sign-in for 15 minutes**, the right passcode included, so nobody can keep guessing at full speed. Devices already signed in keep working. A stranger can trigger the pause on purpose, again and again. If that keeps you out, open Apps Script on a computer, pick **makeOneTimeSignInCode** next to **Run**, and press **Run**. On the sign-in screen, tap **Locked out? Use a one-time sign-in code**, then type that code along with your passcode (and two-step code). It works once, within 15 minutes, and nobody else can see it.
- **Each device signs in once every 90 days.** In between it keeps its own random sign-in key; the passcode itself isn't stored on the phone. **Settings → Lock this device** signs that device out and clears everything from the page, in every open tab. Changing the passcode needs your current passcode (and a two-step code, if that's on) and signs out every other device.
- **What a stolen, signed-in phone can and can't do.** Whoever has it unlocked can see your bookings and change your days, just like you, until you change your passcode, which signs every device out. Left alone, that sign-in lasts up to 90 days. They can't change your passcode, turn two-step sign-in on or off, or change where alerts go (email address or push topic): each of those asks for your passcode, plus a two-step code when that's on. So once you change the passcode, they're fully out, and new bookings don't keep going to them. If a phone or computer that's signed in goes missing, change your passcode.
- **Two-step sign-in (recommended).** Turn it on in **Settings → Two-step sign-in**. After that, signing in on a new device needs your passcode *and* a 6-digit code from an authenticator app on your phone, such as Google Authenticator or Microsoft Authenticator. A wrong passcode and a wrong code get the same answer, so nobody learns which one was right, and each code works only once. Turning it on needs your passcode and signs out every other device. Turning it off needs your passcode and a current code.
- **Lost the phone with your authenticator app?** On a computer, open Apps Script, pick **turnOffTwoStepSignIn** next to **Run**, and press **Run**. That turns two-step sign-in off and signs out every device. Sign in with your passcode, then turn it on again with your new phone.
- **Private notes:** anything you put in (parentheses) in a link's customer name stays in the Scheduler, for example `Sarah Johnson (gate code 4411)` or `Sarah (cell (757) 555-0142)`. The customer only sees `Sarah Johnson`.

---

## Live setup (Google Apps Script)
GitHub Pages only serves static files, so the booking data lives in a free **Google Apps Script** that runs in your own Google account and stores bookings in a Google Sheet you own. One-time setup is about 10 minutes on a computer. The steps are also in **Scheduler → Settings**.

1. Open [sheets.new](https://sheets.new) and name the sheet **Splash Bookings**. Then **Extensions → Apps Script**. Click in the code, press **Ctrl+A** (Cmd+A on a Mac) and **Delete**, so the editor is completely empty. Leftover sample code causes a "Syntax error" on the last line.
2. Paste in all of [`scheduler/backend/Code.js`](scheduler/backend/Code.js). The last line must be `// ---- END OF FILE (Splash Booking backend) ----`; delete anything below it. Change `ADMIN_PASSCODE` from `'CHANGE-ME'` to your own passcode (10+ characters). Save.
3. **setup** is already picked in the function menu next to **Run**. Press **Run** and approve the permissions. Google shows an "unverified app" warning because it's your own private script. Choose **Advanced → Go to … (unsafe)**. If Google lists checkboxes, tick **Select all**, then **Continue** or **Allow**.
4. **Deploy → New deployment →** gear → **Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Deploy, then copy the Web app URL (ends in `/exec`).
5. Put that URL in [`book/config.js`](book/config.js). That takes every device live at once and keeps customer links short. This site's `config.js` already has it.
6. Open the Scheduler and enter your passcode.

With `book/config.js` empty, both pages run in **demo mode**. Everything is stored on the one device, so you can click through the whole flow, but customers can't use the links and nothing is emailed.

### Updating the server code
When a change needs new server code, the pull request says so. On a computer:

1. Open the **Splash Bookings** sheet → **Extensions → Apps Script**.
2. Click in the code, press **Ctrl+A** (Cmd+A on a Mac) and **Delete**. Paste in all of the new [`scheduler/backend/Code.js`](scheduler/backend/Code.js) and check the END OF FILE line is last. Press save. Leave `'CHANGE-ME'` as it is: your passcode is already saved, so you don't change it or run setup again.
3. **Deploy → Manage deployments →** pencil (Edit) → **Version: New version** → **Deploy**. The URL stays the same. If Google asks for permission again, allow it.
4. Open your Web app URL in a browser. It shows `"version"` with the number that's now live.

Update the server code first and merge the pull request after. The new server code still works with the Scheduler that's live before the merge, so nothing breaks in between. If you merge first, the Scheduler's passcode screen tells you the server code is out of date until you update it.

## Alerts — read this
- **Email** goes to the address in Settings, or to your Google account if that's blank. Gmail may not ring your phone for a message your own account sends to itself, so either use a different address (like a business email) or turn on push.
- **Changing where alerts go** (the email address or the push topic) asks for your passcode when you save, plus a two-step code if that's on.
- **Phone push** uses the free [ntfy](https://ntfy.sh) app: tap **Generate** in Settings, save, subscribe to that topic in the ntfy app, then **Send test alert**. Because alerts pass through ntfy.sh's public server, they only say what happened (a new booking, a change, a cancellation), never a name, phone number, or address. Tap one to open the Scheduler and see who. Anyone who knows the topic name can read the alerts, so use the generated name (it's random and unguessable), never one you make up, and keep it private.
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
fonts/             Inter font (SIL Open Font License, see OFL.txt), served from this site
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
  vendor/qrcode.js QR code generator for two-step setup (MIT, Kazuhiko Arase)
  backend/Code.js  Booking server — paste into Google Apps Script
content/, follow-up/, lead-tracker/, pricing-agent/, splash-pace-tracker/, wash-window/
                   Forwarding stubs for the retired tools, plus a worker that uninstalls each one
```

## License

MIT.

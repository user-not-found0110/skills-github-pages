# Splash Pressure Washing — PWAs

Two separate, installable mobile-first apps for [Splash Pressure Washing](https://splashwashing.com), a veteran and firefighter owned company in Chesapeake, VA.

| App | URL path | Purpose |
|---|---|---|
| **Quote Builder** | `/` | Build, save, and PDF customer quotes from your phone. |
| **Content Creator** | `/content/` | Generate daily Google / Facebook / Instagram / blog posts. |
| **Wash Window** | `/wash-window/` | Check this week's forecast and flag the best days to schedule washes (no rain-outs). |
| **Pace Gauge** | `/splash-pace-tracker/` | Track year-to-date revenue against seasonal targets. |
| **Lead Tracker** | `/lead-tracker/` | Work Google LSA leads: instant first-response texts, follow-up due list, review requests. |
| **Quote Follow-Up** | `/follow-up/` | Chase QuoteIQ quotes that went quiet: 6-touch text sequence, win-back list, pipeline $ and win-rate stats. |
| **Scheduler** | `/scheduler/` | Owner app: set the days you work, block days off, text a customer a booking link, get alerted when they pick, change, or cancel a day. |
| **Booking page** | `/book/?l=…` | What the customer sees: only the days in the window you chose, pick one, enter a name (phone and address optional). No account. |

Each app installs as its own Android home-screen icon with its own name. They share nothing at runtime — separate manifests, separate service workers, separate localStorage. You can install one, both, or neither. (Scheduler and the booking page are the exception: they're two halves of one tool and share a small booking server — see below.)

---

## Scheduler + Booking page — `/scheduler/` and `/book/`

A Calendly-style day picker built for washes: customers pick a **day**, not a time slot.

### How it flows
1. **Scheduler → Send link.** Optional customer name and service, then choose what they can see: *October*, *November*, *Next 2 weeks*, *Next 30 days*, or a custom range. The preview shows how many open days that window has. **Create link** → **Text it** (your SMS app opens with a ready message), **Share…**, or **Copy**.
2. **The customer opens the link.** They see only that window. Pick October and October is all they get, with no arrows to other months. Only days you're open are tappable. They tap a day, enter their **name (required)** and optionally **phone** and **service address**, and confirm. They can add the day to Google Calendar or Apple/Outlook.
3. **You get alerted.** You get an email, an optional instant phone push, and an all-day event on your Google Calendar. The Scheduler's **Bookings** tab shows a red badge and the new activity.
4. **Changes later.** The same link is the customer's booking page. Reopening it shows their day with **Change day** and **Cancel booking**. Every change or cancellation alerts you again and moves or removes the calendar event.

### Availability tab
- **Days you work:** weekday toggles (default Mon–Sat).
- **Calendar:** tap any day to block it; tap again to reopen it. Tapping a normal day off opens it as a one-off extra day. Booked days show a green count; full days get an amber ring. Day taps and range blocks come with an **Undo**.
- **Block a date range:** for vacations, equipment down, or a rain week.
- **Jobs per day:** a day disappears from every link once it has this many bookings. The default is 1.
- **Earliest booking:** same day, tomorrow, 2–3 days out, or 1–2 weeks out.

Changes save automatically and apply to every link immediately, including links you already sent.

### Demo mode vs. live
Out of the box (with `book/config.js` empty) both pages run in **demo mode**. Everything is stored on the one device, so you can click through the whole flow, but customers can't use the links and nothing is emailed.

To go live, the booking data needs somewhere shared to live. GitHub Pages only serves static files, so the server is a free **Google Apps Script** that runs in your own Google account and stores bookings in a Google Sheet you own. One-time setup is about 10 minutes on a computer, and the steps are also in **Scheduler → Settings**:

1. Open [sheets.new](https://sheets.new) and name the sheet **Splash Bookings**. Then **Extensions → Apps Script** and delete the sample code.
2. Paste in all of [`scheduler/backend/Code.js`](scheduler/backend/Code.js). Change `ADMIN_PASSCODE` from `'CHANGE-ME'` to your own passcode (6+ characters). Save.
3. Select **setup** in the function menu → **Run** → approve the permissions. Google shows an "unverified app" warning because it's your own private script. Choose **Advanced → Go to … (unsafe) → Allow**.
4. **Deploy → New deployment →** gear → **Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Deploy, then copy the Web app URL (ends in `/exec`).
5. In **Scheduler → Settings → Connection**, paste the URL, press **Connect**, and enter your passcode.
6. For short customer links, put the same URL in [`book/config.js`](book/config.js). Until then, links still work but carry the server ID, which makes them noticeably longer.

If you edit the script later, use **Deploy → Manage deployments → Edit → Version: New version** so the URL stays the same.

### Alerts — read this
- **Email** goes to the address in Settings, or to your Google account if that's blank. Gmail may not ring your phone for a message your own account sends to itself, so either use a different address (like a business email) or turn on push.
- **Phone push** uses the free [ntfy](https://ntfy.sh) app: tap **Generate** in Settings, save, subscribe to that topic in the ntfy app, then **Send test alert**. Topic names are effectively the password, so keep the generated one private.
- **Google Calendar:** bookings become all-day events and move or disappear when the customer changes or cancels. You can turn this off in Settings.

### Things to know
- **The link is the key.** Anyone holding a customer's link can see and change that one booking. Nobody can see anyone else's details. Links are random 10-character IDs.
- **Customers aren't notified when *you* cancel.** They don't leave an email. Cancelling from the Scheduler offers a pre-written text to send them, and they'll also see the cancellation if they reopen their link.
- **The default link address looks like `…github.io/skills-github-pages/book/?l=…`.** For a more professional link, point a subdomain such as `book.splashwashing.com` at GitHub Pages using a custom domain. It's a DNS change and nothing in the apps needs to change.
- **Google's script server isn't instant.** Expect a brief loading shimmer when the page opens and a second or two after **Confirm**.
- **Quotas:** a free Google account can send email to 100 recipients a day through Apps Script. That's far above what booking alerts need.
- **Spam guard:** a single link allows 8 changes per hour. The owner passcode locks for 15 minutes after 10 wrong tries.
- Your bookings live in the Google Sheet (**Links** and **Activity** tabs), so you can view, sort, or export them there anytime.

### Files
```
book/
  index.html       Customer booking page
  app.js           Calendar, details form, change/cancel, add-to-calendar
  style.css        Styles
  api.js           Talks to the booking server (or runs demo mode)
  config.js        Your Apps Script URL goes here
scheduler/
  index.html       Owner app (Bookings / Availability / Send link / Settings)
  app.js           Owner app logic
  style.css        Styles
  manifest.json    Standalone PWA manifest
  sw.js            Service worker (offline app shell, scoped to /scheduler/)
  icons/icon.svg   App icon
  backend/Code.js  Booking server — paste into Google Apps Script
```

---

## Content Creator — `/content/`

Open `https://<your-pages-url>/content/` on Android Chrome → menu → **Add to Home screen**. The app installs as **"Splash Content"** and works offline.

### Today tab
Tap **Generate Today's Content** → instantly produces four ready-to-paste posts:

- **Google Business Profile** — factual, location-rich, no emojis, professional CTA. Mentions the city and that you serve the broader Hampton Roads region. Posting weekly keeps your profile active in Google's local pack.
- **Facebook** — friendly hook + body + light emojis + 1-2 hashtags. Length stays in the 80-250 char engagement sweet spot for local business pages.
- **Instagram** — emoji hook in the first line + body + exactly **5 hashtags** (mixed brand / local / niche, the ratio that performs best for small local accounts).
- **Website blog** — full Markdown article with editable title, meta description, AEO-friendly question header, three H2 sections, and an FAQ block. Copy as Markdown, as HTML, or as a Title + Meta + Body bundle.

Other controls:
- **Try a Different Angle** — same topic, fresh phrasing.
- **Pick a different topic** — override today's auto-pick from a 25-topic library.
- **Custom focus** — add a specific angle ("HOA", "townhome", "mold").
- **Save to History** — keep what you posted (60-item rolling history).

### Week tab
**Build This Week** → 7 days of content with per-day, per-platform copy buttons.

### History tab
Restore, copy, or delete any past saved entry.

### Tips tab
Best post times by platform, what to add to every post, SEO + AEO quick rules.

### Daily posting recipe (~5 min)
1. Tap **Generate Today's Content**.
2. **Google** → Copy → open the GBP app → Add update → paste → attach a recent job photo.
3. **Facebook** → Copy → new post → paste → attach photo.
4. **Instagram** → Copy → new post → paste in caption → attach photo or before/after Reel.
5. **Blog** → Copy as HTML → paste into your website's blog editor → publish.

### Why the content is what it is

- **Google Business Profile**: skips emojis and leans on city + service keywords because Google ranks them like mini local-SEO landing pages.
- **Facebook**: short captions (80-200 chars) and 1-2 hashtags — both correlate with the highest engagement on local pages.
- **Instagram**: hook in the first line (before the "more" cutoff) so the post earns the tap; 5 mixed hashtags is the local small-business sweet spot.
- **Blog**: the H1 contains the primary keyword + city; an early H2 is phrased as a question with a 40-60 word answer (the format Google AI Overviews and voice search pull); a final FAQ block adds two more answer-style sections. Keywords land naturally — you won't read it and feel stuffed.

### Topic library (25 angles, rotates by day-of-year, biased to current season)

House washing for curb appeal · Soft wash vs pressure wash · Driveway / concrete cleaning · Gutter cleaning (importance, seasonal) · Gutter brightening (the black streaks) · Mold and mildew removal · Vinyl and wood fence cleaning · Pool deck cleaning · Pre-listing wash · Spring refresh · Fall prep · Veteran / firefighter owned story · Commercial pressure washing · Oil stain removal · Roof soft washing · Algae prevention · Storm cleanup · Before & after · House + driveway bundle · Eco-friendly cleaning · Rust stain removal · Brick & stucco cleaning · Property managers / rentals · Free quote walkthrough · Annual maintenance schedule.

### Files
```
content/
  index.html       UI
  app.js           Content engine (25 topics + per-platform generators)
  style.css        Styles (self-contained)
  manifest.json    Standalone PWA manifest
  sw.js            Service worker (offline cache, scoped to /content/)
  icons/icon.svg   App icon
```

---

## Lead Tracker — `/lead-tracker/`

Built for the moment a Google Local Service Ads lead comes in — the jobs go to whoever answers first, and to whoever follows up.

### Leads tab
- **Due Now** sits on top with a red badge on the nav icon: every lead whose follow-up date has arrived, oldest first. Open the app, clear the list.
- Below it, the pipeline: **New → Contacted → Quoted → Scheduled**, filterable by status.
- Tap any lead to expand it: one-tap **Text** (opens your SMS app with the right template for that stage already filled in), **Call**, **Copy Address** (paste straight into the Pricing Agent or Quote Builder), and **Ask for Review**.
- Changing a status auto-suggests the next follow-up date (contacted → +1 day, quoted → +3 days, scheduled → job date, done → next-day review request). Every date is editable.
- **Quoted leads get a "Close the Sale" section**: text the quote itself (price pulled from the Quote $ field, "good for 7 days — reply YES"), offer two concrete days with date pickers (assumptive close), three objection quick-replies ("too pricey" / "need to ask" / "maybe later"), and a $25-off final nudge.
- **Quoted and scheduled leads get "Lock It In"**: one tap texts a deposit request with your payment link, and **Add to Calendar** drops the job — customer, address, phone, quote, notes — straight into Google Calendar.

### New Lead tab
Name, phone, address, source (LSA call / LSA message / other), service chips, notes. **Save & Text Now** saves the lead, marks it contacted, and opens your texting app with the first-response template — the whole speed-to-lead move in about ten seconds.

### Templates tab
Fifteen editable messages grouped by stage — **Getting the job** (first response for call / message / after-hours, no-reply check-in), **Closing the sale** (text the quote, quote bump, offer two days, three objection replies, $25-off final nudge, deposit ask), and **After booking** (confirmation, day-before reminder, review request) — with `{name}`, `{service}`, `{company}`, `{owner}`, `{quote}`, `{payment_link}`, `{review_link}` placeholders filled automatically. A settings card holds your name, company name, Google review link (reviews raise LSA ranking and lower cost-per-lead), and payment link.

### Done tab
Completed and lost leads, with a stamp showing whether the review was requested. Restore or delete.

Everything is stored locally on the phone (localStorage, ~200-lead rolling history). No server, works offline.

---

## Quote Follow-Up — `/follow-up/`

Built for the quotes that go quiet. Only ~2% of sales close on the first contact and ~80% close on the 5th touch or later — but almost everyone stops following up after one or two tries. QuoteIQ stays the system of record; this app is the follow-up machine.

### The 6-touch sequence

Every quote gets a text sequence anchored to the day it was **sent** (not the day you add it):

| Touch | Day | Angle |
|---|---|---|
| 1 | 1 | Check-in — "any questions?" |
| 2 | 4 | Social proof — reviews, veteran/firefighter owned, before-and-afters |
| 3 | 8 | Urgency — schedule filling up |
| 4 | 14 | New angle — why washing now protects the surface |
| 5 | 21 | Breakup — "should I close your file?" (gets replies from ghosts) |
| 6 | 30 | Last word — closing out open quotes this week |

No discounts anywhere — the sequence leans on value, urgency, and social proof so your pricing holds.

### Today tab
Open the app, clear the list. Each due card shows the $ amount, an age pill (Day 6 / Day 12 / Day 23), and where it is in the sequence. Tap **Text** — your SMS app opens with the right message for that touch already filled in. When you come back, the card asks "Did the text go out?" — confirming advances the sequence and schedules the next touch. **Won** records the dollar amount; **Lost** asks why (price / timing / went elsewhere / ghosted); **Zzz** snoozes a day, three days, or a week. Timing and ghosted losses offer the Win-Back list instead of the graveyard.

Backdate the "date sent" field when adding a quote from last week — the app drops it into the right spot in the sequence instead of starting over. A quote that's 30+ days old starts straight at the breakup text, which is exactly what an old ghost needs.

### Win-Back list
Quotes that finish the sequence unanswered aren't dead — they resurface automatically after 60 days with a seasonal text (spring: wash off the winter grime; fall: sharp for the holidays), then every 90 days after that.

### Pipeline tab
Every open quote with filters (Overdue / Fresh / Aging / Stale / Win-Back / Won / Lost) and sorts (next touch, oldest, biggest $). Expand a card for the follow-up log, situational replies ("they're stalling", "wants changes", commercial), a replied flag, and editable details.

### Stats tab
The headline number is **$ won after follow-ups** — money this app chased down. Plus win rate, open pipeline $, average touches to close, reply rate, why quotes are lost, and your daily streak for clearing the due list.

### Import from QuoteIQ
Export estimates (or contacts) from QuoteIQ to CSV → Add tab → pick the file. The app auto-matches the columns and shows you a preview to fix anything before importing. Duplicates (same phone number) and already-accepted quotes are skipped automatically.

### Backup
Everything lives only on the phone (localStorage, ~400-quote cap). The Add tab has one-tap **Export Backup (JSON)** and **Restore** — export monthly.

### Files
```
follow-up/
  index.html       UI (Today / Pipeline / Add / Stats / Templates)
  app.js           Sequence engine, CSV import, stats, backup
  style.css        Styles (self-contained)
  manifest.json    Standalone PWA manifest
  sw.js            Service worker (offline cache, scoped to /follow-up/)
  icons/icon.svg   App icon
```

---

## Quote Builder — `/`

The original tool, untouched. Customer info → services → checklist → save / PDF / email. See `index.html`, `app.js`, `style.css`, `manifest.json`, `sw.js`.

---

## Install on Android

For either app: visit the URL in Chrome → menu (three dots) → **Add to Home screen** → **Install**. Each gets its own icon, its own offline cache, and its own update lifecycle.

## License

MIT.

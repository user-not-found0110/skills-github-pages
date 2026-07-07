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

Each app installs as its own Android home-screen icon with its own name. They share nothing at runtime — separate manifests, separate service workers, separate localStorage. You can install one, both, or neither.

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

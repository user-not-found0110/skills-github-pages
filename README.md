# Splash Pressure Washing — PWAs

Two separate, installable mobile-first apps for [Splash Pressure Washing](https://splashwashing.com), a veteran and firefighter owned company in Chesapeake, VA.

| App | URL path | Purpose |
|---|---|---|
| **Quote Builder** | `/` | Build, save, and PDF customer quotes from your phone. |
| **Content Creator** | `/content/` | Generate daily Google / Facebook / Instagram / blog posts. |
| **Wash Window** | `/wash-window/` | Check this week's forecast and flag the best days to schedule washes (no rain-outs). |

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

## Quote Builder — `/`

The original tool, untouched. Customer info → services → checklist → save / PDF / email. See `index.html`, `app.js`, `style.css`, `manifest.json`, `sw.js`.

---

## Install on Android

For either app: visit the URL in Chrome → menu (three dots) → **Add to Home screen** → **Install**. Each gets its own icon, its own offline cache, and its own update lifecycle.

## License

MIT.

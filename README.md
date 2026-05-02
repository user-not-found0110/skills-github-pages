# Splash Pressure Washing — PWA

Mobile-first progressive web app for [Splash Pressure Washing](https://splashwashing.com) — a veteran and firefighter owned company in Chesapeake, VA. Two tools in one installable app:

1. **Quote Builder** (`index.html`) — build, save, and PDF customer quotes from your phone.
2. **Content Creator** (`content.html`) — generate daily social posts and SEO/AEO blog drafts.

Works on Android, iOS, and desktop browsers. Once opened, you can install it to your home screen and use it offline.

---

## Content Creator — How to use

Open `content.html` (or tap **Content** in the header of the Quote Builder).

### Today tab
- Tap **Generate Today's Content** — produces four ready-to-paste posts:
  - **Google Business Profile** — factual, location-rich, no emojis, professional CTA
  - **Facebook** — friendly hook, body, light emojis, 1-2 hashtags
  - **Instagram** — emoji hook, body, exactly 5 hashtags (mixed brand/local/niche)
  - **Website Blog** — full Markdown article with title, meta description, AEO question header, three H2 sections, and an FAQ block
- Each card has its own **Copy** button. The blog card can also copy as HTML or as a Title + Meta + Body bundle.
- **Try a Different Angle** regenerates the same topic with fresh phrasing.
- **Pick a different topic** lets you override the auto-pick (25+ topics rotate through the year).
- **Custom focus** lets you mention something specific (e.g. "HOA", "townhome", "mold").
- Tap **Save to History** to keep what you posted.

### Week tab
Tap **Build This Week** for a 7-day calendar — each day pre-loaded with a topic and copyable platform posts.

### History tab
Restore, copy, or delete anything you saved. The app keeps your last 60 entries.

### Tips tab
Best posting times for each platform, what to add to every post, and SEO + AEO quick rules.

---

## Posting recipe (paste-ready)

1. Tap **Generate Today's Content**.
2. **Google Business Profile** → Copy → open the GBP app → Add update → paste → attach a recent job photo.
3. **Facebook** → Copy → open Facebook → new post → paste → attach photo.
4. **Instagram** → Copy → open Instagram → new post → paste in caption → attach photo or before/after Reel.
5. **Blog** → Copy as HTML → paste into your website's blog editor → publish.

Total time: ~5 minutes a day.

---

## Why the content is what it is

- **Google Business Profile** posts skip emojis and lean on city + service keywords because Google ranks them like mini local-SEO landing pages. Posting weekly keeps your profile active in the local pack.
- **Facebook** captions stay short — 80-200 characters get the highest engagement on local business pages — and use 1-2 hashtags, which outperforms either zero or many.
- **Instagram** captions hook in the first line (before the "more" cutoff), then deliver value, then close with a CTA. The 5 hashtags mix brand + local + niche, which is the sweet spot for small-business reach in 2025-2026.
- **Blog** posts are SEO + AEO friendly: the H1 contains the primary keyword + city; an early H2 is phrased as a question with a concise 40-60 word answer (this is the format pulled into Google's AI Overviews and voice search); a final FAQ block adds two more answer-style sections. Keywords are placed naturally — you won't read it and feel like the page was stuffed.

---

## Install on Android

1. Visit the app URL in Chrome.
2. Tap the menu (three dots) → **Add to Home screen** → **Install**.
3. The app opens like a native app, works offline, and auto-updates when you visit it online.

---

## Files

```
index.html       Quote Builder UI
app.js           Quote Builder logic
content.html     Content Creator UI
content.js       Content engine + 25+ topics + per-platform generators
content.css      Content Creator styles
style.css        Shared styles
manifest.json    PWA manifest with shortcuts to both tools
sw.js            Service worker (offline cache)
icons/icon.svg   App icon
```

## License

MIT.

# Google Ads — House Washing Campaign

Creates a complete Google Ads **Search campaign** for Splash Pressure Washing
via the Google Ads API. You run the script on your own computer with your own
credentials — no passwords are stored anywhere in this repo.

## What it creates

| Setting | Value |
|---|---|
| Campaign | "House Washing - Chesapeake VA" (Search, leads-focused) |
| Budget | **$50/day** |
| Targeting | People in Chesapeake, VA — **excluding ZIPs 23324 and 23325** |
| Bidding | Maximize Clicks with a $10 max CPC (see "After launch" for upgrading) |
| Keywords | 15 house-wash / soft-wash keywords (exact + phrase) plus 16 negatives (jobs, DIY, equipment, etc.) |
| Ad | Responsive Search Ad → https://splashwashing.com, with "Veteran & Firefighter Owned" messaging |
| Call asset | 757-752-8484 shown on ads |
| Status | **ENABLED — it goes live and starts spending as soon as the script succeeds** |

## One-time setup (~30–60 min, plus Google's approval wait)

You need three credentials. Do these in order.

### 1. Developer token (from Google Ads)

1. Sign in at [ads.google.com](https://ads.google.com). The API requires a
   **manager account (MCC)** to issue tokens — if you don't have one, create
   a free manager account at [ads.google.com/home/tools/manager-accounts](https://ads.google.com/home/tools/manager-accounts)
   and link your regular Ads account to it.
2. In the manager account: **Tools & Settings → Setup → API Center**.
3. Accept the terms and copy your **developer token**.
4. New tokens start with *test-account-only* access. Apply for **Basic
   access** in the same API Center page (short form about your use case —
   "managing my own company's campaigns" is fine). **Approval usually takes
   1–3 business days.** You can do steps 2–4 below while you wait.

### 2. Google Cloud OAuth client

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and
   create a project (any name, e.g. "splash-ads").
2. **APIs & Services → Library** → search "Google Ads API" → **Enable**.
3. **APIs & Services → OAuth consent screen** → External → fill in the
   minimum (app name, your email). Add your own Gmail as a **test user**
   (no need to publish the app).
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   → type **Desktop app**. Copy the **client ID** and **client secret**.

### 3. Refresh token

On your computer:

```bash
cd google-ads
pip install -r requirements.txt
python generate_refresh_token.py --client-id YOUR_CLIENT_ID --client-secret YOUR_CLIENT_SECRET
```

A browser opens — sign in with the Google account that owns the Ads account
and approve. Copy the printed **refresh token**.

### 4. Config file

```bash
cp google-ads.yaml.example google-ads.yaml   # gitignored, stays local
```

Fill in the developer token, client ID, client secret, and refresh token.
If you went through a manager account in step 1, also set
`login_customer_id` to the **manager** account's 10-digit ID (digits only).

Your **customer ID** is the 10-digit number at the top right of
ads.google.com when viewing your regular (non-manager) account.

## Running it

**Before the real run:** make sure billing is set up in Google Ads
(Tools & Settings → Billing) — the campaign is created live.

```bash
# 1. Dry run — Google validates everything, creates nothing, spends nothing
python create_campaign.py --customer-id 1234567890 --dry-run

# 2. The real thing
python create_campaign.py --customer-id 1234567890
```

The request is atomic: if any single piece is invalid, nothing is created.

## After launch

1. **Same day:** review the campaign at ads.google.com — check the ad
   preview, location settings, and that the ad gets approved (usually
   within 1 business day).
2. **First week:** set up **conversion tracking** — at minimum "Calls from
   ads" (free, no code) and a website conversion for your quote form.
   Tools & Settings → Measurement → Conversions.
3. **Weekly:** check the **Search terms** report (Insights → Search terms)
   and add irrelevant queries as negative keywords.
4. **After ~30 conversions** (or 4–6 weeks): switch bidding from Maximize
   Clicks to **Maximize Conversions** (campaign Settings → Bidding) so
   Google optimizes for leads instead of traffic.
5. Consider adding sitelink assets (e.g. "Free Quote", "Driveway Cleaning",
   "About Us") in the dashboard — they raise click-through rates.

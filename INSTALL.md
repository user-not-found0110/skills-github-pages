# Missed Call Auto-SMS — Installation Guide

This app automatically sends an SMS back to anyone who calls you and you don't answer.
It is a personal-use sideloaded APK (not on Play Store).

---

## What the app does
- Detects missed calls on your chosen SIM card
- Immediately sends your pre-written reply message to the caller
- Works in the background — no need to keep the app open

---

## Step 1 — Get the APK

### Option A: GitHub Actions (recommended — works from any browser)

1. Push this repo to GitHub (or it's already there)
2. Go to **Actions** tab → **Build Android APK** workflow
3. Click the latest successful run
4. Scroll down to **Artifacts** → download **MissedCallSMS-debug**
5. Unzip on your phone — you'll have `app-debug.apk`

> The workflow triggers automatically whenever you push changes to `android-app/`.
> You can also trigger it manually: Actions → Build Android APK → Run workflow.

### Option B: Build locally in Termux

1. Install **Termux** from [F-Droid](https://f-droid.org/en/packages/com.termux/)
   (the Play Store version is outdated — use F-Droid)

2. Open Termux and run:
   ```bash
   pkg update && pkg upgrade -y
   pkg install -y git
   git clone https://github.com/YOUR_USERNAME/skills-github-pages.git
   cd skills-github-pages/android-app
   bash setup-termux.sh
   ```

3. The APK will be at:
   `android-app/app/build/outputs/apk/debug/app-debug.apk`

4. Copy it to a location you can open with a file manager:
   ```bash
   cp app/build/outputs/apk/debug/app-debug.apk /sdcard/Download/MissedCallSMS.apk
   ```

---

## Step 2 — Enable "Install unknown apps"

Before installing the APK you need to allow your browser or file manager to install apps:

- **Android 8+**: Settings → Apps → (your browser or file manager) → Install unknown apps → Allow
- **Older Android**: Settings → Security → Unknown sources → Enable

---

## Step 3 — Install the APK

Open your file manager, navigate to Downloads, tap `MissedCallSMS.apk` and follow the install prompt.

---

## Step 4 — Configure the app

1. Open **Missed Call SMS** from your app drawer
2. Tap **Grant Permissions** and allow all requested permissions:
   - **Phone** (to detect calls)
   - **Call logs** (to get the caller's number reliably)
   - **Send SMS** (to send the auto-reply)
3. In the **SIM card** dropdown, choose which SIM to monitor
4. Edit the **auto-reply message** to whatever you'd like sent
5. Toggle **Enable auto-reply** ON
6. Tap **Save Settings**

The status line at the top will confirm the app is active.

---

## Permissions explained

| Permission | Why needed |
|---|---|
| Phone state | Detect when a call comes in and whether it was answered |
| Call logs | Read the caller's phone number on Android 9+ |
| Send SMS | Send the auto-reply message |
| Read phone numbers | List your SIM cards in the dropdown |

---

## Troubleshooting

**SMS not sending?**
- Make sure SEND_SMS is granted in Settings → Apps → Missed Call SMS → Permissions
- Check that the correct SIM is selected (especially on dual-SIM phones)
- On some phones, battery optimisation kills background receivers — add the app to the battery optimisation whitelist: Settings → Battery → App optimisation → Missed Call SMS → Don't optimise

**Caller number shows "Unknown"?**
- Grant the Call logs permission. Without it, the app cannot read the caller's number on Android 9+.

**Termux build fails on aapt2?**
- This is expected — x86_64 binaries won't run on ARM64. The `setup-termux.sh` script handles this automatically by patching Gradle's cache.
- If the patch step fails, use Option A (GitHub Actions build) instead.

**Want to change the message or SIM later?**
- Just open the app again, make your changes, and tap Save Settings. No reinstall needed.

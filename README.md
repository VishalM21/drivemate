# Running DriveMate for testing

One command starts everything you need to test the app:

```bash
./run-mumu.sh
```

Leave the terminal window open while you test — it stays attached showing
live logs. Press `Ctrl+C` any time to stop watching; that does **not** stop
the servers, they keep running in the background. Just run `./run-mumu.sh`
again later and it reattaches instead of restarting anything.

## What it starts

1. **Docker Desktop** (if not already open)
2. **Supabase local stack** — Postgres, Auth, Storage, and all the Edge
   Functions, running in Docker containers
3. **A Cloudflare tunnel to the backend** (port `54321`) — since the app is
   a native dev-client build, it can't just hit `localhost`, so this gives
   it a real internet URL. A watchdog keeps this alive and automatically
   rewrites `drivemate-frontend/.env` whenever the URL rotates (Cloudflare
   quick tunnels don't have a fixed address — every reconnect gets a new
   random subdomain)
4. **Metro** (port `8081`) — the bundler that serves the app's JS code,
   started with Expo's own built-in tunnel (`expo start --tunnel`, via
   ngrok) so a device that isn't this Mac (a real phone, another emulator
   on another computer) can load the JS bundle too. This is deliberately
   *not* a second raw Cloudflare tunnel — Metro embeds its own listening
   port into the URLs it hands the app, which breaks the moment a plain
   tunnel remaps that port to 443. Expo's `--tunnel` mode knows it's being
   tunneled and rewrites those URLs correctly; a bare `cloudflared` tunnel
   in front of Metro does not, and was tested/confirmed broken before this
   fix (the app would hang forever trying to download its own JS bundle).

## The two links it prints

```
==================================================================
 APP URL — paste into the dev-client's 'Enter URL manually' field
 (needed for a real phone, or any emulator on another machine):
 https://<random-name>.exp.direct

 BACKEND URL — for reference / manual API testing only.
 Already auto-synced into .env, nothing to paste for local testing:
 https://<random-name>.trycloudflare.com
==================================================================
```

**APP URL** is the one you actually paste somewhere. It points at Metro —
the thing that serves the app's code. This is what goes in the dev-client's
manual URL entry screen.

**BACKEND URL** points at Supabase (the API). You never need to type this
into the app — it gets baked into the JS bundle automatically every time
`.env` updates and Metro rebuilds. It's only printed so you can sanity-check
the backend yourself, e.g.:

```bash
curl https://<backend-url>/functions/v1/health
```

Mixing these up is exactly what caused earlier confusion — pasting the
**backend** link into the app's URL field looks plausible but doesn't work,
because that field expects the **Metro/APP URL**, a completely different
tunnel to a completely different port.

## How to test in MuMu Player

1. Make sure the DriveMate dev-client APK is already installed in MuMu
   Player (one-time thing — rebuilding/reinstalling it isn't part of this
   script).
2. Run `./run-mumu.sh` and wait for the two links to print.
3. Open the app in MuMu Player. You'll land on the Expo dev-launcher screen
   (a plain screen with a Metro/QR code option and "Enter URL manually").
4. Tap **Enter URL manually**, paste the **APP URL**, and confirm.
5. The app should now load and start talking to the backend automatically
   (the backend URL is already baked in via `.env`).

This same APP URL also works if you install the APK on:
- a different emulator (AVD, BlueStacks, LDPlayer — anything running on
  *this* Mac or elsewhere)
- a real Android phone, over Wi-Fi or mobile data, anywhere with internet

For a phone or a remote machine, the Mac needs to stay **awake** (not just
powered on) the whole time, since it's the one actually running Supabase
and Metro. Run `caffeinate -di` in another terminal tab if you're testing
for a while and don't want the Mac to sleep.

## If a link doesn't work

- The script only prints a link after confirming it's actually live
  (health-checked), so a freshly printed link should always work. If it
  still fails, the tunnel may have rotated seconds later — re-run
  `./run-mumu.sh`, it'll verify and print the current one.
- On a flaky network (mobile hotspots especially), a freshly minted
  tunnel subdomain (either `trycloudflare.com` or `exp.direct`) can take a
  few extra seconds to resolve over DNS. The script retries for up to a
  minute before giving up.
- The APP URL is verified by hitting `/status`, not by actually fetching
  the JS bundle — if you ever suspect it's stale, you can double check
  yourself: `curl -H "Expo-Platform: android" <app-url>/` should return a
  JSON manifest whose `launchAsset.url` uses the *same* `<app-url>` host
  with no port number appended.
- Low free RAM (check the WARNING the script prints) can make Supabase
  functions time out or the tunnel drop and reconnect repeatedly. Closing
  a MuMu Player instance, Chrome, or other heavy apps frees it up.

## Shutting everything down

```bash
pkill -f "scripts/tunnel-watch.sh"
pkill -f "cloudflared tunnel"
pkill -f "expo start --dev-client"
pkill -f ngrok
cd drivemate-backend && supabase stop
```

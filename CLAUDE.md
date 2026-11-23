# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

LootRadar tracks 100%-off paid games across Epic, Steam, GOG, Amazon (Prime/Luna), and itch.io. It is a React 19 + Vite + Tailwind 4 PWA with an Express server, Firebase Auth/Firestore for accounts, and thin Android/iOS WebView wrappers. It was generated in Google AI Studio, which injects `GEMINI_API_KEY` and `APP_URL` at runtime. `@google/genai` is a dependency but is not currently imported anywhere.

## Commands

```sh
npm install
npm run dev     # Express + Vite middleware on http://localhost:3000 (PORT overrides)
npm run lint    # Type-check only (tsc --noEmit); there is no ESLint
npm run build   # Vite production build + PWA service worker into dist/
npm start       # Serves the production build from dist/ (run build first)
npm run publish-feed   # Writes live data to dist/giveaways.json (run after build)
```

- There is no test framework or test files. Verify changes with `npm run lint`, `npm run build`, and by exercising the app.
- HMR is disabled, so refresh the browser after frontend changes. Restart the server after changing `server.ts`.

## Architecture

### Giveaway feed has two parallel implementations

The production website is static on GitHub Pages (`https://phend0.github.io/lootradar/`), so `/api` does not exist there. `.github/workflows/deploy-pages.yml` runs hourly and publishes `giveaways.json` beside the site. The website and native apps all read that file.

The feed is built in **both** `server/feed.ts` and `src/utils/liveFeedClient.ts`. The normalization logic for Epic and GamerPower is largely duplicated, so a change to mapping, status, or dedupe logic usually must be made in both.

`App.tsx` `syncLiveGiveaways` resolves data in this order:

1. `GET /api/giveaways` (`?refresh=true` bypasses the server's 3-minute in-memory cache).
2. `fetchClientSideLiveGiveaways()`, used on static hosts and in native wrappers. It reads the published `giveaways.json` if under 24 hours old. Otherwise it fetches stores directly, trying the Android bridge, direct fetch, then the third-party `api.allorigins.win` CORS proxy.
3. `INITIAL_GIVEAWAYS` from `src/data/giveaways.ts`, which is also the initial render state.

Differences between the two paths:

- Only the server queries Amazon Luna live (CSRF token + GraphQL). The client uses the static catalog for Prime.
- Only the server resolves GamerPower redirects to direct store URLs.
- GOG entries always come from the static catalog on both paths.
- Both paths fall back to the static catalog when fewer than 4 live games remain.
- GamerPower allows browser CORS but Epic does not, so Epic on static hosts and iOS depends on the intermittently failing proxy.

The app refetches every 15 minutes and on foreground/focus/reconnect (at most once per 5 minutes). `withCurrentStatus` recomputes status and removes ended games each minute, so never trust a stored `status`. The static catalog has fixed dates and goes stale unless updated by hand.

### Eligibility is a product rule

`src/utils/gameEligibility.ts` defines what may appear: paid full games, major story expansions, and official Steam playtests/betas. Cosmetics, currency, soundtracks, and generic DLC are rejected, and `originalPrice` must be greater than 0. Every feed source must pass through these filters. The blocklist regex matches titles and subtitles, so new terms can hide legitimate games.

### State and cloud sync

`src/App.tsx` is a large single component that owns nearly all state (feed, filters, claims, prefs, alerts, auth) and renders the tab views. `src/components/` holds the larger views and modals.

- Guests persist claims, prefs, and alerts to `localStorage`.
- On sign-in, `ensureUserProfileAndSyncGuestClaims` batch-writes the profile and up to 50 guest claims to Firestore. `onSnapshot` listeners then merge cloud state back into local state.
- All Firestore access goes through helpers in `src/firebase.ts`, which sanitize IDs (`sanitizeDocId`) and clamp values to fit the rules.

### Firestore schema changes touch several files

`firestore.rules` is default-deny and enforces exact key allowlists, size bounds, and server timestamps. Adding or changing a field on `users/{uid}` or `users/{uid}/claims/{gameId}` requires updating, together:

- `firestore.rules`
- the write helpers and types in `src/firebase.ts`
- `firebase-blueprint.json`
- `security_spec.md` when an invariant changes

The store list (`epic`, `steam`, `gog`, `prime`, `itch`) is likewise hardcoded in `src/types.ts`, `src/firebase.ts`, and `firestore.rules`. There is no `firebase.json`, so rules are not deployed from this repo's tooling.

### Native wrappers and download artifacts

- `android/` and `ios/` are WebView shells that load the built web bundle from local files. Keep asset paths relative (`base: './'` in `vite.config.ts`).
- `/api` is unavailable in the bundled apps, so they rely on the client-side feed path.
- The web code checks for a `window.LootRadarAndroid.fetchUrl` bridge, but `MainActivity.java` does not register it. Android uses direct fetch instead, which its WebView file-access settings permit. A synchronous bridge would block the UI thread during network calls.
- `android/` has no Gradle project, so the APK cannot be built from this repo as-is.
- iOS uses XcodeGen (`ios/project.yml`) and builds through the manually triggered `.github/workflows/build-ios-ipa.yml`.
- `public/LootRadar-iOS.mobileconfig` is an unsigned web clip pointing at the Pages site, so iOS labels it "Unverified".
- `public/LootRadar.apk`, `LootRadar-iOS.ipa`, and `LootRadar-iOS.mobileconfig` are prebuilt binaries served by dedicated `server.ts` routes. Web changes do not update them.

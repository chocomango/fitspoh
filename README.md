# Fitspoh

A personal workout and body-progress journal built with React, TypeScript, Vite, and IndexedDB. Designed for phones, usable on desktop, and deployable as a static GitHub Pages app.

## Mobile interface and themes

The phone navigation has five tabs: Home, Plans, Train, Body, and More. Exercise browsing, history, and gym equipment are under More; exercise selection is also available directly within a workout. The active workout header and rest timer remain within reach, set inputs fit narrow screens, and forms open as bottom sheets. Exercise filters expand from the filter button next to search.

Toggle **Sumikko Gurashi theme** in the top bar, or choose an appearance under More. The soft theme includes cream backgrounds, pastel cards, and original SVG character illustrations. Theme selection is saved locally, included in backups, and defaults to the original dark Focus theme for existing records.

## Run locally

Requires Node.js 22 or later.

```sh
npm ci
npm run dev
```

For the production preview, run `npm run build` then `npm run preview` and open http://127.0.0.1:4173/fitspoh/ . This preview deliberately uses a repository subpath to verify GitHub Pages compatibility.

## Your first workout

1. Open **My gym** (under **More** on a phone). Confirm the equipment you have seen at Anytime Fitness Bedok South CC. Publicly listed categories are not treated as a verified machine inventory.
2. Open **My plans**, create a plan, add workout days, then choose exercises and target sets, loads, rep ranges, and rest periods. Optional A/B/C groups form supersets or circuits; the rest timer starts once the round is complete.
3. Start a workout day. Planned loads take priority; blank/zero loads reuse the previous session's load when available. Tap previous performance to copy a set, or copy the whole previous exercise. Prefilled sets are not counted until marked complete.
4. Use the exercise title to open photos, steps, movement schematics, personal technique notes, machine setup notes, and performance history.
5. Finish to save the session and advance the plan's next day. Session edits do not alter the plan unless you choose **Update saved workout day**.
6. Open **Body progress** for weigh-ins, optional body-fat percentage, and waist/chest/hips/arm/thigh measurements. Fields are independent; at least one measurement is required per entry.

Weights are logged per hand for dumbbells, as total load for barbells, and as assistance on assisted machines. Volume is recorded load × completed reps, excluding warmup sets and assisted exercises; it does not double per-hand dumbbell loads. Muscle summaries count primary-muscle working sets, not estimated recovery.

## Persistence, backups, and offline use

- All records stay in the current browser profile's IndexedDB database. No account, analytics, server database, or automatic device synchronization.
- Unfinished sessions save automatically and resume after reopening. Save errors are displayed. An unreadable database is not overwritten with an empty journal.
- **Export full backup** downloads a versioned JSON file including plans, workouts, body entries, equipment, custom exercises, notes, and preferences. Keep copies outside browser storage. Clearing site data or using a different browser/device does not preserve these records.
- Import previews and validates a backup before confirmation to replace current data. Export existing records first if you need them. CSV exports provide human-readable workout and body-stat tables; CSV is not a restorable backup format.
- A service worker caches the app shell for offline reopening. All guide text and movement schematics are bundled; viewed photos are cached. **Download plan guides** caches photos for exercises in saved plans.
- Offline availability requires one successful online load on HTTPS or localhost. Browser vibration and storage-persistence support vary. Background timers derive remaining time from an end timestamp; notifications appear when the app is active again.
- Installing the app is browser-dependent. The manifest supports standalone display; the app does not require installation.

## GitHub Pages

The included workflow builds and deploys pushes to `main` or `master` and supports manual runs.

1. Push the repository to GitHub.
2. In **Settings → Pages**, select **GitHub Actions** as the build/deployment source.
3. Run the workflow or push to `main` or `master`.

Relative asset paths and hash routing support the `/fitspoh/` repository URL. Deployment requires repository access and GitHub Pages enabled. The website is public, but personal records remain on the user's device and are never committed to GitHub.

## Validation

```sh
npm test
npm run build
npm run test:browser
```

Browser tests use installed Chrome on Windows. Set `FITSPOH_BROWSER` to another executable path, or on other platforms run `npx playwright install chromium` before testing. Tests verify plan creation, unfinished workout recovery, completion, body stats, unit conversions, backup round trips, offline reopening, phone layouts, equipment matching, playable schematics, and invalid imports.

## Exercise content

The checked-in catalogue contains 599 exercise entries and 1,198 position photos from [Free Exercise DB](https://github.com/yuhonas/free-exercise-db), released under the [Unlicense](https://github.com/yuhonas/free-exercise-db/blob/main/LICENSE.md). Source records are in `public/exercise-sources.json`. Forty exercises have original animated schematics using eight movement-pattern illustrations; these are simplified diagrams, not exercise-specific video demonstrations. Follow each exercise's specific instructions and photos for setup. Supplemental technique cues are general rather than individualized coaching.

The library excludes source entries without equipment metadata, instructions, or images, and selected specialist categories. Gym-equipment mappings add bench/rack/attachment requirements and distinguish specific machines. Unlisted equipment stays unconfirmed until edited by the user.

To regenerate the catalogue after updating `exercise-source.json`, run `node scripts/prepare-library.mjs`. To download missing photos, run `node scripts/download-media.mjs` (network required). Source media occupies approximately 73 MB; it is lazy-loaded and not all cached at startup.

Cloud sync, licensed demonstration videos, progress photos, progression suggestions, warmup/plate calculators, health integrations, and social features are not part of this version.

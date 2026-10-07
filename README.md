# Fitspoh

A personal workout and body-progress journal built with React, TypeScript, Vite, and IndexedDB. Designed for phones, usable on desktop, and deployable as a static GitHub Pages app.

## Mobile interface and themes

The phone navigation has five tabs: Home, Plans, Train, Body, and More. Exercise browsing, history, and gym equipment are under More; exercise selection is also available directly within a workout. The active workout header and rest timer remain within reach, set inputs fit narrow screens, and forms open as bottom sheets. Exercise filters expand from the filter button next to search.

Toggle **Sumikko Gurashi theme** in the top bar, or choose an appearance under More. The soft theme includes cream backgrounds, pastel cards, and original SVG character illustrations. Theme selection is saved locally, included in backups, and defaults to the original dark Focus theme for existing records.

## Easier mobile workouts

Home puts the next planned workout or unfinished session first. Choose an **Active plan** on Home, or **Use this plan** in Plans; Buddy saves do not switch it. **Start an empty workout** remains a separate secondary action. Older backups use the first nonempty plan, with the same fallback if the selected plan is removed or emptied.

During guided strength sets, large weight and rep buttons supplement direct typing. **Workout settings** lets you set an increment for each exercise (defaults: 2.5 kg, 5 lb, or 1 stack setting). Saved physical increments convert across units; stack settings remain unitless. Unknown loads require explicit entry before the buttons work.

**Equipment busy** offers **Do this later** or Buddy alternatives. Postponing moves the exercise or whole circuit to the end of this session, retaining completed sets and unfinished entry. If no other exercises remain, use alternatives or Overview. Session changes do not automatically update saved plans.

The optional **Keep screen awake** setting defaults off. Supported browsers keep the screen awake while the guided workout is visible, release it when leaving, and request it again on return. Browser refusal or battery restrictions do not interrupt logging. New preferences and postponed inputs are included in backups; older version-1 backups remain compatible.

## Run locally

Requires Node.js 22 or later.

```sh
npm ci
npm run dev
```

For the production preview, run `npm run build` then `npm run preview` and open http://127.0.0.1:4173/fitspoh/ . This preview deliberately uses a repository subpath to verify GitHub Pages compatibility.

## Your first workout

On a fresh journal, Home offers **Make a routine with Buddy**, manual plan creation, and gym-equipment setup. Configure only equipment you have confirmed, review Buddy's draft, save it, then start the workout from Home. Empty sessions provide **Add first exercise** and **Cancel empty workout** without creating history.

Guided sessions default to completing all sets of one exercise before moving on. **Workout settings > Exercise order** optionally enables circuit rounds. **Back to a previous exercise / correct a set** stays available throughout the session and review: open a saved set, correct it, and choose **Save correction** or **Cancel correction**. Completed sets remain counted, and you return to your previous entry or rest countdown.

Guided sessions show completed-set progress, reject incomplete actual results, provide a persistent **Undo completed set** action, and compare working reps at the same load with the last completed session. Overview remains available for later corrections.

During guided set entry, **Add another set** appends an unfinished set to the current exercise without leaving the entry screen. You can add set 4 while entering set 3, then complete, rest, and continue on that exercise. Extra sets save with this session and do not change the saved plan.

The guided phone screen puts the load/reps and a large completion button first, with technique, history and settings collapsed below. Tap a set chip to jump to an unfinished set or correct a saved one. **Workout exercises** lets you continue elsewhere or add a set to an exercise you already finished; your unfinished entries are kept, and the selected exercise stays together. **Skip this set** affects only one set and can be undone after reopening.

**Pause workout** freezes the remaining rest time until **Resume workout**, including after reopening. **Workout actions** offers warm-up sets with an explicit load, set types, session rest duration, exercise notes, adding an exercise, and finishing early. **Last time > Use last session values** copies prior results only when requested. An extra set after finishing an exercise starts its configured rest. None of these session adjustments automatically changes the saved plan.

Journal saves use atomic transactions and revision checks. A second tab cannot silently overwrite newer records; the recovery banner offers a local export and reload. Failed writes can be retried, and backup restore reports success only after committing. Keep regular downloaded backups.

Quality checks: `npm test`, `npm run test:browser`, `npm run typecheck`, `npm run lint`, and `npm run build`. See [PRODUCT_REVIEW.md](PRODUCT_REVIEW.md) for review findings and practical limitations.

Under **Plans**, tap **Add my prebuilt plan** for the personal Upper / Lower / Rest / Push / Pull / Legs / Rest sequence. It includes the supplied starting weights and progression/recovery notes without creating historical workout records. Adding it again opens the same editable plan. Rest days advance only when acknowledged; **Take extra rest** leaves the next workout unchanged. Optional exercises start skipped and can be included through **Overview → Guide this exercise**. Unknown loads remain zero with an explicit note to choose a load; placeholder set targets are labeled in the notes.

Trap-bar loads are stored per side, lateral-machine settings stay unitless even when switching to pounds, and linear-leg-press loads are plates only (the 53 kg sled is in the notes). These conventions appear in the log, guides, records, and CSV; they are excluded from aggregate total-load volume. Historical bests and the next hip-thrust target remain notes, with no automatic weight increases.

1. Open **My gym** (under **More** on a phone). Confirm the equipment you have seen at Anytime Fitness Bedok South CC. Publicly listed categories are not treated as a verified machine inventory.
2. Open **My plans**, create a plan, add workout days, then choose exercises and target sets, loads, rep ranges, and rest periods. Optional A/B/C groups form supersets or circuits; the rest timer starts once the round is complete.
3. Start a workout day to open the phone companion: exercise introduction, one set at a time, rest, then the next exercise. The first set uses the corresponding completed set from the last session when available; otherwise it uses the plan. Later sets keep the weight just used with their planned rep targets. “Last time” stays visible for comparison. Prefilled sets are not counted until completed.
4. Complete a set to save its results and start rest when another set remains. Adjust or skip the countdown; when it ends, tap **Start next set**. Between exercises, review results and tap **Next exercise**, or start an optional rest. Expand **Technique & notes** for photos, steps, and your notes. **Overview** provides the full log for corrections, adding sets, replacement, and skipping; **Guide this exercise** returns to a chosen exercise. Editing a plan day opens a dedicated editor with a **Back to plan** button.
5. Finish to save the session and advance the plan's next day. Session edits do not alter the plan unless you choose **Update saved workout day**.
6. Open **Body progress** for weigh-ins, optional body-fat percentage, and waist/chest/hips/arm/thigh measurements. Fields are independent; at least one measurement is required per entry.

Weights are logged per hand for dumbbells, as total load for barbells, and as assistance on assisted machines. Volume is recorded load × completed reps, excluding warmup sets and assisted exercises; it does not double per-hand dumbbell loads. Muscle summaries count primary-muscle working sets, not estimated recovery.

## Workout Buddy

Open **More → Workout Buddy**, or use **Draft with Buddy** on a plan day and **Find alternatives** on an exercise. The chat-style choices provide offline, rules-based suggestions: compatible alternatives, shorter drafts of saved days, and new routines or 2–5-day plans. Curated movement families, confirmed session equipment, experience, favourites, and completed history determine the suggestions. Review overhead/grip exclusions and exercise exclusions for each session; the Buddy does not infer recovery from previous notes.

Drafts stay separate until explicitly saved or started. Adapting preserves main targets and trims optional exercises first; unresolved duration conflicts are shown. Durations are estimates (45 seconds per strength set, entered durations for timed work, configured rests, and 90 seconds per exercise for setup/transitions). New strength loads are blank; **Use last load** explicitly copies completed loads with their original per-hand, per-side, plates, or stack convention. An unchosen load cannot be logged as a completed set; enter a load or explicitly enter zero for no added load.

Review and edit exercise order, replacements, sets, reps, loads, rest, and notes before saving. Existing-day updates and exercise replacements require confirmation; changed sources and replacements that would remove completed sets are blocked. Buddy preferences, exclusions, and the latest draft are saved locally and included in full backups. Old backups remain compatible. There is no AI service, backend, API key, or external transmission of workout context.

## Persistence, backups, and offline use

- All records stay in the current browser profile's IndexedDB database. No account, analytics, server database, or automatic device synchronization.
- Unfinished sessions, set entries, guided progress, and rest deadlines save automatically and resume after reopening. Rest alerts occur while the app is open or when it resumes; optional sound and system notifications can be enabled in Workout settings. Alerts may be delayed when the browser suspends the app and cannot reliably ring with the browser closed. Use the phone timer for reliable locked-screen alerts. Save errors are displayed. An unreadable database is not overwritten with an empty journal.
- **Export full backup** downloads a versioned JSON file including plans, workouts, body entries, equipment, custom exercises, notes, and preferences. Keep copies outside browser storage. Clearing site data or using a different browser/device does not preserve these records.
- Import previews and validates a backup before confirmation to replace current data. Export existing records first if you need them. CSV exports provide human-readable workout and body-stat tables; CSV is not a restorable backup format.
- A service worker caches the app shell for offline reopening. All guide text is bundled; viewed photos are cached. **Download plan guides** caches photos for exercises in saved plans.
- Offline availability requires one successful online load on HTTPS or localhost. Browser vibration and storage-persistence support vary. Background timers derive remaining time from an end timestamp; alerts can be delayed until the app is active again. Notification sound is controlled by phone/browser settings. Sound must be enabled again after reopening.
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

Browser tests use installed Chrome on Windows. Set `FITSPOH_BROWSER` to another executable path, or on other platforms run `npx playwright install chromium` before testing. Tests verify plan creation, unfinished workout recovery, completion, body stats, unit conversions, backup round trips, offline reopening, phone layouts, equipment matching, photo guides, and invalid imports.

## Exercise content

The checked-in catalogue contains 599 exercise entries and 1,198 position photos from [Free Exercise DB](https://github.com/yuhonas/free-exercise-db), released under the [Unlicense](https://github.com/yuhonas/free-exercise-db/blob/main/LICENSE.md). Source records are in `public/exercise-sources.json`. Follow each exercise's specific instructions and photos for setup. Supplemental technique cues are general rather than individualized coaching.

The library excludes source entries without equipment metadata, instructions, or images, and selected specialist categories. Gym-equipment mappings add bench/rack/attachment requirements and distinguish specific machines. Unlisted equipment stays unconfirmed until edited by the user.

To regenerate the catalogue after updating `exercise-source.json`, run `node scripts/prepare-library.mjs`. To download missing photos, run `node scripts/download-media.mjs` (network required). Source media occupies approximately 73 MB; it is lazy-loaded and not all cached at startup.

Cloud sync, licensed demonstration videos, progress photos, progression suggestions, warmup/plate calculators, health integrations, and social features are not part of this version.

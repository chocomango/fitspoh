# Product review

## Improvements

- Home prioritizes the active plan or unfinished workout. First-run setup leads directly to equipment selection, Buddy, or manual plan creation; empty sessions have clear add/cancel actions.
- Guided workouts now put entry controls and a fixed phone completion action first. Set chips support reversible corrections without reducing the completed count; drafts survive exercise navigation. Pause freezes rest through reload, single-set skipping and completion have persistent undo, and warm-ups, extra sets, notes, rest changes and early finish stay within the session.
- Guided workouts support adjustable loads/reps, configurable increments, progress, actual-result validation, undo, rest recovery, same-load comparisons, and equipment-busy postponement of whole groups. Plans remain separate from session edits.
- Optional screen-awake mode handles browser refusal without interrupting workouts. Both themes retain photos and written guides on narrow screens.
- Journal writes and reviewed backup restores are atomic. Revision checks prevent stale tabs overwriting newer records; conflicts and failed saves provide recovery actions. “Saved” appears only after persistence succeeds.
- Dialogs have accessible names and keyboard focus handling; charts expose recorded values; unavailable photos fall back to written guides. Native fonts work offline without third-party font requests.
- Guide downloads show progress, avoid duplicate cached downloads, and report partial failures. CSV text is protected against spreadsheet formula execution.

## Verification and known limitations

- Unit, browser, compiler, formatting, and production-build checks cover onboarding through completion/body tracking/backup/offline recovery, both themes at 320–430px, active plans, increments, grouped postponement, wake-lock lifecycle, invalid imports, and storage failures.
- WebKit successfully reloads the cached app and serves cached fetches with the origin server stopped. Its Windows automation `setOffline(true)` reports an internal navigation error; this test-harness limitation remains distinct from the passing server-offline check. Physical iOS/Android keyboard and battery-policy testing remains recommended.
- Browser storage is local to an origin/browser/device and may be cleared or evicted. JSON backups remain the portable recovery mechanism; GitHub Pages does not store personal workout records.
- Wake locks depend on browser support and system policy. Uncached exercise photos require an online download; written guides remain available offline.
- The exercise catalogue remains a relatively large static chunk. Its compressed size is acceptable for this MVP; the build reports a size advisory.

## Deliberate omissions

- No cloud accounts, paid AI, automatic load progression, calendar-enforced training, social features, or wearable integrations. These add complexity or assumptions without improving the focused offline workout flow.
- No inferred injury/recovery advice from old notes. Buddy restrictions remain explicit user choices.
- No broad architecture rewrite: existing record formats and version-1 backups are retained.

## Future v2

- Optional user-controlled cross-device sync with conflict review and clear privacy controls.
- Physical-device usability testing, followed by targeted keyboard and installability improvements.
- Selective catalogue/photo downloads if real usage shows storage or first-load pressure.
- Longer-term exercise trends based on completed sessions, while preserving load conventions and avoiding automatic training prescriptions.

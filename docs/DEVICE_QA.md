# Device QA and Build Gates

## Required devices

- Current iPhone on the minimum supported iOS version and one current iOS version.
- One small-screen iPhone at 100% and accessibility text sizes.
- Android 13+ device for notification permission behavior.
- Android 12+ device for exact-alarm behavior.
- At least one lower-memory Android device.

## End-to-end workflow

- Fresh install reaches invitation intake without fixture data.
- Missing API configuration produces an honest, recoverable error.
- Valid invitation creates a reviewable plan; missing origin blocks confirmation.
- Confirmation snapshot digest and revision survive process termination.
- Calendar is never written before confirmation.
- Route starts only after the Calendar receipt.
- Reminders start only after the route receipt and use its departure time.
- Orange stop prevents new steps and preserves completed receipts.
- Force-quit during a running write does not automatically repeat the write after launch.
- Denied/revoked Calendar and notification permissions are represented as errors, never success.
- iOS Shortcuts lists Create Task, Pending Decision, Continue Task, and Stop Task; each opens the expected review context after a cold start.
- The iOS Stop Task intent never stops work in the background; it opens the in-app confirmation path.
- Android launcher shortcuts open new/latest task through `taskspace://` links.
- Sharing plain text from Mail, Messages, and a browser into the Android app imports the text once and never auto-confirms it.
- Reopening the Android app after the shared text is consumed does not import the same payload again.

## Build and release gates

- `npm run test:api`
- `npm run mobile:test`
- `npm run mobile:typecheck`
- `npm run release:check:static`
- `npm run release:check -- --profile=preview` with preview environment loaded
- Physical-device development build validation
- Xcode/EAS compile of the app-target Swift App Intents metadata (Windows cannot perform this gate)
- Android Gradle compile with an installed SDK or EAS Build
- iOS internal TestFlight build and Android internal-testing AAB install
- Crash-free launch, cold-start timing, and workflow duration recorded
- Privacy policy, support page, deletion path, screenshots, review notes, and Data safety/App Privacy answers complete

Record device model, OS version, build number, workflow result, permission state, and evidence link for every run. A simulator-only result is not sufficient.

## Crash and performance monitoring

- Install a release/preview build with a real Sentry DSN and confirm app launch creates a session without attaching a user ID.
- Trigger a controlled non-production operational error and confirm it is symbolicated after the EAS source-map upload.
- Inspect the received event: source text, address, draft, email, account ID, request body, screenshots, and view hierarchy must be absent.
- Confirm sampled `task.plan` and `task.execute_step` transactions appear with only static operation names.
- Launch without a DSN and confirm the app remains functional and no monitoring network request is attempted.

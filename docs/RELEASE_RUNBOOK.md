# Internal release runbook

This runbook turns the checked-in release foundation into real TestFlight and Android internal-test binaries. It intentionally does not store credentials in Git.

## Current gate status

As of 2026-09-19, local tests, static release checks, Expo Doctor, and the Android production JavaScript/Hermes export pass. Real cloud deployment and signed builds are not yet available because EAS and Vercel require login and no release environment variables are configured on this machine.

## Configuration classes

### Public mobile build values

These values are embedded in the app bundle and must never grant privileged access:

- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_SENTRY_DSN`
- `EXPO_PUBLIC_ALLOW_GUEST=false`

### Server-only secrets

Configure these only in the Vercel project:

- `GEMINI_API_KEY`
- `GOOGLE_MAPS_API_KEY`
- `SUPABASE_SECRET_KEY`
- `MOBILE_API_TOKEN` for local development only; do not use it as the external-testing identity model

The API also needs `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `GEMINI_MODEL`, and an exact `ALLOWED_ORIGIN` list.

### Build and submission secrets

- GitHub Actions secret: `EXPO_TOKEN`
- EAS secret: `SENTRY_AUTH_TOKEN`
- EAS build values: `SENTRY_ORG`, `SENTRY_PROJECT`
- Apple signing: Apple Developer team, distribution certificate, provisioning profile, and App Store Connect credentials managed by EAS
- Google Play signing: Android keystore managed by EAS; a Play service-account key is needed only for automated submission

Never prefix a secret with `EXPO_PUBLIC_`.

## 1. Provision Supabase

1. Create a Supabase project in the intended test region.
2. Apply `supabase/migrations/202609190001_taskspace_core.sql`.
3. Record the project URL, publishable key, and secret key.
4. Configure email OTP and an allowed redirect for `taskspace://auth/callback`.
5. Create two test users and verify Row Level Security: neither account can read, update, or delete the other account's tasks.

## 2. Deploy the API

1. Run `npx vercel login`, link this repository to a Vercel project, and configure the server variables above for Preview and Production.
2. Set `ALLOWED_ORIGIN` to the exact web clients that should call the API. Mobile bearer requests do not rely on browser CORS for authorization.
3. Deploy, then set `EXPO_PUBLIC_API_BASE_URL` to the resulting HTTPS origin.
4. Run `npm run test:api` locally and exercise `/api/plan`, `/api/route`, `/api/tasks`, and `/api/account` with a real short-lived Supabase access token.

## 3. Configure Sentry

1. Create a React Native project in Sentry.
2. Put its public DSN in every EAS environment as `EXPO_PUBLIC_SENTRY_DSN`.
3. Add `SENTRY_ORG`, `SENTRY_PROJECT`, and secret `SENTRY_AUTH_TOKEN` for source-map uploads.
4. Send a test exception that contains synthetic task text and verify the event has no user identity, request body, task text, screenshots, view hierarchy, or replay.

## 4. Bootstrap EAS and signing

Run these steps interactively once before using CI:

```bash
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build --platform ios --profile preview
npx eas-cli@latest build --platform android --profile preview
```

The first builds create or select the EAS project, iOS distribution/provisioning credentials, and Android keystore. Commit only the generated EAS project ID in app config; never commit signing material or tokens.

Configure development, preview, and production environments in EAS with the appropriate public mobile values. Add an Expo access token as the repository secret `EXPO_TOKEN`. After both platforms have completed one interactive build, the manual **EAS Internal Build** GitHub workflow can trigger later preview builds non-interactively.

## 5. Device acceptance

Follow `docs/DEVICE_QA.md` on at least one current iPhone and one supported Android device. Do not promote a build unless these gates pass:

- authentication and cold-start session restore;
- Calendar → commute → Reminders order;
- explicit confirmation before writes;
- orange stop control and conservative resume after termination;
- denied/revoked permissions and partial failures;
- app-intent/deep-link/share intake;
- task deletion and hard account deletion;
- no cross-account restore or deleted-task resurrection;
- privacy-safe Sentry event inspection.

## 6. Publish internal builds

1. Set `PRIVACY_POLICY_URL` to `https://angel19190828-commits.github.io/ai-native-ios/privacy.html`.
2. Set `SUPPORT_URL` to `https://angel19190828-commits.github.io/ai-native-ios/support.html`.
3. Run `npm run release:check -- --profile=production` with the complete release environment.
4. Build production-signed binaries with EAS.
5. Upload iOS to TestFlight and Android to a closed/internal Play track. Keep reviewer/tester access restricted until the device matrix passes.
6. Add store screenshots, a real support contact, reviewer instructions, and any region-specific disclosures before public submission.

## Useful checks

```bash
npm ci
npm ci --prefix apps/mobile
npm run test:api
npm run mobile:test
npm run mobile:typecheck
npm run release:check:static
npx --prefix apps/mobile expo-doctor
```

The GitHub **Mobile CI** workflow repeats these checks and generates a non-installable Android JavaScript export artifact. A passing export is not equivalent to a signed APK, AAB, or IPA.

# Privacy and Data Map

Status: MVP working baseline  
Updated: 2026-09-19

## Data classes

| Data | Purpose | Current location | Release rule |
|---|---|---|---|
| Account ID and access/refresh tokens | Supabase email-OTP authentication and API authorization | Refresh session in platform SecureStore; short-lived access token in memory | Never log or include in model prompts; clear on sign-out |
| Task request and extracted facts | Plan and execute the user-requested workflow | XChaCha20-Poly1305 encrypted account-namespaced device cache; per-account key in platform SecureStore; Supabase tables protected by RLS when deployed | Verify encrypted migration and deletion on physical devices; document backend storage encryption |
| Composer drafts | Resume unfinished edits | Device task cache, scoped by task ID | Delete with task or account |
| Confirmation snapshot | Prove exactly what the user approved | RLS-scoped task snapshot and append-only task event history | Immutable; retain with execution audit record |
| Capability input | Execute a confirmed step | Minimum necessary executor payload | Never grant the model direct credentials or native API access |
| Execution receipt and external ID | Recovery, support, and user-visible proof | Task event history | Retain without provider secrets; user can delete task history |
| Model prompt/response | Extraction and planning | Backend transient processing and redacted diagnostics | Minimize context; configurable retention; never train without explicit opt-in |
| Crash/performance telemetry | Reliability | Monitoring provider when configured | Remove content, addresses, tokens, and free-form text before transmission |

## Permission principles

- Request permissions at the moment a confirmed capability needs them.
- Prefer write-only Calendar access on iOS for event creation.
- Explain the user-visible outcome before the OS prompt.
- A denial becomes a typed receipt/error state; it must not be reported as success.
- Revoking permission must not erase task history or confirmation evidence.

## Screen-interaction fallback (future, not enabled)

UI automation is a distinct, higher-trust execution mode—not an implicit permission granted by enabling a capability. If introduced, screen pixels, accessibility trees, OCR text, and observed app state are sensitive task context. Collection must be bounded to the approved attempt, minimized before any model call, excluded from telemetry, and deleted under a documented retention policy.

Every attempt must show what app/screen will be acted on, obtain explicit approval, verify the observed result, and preserve ambiguity in task state rather than claiming success. Purchases, payments, messages/posts, deletions, and booking changes cannot use a standing approval. The current executor rejects this mode until those controls exist.

## Logging rules

Allowed: task ID, revision, capability ID, state transition, duration, error category, and opaque attempt ID.

Prohibited: access tokens, refresh tokens, provider credentials, full email bodies, free-form composer text, precise addresses, calendar notes, or raw model prompts.

## Required before external TestFlight / Play testing

- Apply the checked-in Supabase migration to the production project and verify task, event, and device isolation with two real test accounts.
- Exercise optimistic-concurrency conflict and offline-recovery scenarios against the deployed database, not only mocked API tests.
- Verify device-cache encryption, legacy migration, tamper failure, and key deletion on physical iOS and Android devices.
- Verify task deletion and hard account deletion against the deployed Supabase project, including cascade removal of task events and device records.
- Implement backend retention controls and a published privacy policy.
- Configure redaction tests for API logs and crash telemetry.
- Complete App Store privacy labels and Google Play Data safety declarations from this map.

## Crash and performance monitoring

- Release builds use Sentry only when `EXPO_PUBLIC_SENTRY_DSN` is configured.
- Default PII collection, screenshots, view hierarchy attachments, and Session Replay are disabled.
- Before transmission, monitoring events remove user identity, request data, contexts, extras, free-form messages, exception messages, and breadcrumb payloads.
- Allowed metadata is limited to static operation names plus `error_code`, `phase`, `capability`, `operation`, and `release_channel` tags.
- Email/notification source text, addresses, task drafts, account IDs, access tokens, confirmation snapshots, and executor receipt bodies must never be attached to monitoring events.
- `SENTRY_AUTH_TOKEN` is build-only and must be stored as a sensitive EAS environment secret; it is never exposed through an `EXPO_PUBLIC_` variable.

## User deletion controls

- A task can be permanently deleted after a destructive confirmation. The server applies the authenticated user's RLS scope; the client cannot submit a different user identity.
- Account deletion requires a valid user session and a second destructive confirmation. The server derives the target user ID only from the verified JWT and uses the server-only Supabase secret key to hard-delete that Auth user.
- Foreign keys cascade account deletion to `tasks`, `task_events`, and `devices`. After the server confirms deletion, the app removes local encrypted task records, the account encryption key, and the local session.
- A successful empty server task response is authoritative; the app does not resurrect a deleted task from its offline cache.

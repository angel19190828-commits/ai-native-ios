# Privacy and Data Map

Status: MVP working baseline  
Updated: 2026-09-19

## Data classes

| Data | Purpose | Current location | Release rule |
|---|---|---|---|
| Account ID and access/refresh tokens | Supabase email-OTP authentication and API authorization | Refresh session in platform SecureStore; short-lived access token in memory | Never log or include in model prompts; clear on sign-out |
| Task request and extracted facts | Plan and execute the user-requested workflow | Account-namespaced device task cache; Supabase tables protected by RLS when deployed | Encrypt server-side and add field-level device-cache encryption before external testing |
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

## Logging rules

Allowed: task ID, revision, capability ID, state transition, duration, error category, and opaque attempt ID.

Prohibited: access tokens, refresh tokens, provider credentials, full email bodies, free-form composer text, precise addresses, calendar notes, or raw model prompts.

## Required before external TestFlight / Play testing

- Apply the checked-in Supabase migration to the production project and verify task, event, and device isolation with two real test accounts.
- Exercise optimistic-concurrency conflict and offline-recovery scenarios against the deployed database, not only mocked API tests.
- Add field-level encryption or an encrypted database for task content stored on device.
- Implement account deletion and task-history deletion.
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

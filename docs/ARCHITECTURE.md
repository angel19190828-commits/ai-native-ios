# Cross-platform MVP Architecture

Status: Architecture decision baseline  
Updated: 2026-09-19

## Decision

Use **Expo SDK 57 + React Native + TypeScript** for the shared mobile application, with generated native projects and small Swift/Kotlin adapters for platform-only capabilities. SDK 57 is the current stable `create-expo-app` baseline in this repository; upgrades must follow Expo's versioned compatibility table. Keep AI planning, durable task orchestration, connector credentials, and audit receipts on the backend.

This is not a WebView wrapper around the prototype. The HTML prototype remains the interaction specification.

## System shape

```text
iOS / Android app
  UI + local task cache + permission broker
  native capability adapters
  share target / deep links / App Intent or Android shortcuts
            │ authenticated HTTPS + event stream
            ▼
API gateway
  auth · task API · policy checks · rate limits
            │
            ▼
durable task orchestrator
  state machine · immutable confirmation snapshots
  idempotency · retries · cancellation · receipts
       │                 │
       ▼                 ▼
AI planner          capability registry
structured plan     native action descriptors
no credentials      server connector executors
       │                 │
       └──────► Postgres + queue/worker
```

## Product model pivot

The invitation/interview flow is the first reference scenario, not the product boundary. The product is an intent-driven orchestration layer:

```text
user goal + current context + trigger
  → planner proposal
  → deterministic plan compiler and policy validation
  → decisions and immutable confirmation
  → dependency-aware capability execution
  → receipts and persistent task state
```

The domain model now distinguishes reusable `UserGoal`, `TaskContext`, `TaskTrigger`, `PlanDecision`, `PlanStepDefinition`, `Capability`, `ConfirmedPlan`, and `ExecutionReceipt` concepts. `src/domain/planCompiler.ts` validates stable step IDs, known dependencies, and an acyclic graph before a task can be reviewed. `src/capabilities/executor.ts` consumes only compiled steps and registered capability descriptors; it has no invitation, interview, dinner, travel, Calendar, or Maps branch.

Scenario adapters live outside the kernel. `src/scenarios/invitation.ts` translates the existing structured invitation response into the generic plan definition and supplies a temporary scenario-specific presentation model for the current UI. New scenarios should contribute context adapters, planner schemas, and capabilities—not branches in the reducer or executor. A non-invitation market-monitor-to-Notes test proves that a different capability graph runs through the same compiler, registry, reducer, confirmation, idempotency, and receipt path.

The legacy `Task.facts` view model remains during this milestone so encrypted caches, server snapshots, and the working interview UI do not require a destructive migration. New tasks also persist `goal`, `context`, and `triggers`; pre-pivot tasks may omit them when restored. A later storage migration will replace `facts` with scenario-owned projections after the generalized planner response is stable.

## Responsibility boundary

### Mobile app

- renders Task Activity, decisions, confirmation previews, and receipts;
- owns OS permission prompts and device-local authorization state;
- executes local capabilities only after receiving a signed execution instruction tied to the confirmed task revision;
- reports structured results back to the orchestrator;
- stores a device-local offline cache of active tasks and unsent drafts; credentials and refresh tokens use the platform secure store, while field-level encryption for task content remains a release gate before external testing;
- exposes this app’s own actions through App Intents/App Shortcuts on iOS and shortcuts/deep links on Android.

### Backend

- authenticates users and devices;
- stores canonical task state and append-only execution events;
- calls the model for extraction/planning using strict schemas;
- validates model output against registered capabilities and policy;
- coordinates local actions and server connector actions;
- owns connector tokens, idempotency keys, retry policy, and audit receipts;
- streams task events to devices without making UI state the source of truth.

### AI planner

- may extract facts, identify missing information, and propose typed steps;
- receives the minimum context required for the current operation;
- cannot directly call native APIs, access connector credentials, or mark an action successful;
- emits a plan that must pass schema validation and deterministic policy checks.

The first mobile boundary is `POST /api/plan`: source text is length-limited and explicitly treated as untrusted data, the model returns a response-schema-constrained proposal, the server performs semantic validation, and the mobile client validates the envelope again. Missing facts become a `needs_decision` task rather than invented values.

The account baseline uses Supabase email OTP. Refresh sessions are stored in the platform SecureStore, API calls carry a short-lived access token, and the API verifies Supabase JWTs against the project's JWKS. The initial database migration enables Row Level Security on `tasks`, `task_events`, and `devices`, with every policy bound to `auth.uid()`. `PUT /api/tasks` invokes an RLS-scoped database function that atomically updates the canonical task snapshot and appends its audit event. A monotonic `sync_version` prevents a stale device from overwriting newer state. The mobile app computes the next reducer state without mutating the local cache, commits it remotely, then stores the acknowledged version locally; therefore a conflict cannot advance either external execution or the visible local task. Device cache keys are also namespaced by account so signing into another account cannot replay the previous user's tasks. Guest mode exists only for explicit local development through `EXPO_PUBLIC_ALLOW_GUEST=true`; the release checker rejects it for distributable builds.

## Mobile code structure

```text
apps/mobile/
  app/                  Expo Router screens
  src/domain/           task state, events, policies, pure reducers
  src/api/              typed backend client and event stream
  src/capabilities/     shared registry and platform adapter interface
  src/storage/          secure credentials and offline task cache
  modules/              Swift/Kotlin modules where Expo APIs are insufficient
  ios/                  generated native project; App Intents target/config
  android/              generated native project; shortcuts/intents config
```

The domain reducer must be platform-independent and replayable from task events. UI components never directly call Calendar, Maps, notifications, or connector APIs.

The first executable contract now lives in `src/capabilities/`: a registry rejects duplicate capability IDs, the executor verifies descriptor risk against the confirmed step, chooses only dependency-satisfied work, binds every attempt to a deterministic idempotency key, and converts adapter results into receipts. A stop request prevents any new dispatch. Platform adapters must implement this contract rather than calling the reducer or UI directly.

`system.calendar.createEvent` is the first device adapter. It requests the minimum calendar access needed on iOS, selects a writable primary calendar on Android, validates typed event input, and returns the created OS event ID as the external receipt. It is configured for native builds through the Expo Calendar config plugin; a physical-device development build is required before treating this integration as verified.

The mobile cache uses an append-and-replay task record with bounded compaction, plus a separate task-scoped draft. For authenticated tasks, the server snapshot and append-only event table are canonical; launch restores the newest server task first and uses the account-scoped device cache only as an explicit offline fallback. Session credentials are isolated in iOS Keychain / Android Keystore-backed SecureStore and never written to AsyncStorage. Cache corruption is surfaced explicitly instead of silently discarding user work.

## Capability execution contract

1. Planner proposes an action using a registered action ID and validated arguments.
2. Policy engine attaches data scopes, risk, confirmation requirements, and executor location.
3. User confirmation creates an immutable `ConfirmedPlan` with a revision and digest.
4. Orchestrator creates an `ExecutionAttempt` and idempotency key.
5. Native actions are delivered to the authorized device; server actions run in workers.
6. Executor returns a typed receipt. Only a receipt can complete a step.
7. Failures classify as retryable, decision-required, permission-denied, or terminal.

## Initial capability IDs

- `system.calendar.queryAvailability`
- `system.calendar.createEvent`
- `maps.route.estimate`
- `maps.navigation.open`
- `system.reminder.schedule`
- `task.stopRemaining`

The first end-to-end executor now has concrete adapters for Calendar event creation, Google Routes transit estimation, and local preparation/departure notifications. Route output is stored in the commute receipt and passed to the reminder adapter as a typed dependency; reminder scheduling cannot start before that receipt exists. Every external side effect first persists `step.running`, then persists `step.completed` with its receipt. If the app restarts with a running step and no receipt, it surfaces recovery instead of automatically repeating a potentially successful write.

Android exact-time reminders currently request `SCHEDULE_EXACT_ALARM`. Before Play submission, verify that exact timing is core functionality under the current Play policy; otherwise switch to inexact scheduling and remove the permission.

## App Intents and Android integration

App Intents expose actions **performed by this app** to Siri, Shortcuts, Spotlight, and compatible Apple Intelligence surfaces. They do not grant arbitrary control over other apps. The initial intents are:

- Create Task from Text
- Show Pending Decision
- Continue Task
- Stop Task

The Android equivalents use app shortcuts, deep links, the Sharesheet, and explicit intents. There is no assumption of feature parity in system assistant surfaces; parity is defined at the task outcome level.

The SDK 57 implementation compiles app-owned Swift declarations from `apps/mobile/app-intents` into the iOS app target through Expo inline modules. An actor-backed, bounded persistent queue transfers cold-start invocations to JavaScript. Intents only open or select review context: even “Stop Task” asks the user to confirm in the app and never performs a write in Siri's background process. Android generates launcher shortcuts and `taskspace://` deep links through a deterministic config plugin. A local Kotlin Expo module consumes `ACTION_SEND` `text/plain` data exactly once and places it in the reviewable intake screen. The project intentionally does not mix the Expo SDK 58 beta `expo-app-intents` package into the stable SDK 57 build.

## Security invariants

- No provider/API secret is embedded in the mobile bundle.
- Every external write uses an idempotency key bound to user, task, revision, and action.
- Confirmation snapshots are immutable; editing after confirmation creates a new revision.
- Tokens are encrypted at rest and scoped per connector.
- Native adapters reject instructions for a different user, device, task revision, or expired signature.
- Model prompts and telemetry use redaction and data-minimization rules.
- Logs distinguish proposed, confirmed, attempted, and completed actions.

## Delivery sequence

1. Shared task domain model and replay tests.
2. Mobile shell with local fixture workflow matching the prototype.
3. Auth, task API, Postgres event store, and event streaming.
4. Structured AI extraction/planning endpoint.
5. Calendar, route, and reminder capability adapters.
6. Immutable confirmation, idempotent execution, stop/retry, and receipts.
7. Share targets, App Intents/App Shortcuts, Android shortcuts/deep links.
8. Privacy, observability, device QA, TestFlight, and Android internal testing.

## Next generalization milestone

The next milestone is a backend planner contract that returns a capability-neutral `PlanDefinition` instead of invitation fields. It must:

1. accept a direct goal plus one or more typed, minimized context items;
2. resolve only against a server-supplied catalog of registered capabilities and schemas;
3. return typed decisions for missing information rather than scenario-specific missing-field names;
4. pass deterministic graph, risk, scope, and confirmation policy validation before persistence;
5. keep the current invitation extractor as one adapter and prove a second real scenario (monitor → Notes or dinner planning) end to end.

Until that contract exists, `/api/plan` remains explicitly the invitation reference planner; it must not be presented as a general autonomous agent.

## Observability boundary

`src/observability/monitoring.ts` is the only mobile module allowed to call the monitoring SDK directly. Product code reports stable error codes and static lifecycle phases, never caught exception text or task content. A pure, tested sanitizer runs in Sentry's `beforeSend`, `beforeSendTransaction`, and `beforeBreadcrumb` hooks. Metro emits debug IDs/source maps, while the build-only `SENTRY_AUTH_TOKEN` authorizes upload from EAS. Monitoring is disabled when the public DSN is absent or malformed.

## Device storage encryption

Task snapshots, append-only events, indexes, and composer drafts are encrypted before entering AsyncStorage. Each account namespace owns a random 256-bit key stored with `WHEN_UNLOCKED_THIS_DEVICE_ONLY` accessibility in SecureStore. XChaCha20-Poly1305 authenticates both the value and its storage key, uses a fresh 192-bit nonce per write, and fails closed on tampering. Earlier plaintext cache entries are encrypted in place after their first successful read. Authentication refresh credentials remain in their separate SecureStore record.

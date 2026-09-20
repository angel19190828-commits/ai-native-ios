# AI Native MVP Scope

Status: Accepted for implementation  
Updated: 2026-09-19

## Product promise

Turn a natural-language goal into a reviewable, interruptible sequence of actions across apps and services, then show a durable receipt of what actually happened.

The differentiation is not “a chatbot that can do more.” It is an execution layer that is:

- more open than a system-only assistant because it can connect third-party APIs and user-installed capabilities;
- more dependable than a general chat assistant because planning and execution are separate, typed states;
- more trustworthy because every write or external action has scope, preview, confirmation, progress, cancellation, and a result receipt;
- cross-platform because the task model and plugin protocol are shared while system integrations are implemented per platform.

## First end-to-end use case

**Invitation → interview plan**

1. The user shares or pastes an invitation.
2. AI extracts the event, location, preparation requirements, and missing facts.
3. The app checks calendar availability without exposing unrelated event contents to the model.
4. A conflict pauses the task and requests a decision.
5. The app calculates a route and recommended departure time.
6. The user reviews one execution preview covering Calendar, commute, and reminders.
7. After explicit confirmation, the app creates the calendar event, stores the commute plan, and schedules preparation/departure reminders.
8. The task records per-step results and supports safe retry or stopping remaining work.

This workflow is the release gate. Additional email, dinner-planning, and generic-agent scenarios remain prototypes until this workflow is reliable on real devices.

## Supported inputs

- In-app paste or text entry.
- iOS Share Extension and Android Sharesheet target.
- iOS App Intent / App Shortcut that creates a draft task in this app.
- Deep link into an existing task or pending decision.

## MVP actions

| Capability | iOS | Android | Trust boundary |
|---|---|---|---|
| Calendar availability | EventKit | Calendar Provider | Read only; return busy intervals, not unrelated titles |
| Create event | EventKit | Calendar Provider / insert intent fallback | Explicit execution confirmation |
| Route estimate | Maps provider API | Maps provider API | Server query with coarse location only when approved |
| Open navigation | Apple/Google Maps URL handoff | Google Maps intent/URL | User-visible handoff |
| Preparation/departure reminder | EventKit Reminders or local notification | Local notification; calendar/task provider where supported | Explicit confirmation |
| AI extraction and planning | Backend API | Backend API | Structured output; AI cannot directly execute tools |

## Account and persistence

- Email magic-link account for internal testers.
- Guest onboarding is allowed, but execution history must migrate into the account on sign-in.
- Tasks, decisions, execution attempts, receipts, and plugin grants persist on the backend.
- Sensitive platform permissions and device-local identifiers remain on device.

## Plugin definition

A plugin is a capability package, not unrestricted code running inside the app. It declares typed actions, required scopes, risk level, confirmation policy, execution location, and idempotency behavior. MVP supports:

- built-in native capabilities shipped with the app;
- server connectors owned by this project;
- user-enabled connectors from an allowlist.

Arbitrary third-party plugin installation and unreviewed code execution are explicitly out of MVP scope.

## Required product states

`draft → planning → needs_decision → ready → executing → completed | partially_completed | failed | stopped`

Every task must preserve:

- the original user request;
- extracted facts and user corrections;
- proposed steps and permission scopes;
- the exact confirmed snapshot;
- execution attempts, idempotency keys, and receipts;
- pending decisions and resumable state.

## Internal-test release gates

- One real invitation workflow completes on both platforms.
- No write or external action occurs without a confirmed immutable snapshot.
- Calendar → commute → reminders ordering is enforced by the orchestrator.
- Repeated taps and network retries cannot duplicate writes.
- A task can be stopped between steps and safely resumed or retried.
- Permission denial and partial failure produce understandable recovery UI.
- Logs redact invitation text, auth tokens, precise location, and calendar contents by default.
- Automated tests cover state transitions, policy decisions, API contracts, and the primary device flow.
- Crash reporting, basic performance traces, privacy disclosure, tester feedback, and deletion/export paths exist.
- A signed iOS TestFlight build and Android internal-testing build install and complete the release-gate workflow on physical devices.

## Explicit non-goals for the first internal build

- Arbitrary control of apps that expose no supported API, intent, deep link, or share contract.
- Autonomous background execution of high-impact actions without confirmation.
- A public plugin marketplace.
- General computer-use automation or accessibility-based screen control.
- Claiming Apple Intelligence integration where the OS or an app has not exposed the required schema/capability.


# Changelog

## 2026-09-19 — Continuous Task Activity and conversation-first execution

### Mobile MVP foundation

- Defined the release-gate invitation-to-interview workflow, internal-testing gates, platform boundaries, and explicit non-goals.
- Chose Expo SDK 57, React Native 0.86, and TypeScript for the shared app with Swift/Kotlin adapters for platform-only capabilities.
- Added the initial iOS/Android app shell, bundle identifiers, deep-link scheme, shared task domain types, deterministic reducer, and native final-plan screen fixture.
- Added a versioned JSON Schema for capability plugin manifests, including scopes, risk, confirmation, execution location, result contracts, and idempotency.
- Documented the backend orchestrator boundary: AI proposes typed plans, deterministic policy approves them, and only executor receipts complete actions.
- Added a capability registry and dependency-aware executor with deterministic idempotency keys, typed failures, cancellation gates, and receipt-only completion.
- Added the first real device adapter for `system.calendar.createEvent`, including native permission descriptions and iOS/Android writable-calendar selection.
- Added 10 automated domain and capability tests covering confirmation, ordering, resume, stop, failure, registry drift, and receipts.
- Added persistent task/draft recovery with append-and-replay events, bounded compaction, explicit corruption handling, and SecureStore-isolated session credentials.
- Connected the native App shell to task and draft restoration; all four plan rows now select an editable conversation context.
- Added an initial privacy/data map that identifies current storage, prohibited logging, and the remaining encryption/deletion gates for external testing.
- Added the mobile `POST /api/plan` Gemini boundary with prompt-injection framing, input limits, timeout handling, a temporary production bearer gate, strict response schema, and semantic validation.
- Added a typed mobile AI client with authentication headers, cancellation, timeouts, structured errors, and response validation.
- Added deterministic conversion from AI proposals into task state, including missing-fact decisions and the invariant Calendar → commute → Reminders sequence.
- Expanded automated coverage to 4 API tests and 22 mobile tests.
- Replaced the mobile fixture-only launch with a real invitation intake screen that calls `/api/plan`, persists the resulting task, restores the last task after restart, and preserves failed source input for retry.
- Wired the single Send action to create and persist a SHA-256-bound immutable confirmation snapshot; no system capability is started when confirmation persistence fails.
- Added a server-side Google Routes endpoint and mobile route adapter; transit duration produces structured departure/arrival output rather than presentation text.
- Added cross-platform local preparation/departure scheduling whose timing is derived only from the commute receipt.
- Wired confirmed plans into the real Calendar → route → reminders executor, including the orange stop control, step-by-step persisted status, receipts, partial failure, and conservative recovery for unknown in-flight outcomes.
- Added an optional explicit origin at intake so physical appointments can complete the commute workflow without invented location data.
- Expanded coverage to 7 API tests and 27 mobile tests.
- Added EAS development, internal-preview, and production build profiles with explicit environments, remote version management, and production auto-increment.
- Added Expo development-client support, export-compliance configuration, notification build configuration, and EAS project-ID injection without committing account identifiers.
- Added a machine-enforced release checker plus internal store-listing and physical-device QA baselines; static release checks now pass while external credentials and published URLs remain explicit blockers.
- Added Supabase email-OTP authentication, SecureStore-backed refresh sessions, short-lived API access tokens, and an explicit development-only guest mode.
- Added a Supabase migration for account-owned tasks, append-only task events, and devices, with Row Level Security policies bound to `auth.uid()`.
- Namespaced the offline task cache by account and added an isolation test preventing one signed-in user from restoring another user's task state.
- Replaced the separate plan/route token checks with a shared JWKS-aware API authentication gate while retaining a constant-time local development token fallback.
- Expanded automated coverage to 10 API tests and 28 mobile tests.
- Added an authenticated Task API and transactional Supabase RPC that atomically persists the canonical task snapshot plus append-only audit event.
- Added monotonic sync versions and conflict responses so stale devices cannot overwrite newer task or execution state.
- Made authenticated launch restore the newest server task first, with the account-scoped local cache retained as an explicit offline fallback.
- Moved reducer transitions ahead of persistence without mutating local state; Calendar/route/reminder dispatch cannot start unless the corresponding running event is acknowledged by the server.
- Expanded automated coverage to 13 API tests and 31 mobile tests.
- Added four app-owned iOS App Intents and App Shortcuts for creating, reviewing, continuing, and requesting a stop; all route into the reviewable app state rather than bypassing confirmation.
- Added an actor-backed cold-start invocation queue compiled into the iOS app target through Expo inline modules, without mixing Expo SDK 58 beta native packages into the stable SDK 57 app.
- Added Android launcher shortcuts, `taskspace://` deep links, a text/plain Sharesheet target, and a local Kotlin Expo module that consumes shared text once into the intake screen.
- Added native integration release checks and App Intent/Android Sharesheet device QA cases.
- Expanded mobile automated coverage to 33 tests; Expo Doctor passes all 21 checks.

### Web prototype

- Rebuilt the latest V2 flow around a stable task-owned Activity Panel instead of replacing screens as work advances.
- Added parallel task state, per-task drafts, decisions, sources, permissions, results, and a Dynamic Island task switcher.
- Standardized interview execution as Calendar → commute → Reminders and added the missing executing state to the navigator.
- Moved Conversation into an independent bottom glass composer that follows the keyboard while the Dialog remains top-anchored and independently scrollable.
- Made interview, commute, reminder, and preparation summaries selectable as multi-context annotations; selection presets “Use this plan,” and Send advances directly to execution.
- Added automatic decision-panel presentation, conflict approval presets, the orange always-available stop control during running tasks, and task-scoped stop confirmation.
- Added progressive disclosure, local route expansion, transport-specific route summaries, simulated Apple Maps / Google Maps handoff, direct Settings navigation, and unified source/permission details.
- Added 16 browser behavior checks covering execution, multi-task continuity, local route expansion, settings, keyboard/composer layout, draft restoration, voice input, English, and Reduce Motion.

## 2026-09-05 — Figma device-screen prototype rebuild

### Figma prototype

- Rebuilt all 35 Chinese states on a clean `Prototype · Device Screens` page as standalone 393 × 852 device frames.
- Removed the captured webpage shell from the working prototype: black presentation canvas, state navigator, language switcher, and browser scrollbar are no longer part of each screen.
- Organized the screens into five workflow sections: main flow, adjustments and preferences, task management and system entry points, interview-day navigation, and exception/stop/undo handling.
- Replaced frame-wide click targets with control-level prototype hotspots on the visible buttons and pills.
- Added dedicated starting points for the main flow, adjustment flow, interview-day flow, stop flow, and undo flow.
- Preserved timed Smart Animate handoffs for AI planning and system write-in progress.
- Corrected the completed-task Dynamic Island so the stop control stays on the trailing edge of the island.
- Kept Floating Conversation Panels top-anchored and clipped to the device frame without visible desktop scrollbar chrome.

### Archive

- Renamed the earlier full-page capture board to `Capture Archive`; it remains available only as a visual reference and is not the active prototype.

## 2026-09-03 — Full Figma prototype state map

### Figma prototype

- Expanded the On Ting Yu team Figma file from the four-screen core flow to all 35 numbered Chinese UI states.
- Added editable captures for entry, planning, conflict resolution, commute, reminder, execution, task management, permissions, notification, Home Screen, route, interview-day, navigation, draft, missing-information, stop, and undo states.
- Added three appendix captures for runtime-only intermediate states: finishing planning, waiting for a reply, and the completion alias.
- Arranged the numbered states in a five-column master grid and moved the earlier four captures into a legacy reference area.
- Connected every numbered frame with Smart Animate prototype transitions and set `01 · 发现邀请` as the starting point for `AI 邮件规划 · 全状态中文原型`.

### Prototype capture support

- Added deterministic `lang=zh|en` query handling for design capture.
- Added review-only state presets for draft, commute adjustment, summary editing, partial stop, and task-dependent screens so every state can be rendered independently without replaying the full flow.

## 2026-08-30 — Floating Conversation Panel alignment

### Figma prototype

- Created the editable Chinese prototype file in On Ting Yu's team.
- Added and named four connected core states: pre-planning confirmation, AI planning, final plan, and system setup complete.
- Added Smart Animate navigation, an automatic planning transition, and a prototype starting point.

### Changed

- Standardized every AI conversational overlay as a top-anchored **Floating Conversation Panel**.
- Panels now open directly below the Dynamic Island at a consistent `92px` top anchor.
- Removed bottom anchoring from the initial assistant, invitation review, planning, conflict, commute, reminder, permission, route, stop, undo, completion, and failure conversations.
- Keyboard presentation now preserves the panel's top position and reduces only its available height; overflow scrolls inside the panel.
- Updated panel entrance motion to arrive from the Dynamic Island direction instead of rising from the bottom edge.
- Preserved the panel-to-Dynamic-Island handoff motion when a conversation is dismissed.
- Recalibrated the handoff travel distance for the new top anchor and extended it to every `.planning-sheet-v2` conversation state.
- Reframed the invitation review as an explicit **pre-planning confirmation** checkpoint.
- Added a dedicated “Confirm and start planning” primary action; the composer now only adds optional requirements.
- Removed the redundant prefilled composer instruction and replaced it with an example placeholder.
- Simplified the pre-planning panel hierarchy: split title/subtitle and reduced the visual weight of the planning preview.
- Removed the redundant read-only disclosure and expandable numbered step details; the planning preview is now a single static line.
- Collapsed optional requirements behind an explicit disclosure control; expanding it keeps the same panel mounted and presents the simulated keyboard.
- Made the confirmation CTA sticky so it remains visible until the keyboard is presented.
- Hid desktop scrollbar chrome on Floating Conversation Panels while preserving native touch and keyboard overflow scrolling.

### Fixed

- Prevented legacy `.planning-sheet-v2` states from bypassing the approved top-panel layout.
- Prevented legacy `.popover` states from briefly rendering with an inconsistent anchor before normalization.
- Kept simulated-keyboard interaction from shifting the full panel or the surrounding mail UI.
- Fixed the previous bottom-sheet handoff path, which would have overshot the Dynamic Island after the panel moved to the top.

### Design-system rule

All AI-generated conversational states use the Floating Conversation Panel. Only genuine iOS system surfaces—such as the keyboard, permission alerts, and action sheets—may originate from the bottom edge.

## 2026-09-06 — Figma native component rebuild

### Added

- Rebuilt `19 · 来源与权限`, `23 · 路线详情`, and `31 · 第三方能力` as editable 393×852 screen instances.
- Added shared `Navigation / Back`, `AI / Message Header`, permission/capability badges, source/app rows, route summary/timeline, buttons, and `Panel / Floating Conversation` variants.

### Changed

- Standardized secondary-panel navigation to a standalone icon-only back control with a 44×44 touch target; removed duplicate text back actions.
- Replaced overlapping/absolute-positioned panel content with Auto Layout regions and top-anchored panel variants.
- Route detail now exposes the decision-critical summary, timeline, live-update status, and one primary action.
- Sources and app-capability screens now separate actual task usage from capability examples and show explicit permission/support badges.

### QA

- Verified Chinese/English-safe wrapping, centered content, panel bounds, and absence of desktop scrollbar chrome at 100% screenshots.
- Verified the three rebuilt screens use component instances rather than captured DOM layers.

## 2026-09-07 — 51-state coverage and representative families

### Added

- Added the four-layer Task, Conversation, Permission, and External Data coverage matrix for a 51-screen product inventory.
- Added native component sets for Dynamic Island / AI Task, Composer, Pill / Quick Selection, Panel / Conversation States, and Panel / Commute States.
- Added Card / Commute Summary, Row / Commute Setting, Row / Single Selection, Device / Mail Context, and the executing panel.
- Added 10A · 选择出发地点, 10B · 选择交通方式, 36 · 键盘展开, and 37 · 多选要求.

### Changed

- Rebuilt 04 · AI 规划中, 06 · 需要决定, 09 · 通勤建议, and 10 · 调整通勤 with native component instances.
- Removed legacy dialog layers and negative-margin stop wrappers from the rebuilt screens.
- Standardized adaptive AI Header spacing, dark selected Pills, Composer rules, and same-panel commute subpages.
- Wired 24 real prototype controls with 220ms Smart Animate transitions.

### QA

- Verified all eight representative screens at 393×852 and 100% scale.
- Confirmed no Stop/text overlap, clipped Pills, desktop scrollbars, or accidental structural-frame fills.
- Confirmed Composer is present only on decision and additional-requirement states.

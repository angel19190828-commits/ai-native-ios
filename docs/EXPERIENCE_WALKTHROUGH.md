# Product Experience Walkthrough

Updated: 2026-09-19

This walkthrough exercises the visible product loop:

`Intent → Plan → Decision → Review → Execution → Receipt / Task State`

## Start here

Run the mobile app with a configured Taskspace API and sign in. The first screen has two entry tabs:

- **直接说目标**: type the outcome you want.
- **使用当前上下文**: state the goal separately, then paste or share email, message, webpage, product, or other text.

The **快速体验** cards fill representative content without bypassing the planner. They are sample inputs, not precomputed plans.

## Scenario A: message to dinner plan

1. Tap **群聊 → 聚餐**.
2. Review the filled goal and group-chat context. The origin is deliberately empty so the planner can request missing information.
3. Tap **理解意图并生成计划**.
4. If the task enters **Decision**, answer the visible question in the bottom composer. For an origin question, use a real starting address suitable for route testing.
5. In **Review**, inspect the execution boundary and each capability step. Tap a row, type a change such as “改成晚上 7:30” or “改从 Waterfront Station 出发,” then send; this creates a new plan revision.
6. With no pending edit, send **按这个安排** to create the immutable confirmation and execute.
7. Observe Calendar → route → reminder ordering in Task Activity. Completed steps show durable receipt summaries and timestamps.

This scenario does not search restaurants, reserve a table, contact participants, purchase, or pay. The supplied restaurant is context. Those actions must not appear unless a corresponding registered capability is added later.

## Scenario B: email to interview plan

1. Start a **新任务** and tap **邮件 → 面试**.
2. To exercise the existing reference implementation, tap **使用面试邀请 Reference 解析器**. To compare the generic planner, tap **理解意图并生成计划** instead.
3. Resolve any requested origin or missing detail.
4. Review the interview event, commute, reminder, and preparation information.
5. Optionally tap a row and send a natural-language change. The generic planner creates a new revision; the old confirmation cannot execute it.
6. Confirm and observe execution receipts.

## What is real

- AI plan and re-plan: real `POST /api/orchestrate` when Gemini and authentication are configured.
- Interview reference extraction: real `POST /api/plan`.
- Calendar creation: real device Calendar adapter and OS permission.
- Route estimate: real server-side Google Routes request when the server key is configured.
- Preparation/departure reminders: real local notifications and notification permission.
- Task, decision, confirmation, execution attempts, receipts, stop, recovery, encrypted cache, and authenticated sync: real application state.

## What remains sample or simulated

- The two Quick Experience cards only fill sample input text.
- Restaurant discovery, availability, reservation, participant messaging, purchase, and payment have no registered capability yet and are not executed.
- UI automation is an architecture extension point and is deliberately disabled.
- The browser HTML prototype and its simulated keyboard remain a design reference, not the native app runtime.

## Physical-device observations

- The shared text arrives as context rather than silently replacing the user's goal.
- Missing information produces a Decision and no system write.
- Editing a Review row creates a new revision and invalidates any older confirmation.
- Calendar permission appears only when the confirmed Calendar step executes.
- Calendar → route → reminder order remains stable; reminders never complete before route output.
- The orange stop action prevents new steps while retaining completed receipts.
- Backgrounding or terminating during execution never blindly repeats an ambiguous write.
- Permission denial and network failure preserve task state and show a recoverable failure rather than false success.
- Returning to the app restores the same task, composer draft, confirmed snapshot, and receipts.


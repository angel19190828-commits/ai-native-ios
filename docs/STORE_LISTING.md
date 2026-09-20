# Internal-testing Store Listing Baseline

Status: Draft; public privacy/support pages exist, while screenshots, a dedicated legal/support contact, stable test credentials, and signed builds remain release blockers.

## Product identity

- App name: Taskspace AI
- Subtitle: Reviewable AI workflows across your apps
- Bundle / application ID: `com.ontingyu.taskspace`
- Category: Productivity

## Short description

Turn invitations into reviewable plans that coordinate Calendar, commute timing, and reminders—with confirmation before anything changes.

## Full description

Taskspace AI converts an invitation or time-sensitive message into a structured plan. You can inspect the extracted time and place, provide an origin, review the exact Calendar, route, and reminder steps, and explicitly confirm before execution. Each step shows its live state and keeps a result receipt. You can stop remaining work without hiding actions that already completed.

The initial internal-test workflow supports appointment invitations. Taskspace is not an unrestricted system controller: it runs only registered capabilities, requests OS permissions when needed, and does not give the AI direct access to credentials or native APIs.

## Permission explanations

- Calendar: create the event that the tester explicitly confirmed.
- Notifications: schedule confirmed preparation and departure reminders.
- Network: send invitation text to the configured planning API and request a transit estimate.
- Exact alarms on Android: preserve the confirmed reminder time; policy eligibility must be reviewed before production.

## Review notes

1. Paste the supplied test invitation and enter an origin.
2. Tap “分析并生成计划”.
3. Review the proposed plan and tap Send once to confirm.
4. Grant Calendar and notification permissions.
5. Observe Calendar → transit route → reminders and their receipts.
6. During execution, use the orange stop control to stop remaining steps.

Required before submission: stable API environment, reviewer test account or approved guest-test mode, support URL, privacy-policy URL, account-deletion instructions, screenshots, and contact details.

## Public URLs

- Privacy policy: https://angel19190828-commits.github.io/ai-native-ios/privacy.html
- Support: https://angel19190828-commits.github.io/ai-native-ios/support.html

These pages describe the current internal-test implementation. Replace the GitHub Issues fallback with a dedicated support address before public release.

## Deletion instructions

- On the invitation intake screen, choose **永久删除账户与数据**.
- When a task is open, scroll below its plan rows to delete only that task or the entire account.
- Both actions require an explicit destructive confirmation. Account deletion permanently removes the Auth identity and associated cloud task/event/device records; task deletion does not undo items already written into Calendar or Reminders.

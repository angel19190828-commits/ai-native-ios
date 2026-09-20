# Internal-testing Store Listing Baseline

Status: Draft; URLs, screenshots, legal contact, and test credentials remain release blockers.

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


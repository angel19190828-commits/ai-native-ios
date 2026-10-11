# Windows browser smoke test

Browser Test Mode is a thin platform shell around the production mobile task kernel. It swaps only native storage/capability adapters and, when no API URL is configured, supplies a deterministic QA proposal fixture.

```powershell
# Run from the repository root.
npm run dev:browser
```

Open `http://localhost:8081` if Expo does not open it automatically.

Use **群聊 → 聚餐**, generate the plan, answer the origin decision, select a review row and send `改成晚上 7:30`, then clear the selection and confirm. Verify three simulated receipts appear in Calendar → route → reminders order. Refresh the page and verify the completed task and receipts recover.

Production code used in this path: Task/Plan/Decision models, plan compiler, reducer and event revisions, confirmation digest, dependency executor, receipt persistence, draft/task recovery, and UI journey.

Browser-only substitutions: deterministic QA proposal fixture when no API URL is configured; local browser persistence instead of SecureStore; simulated Calendar, route and notification adapters. App Intents and Sharesheet are not exercised. All four native/system boundaries require later iPhone validation.

## Real Files smoke test

Use system Chrome or Edge for the final download check; the Codex in-app browser may block download events.

1. Start a new task and enter `读取我选择的文本文件，并显示文件名、类型、大小和内容摘要。不要创建日历、路线或提醒。`
2. Confirm the plan. The operating browser must open its real file picker; choose a small `.txt`, `.md`, `.json`, or `.csv` file.
3. Verify the receipt leads with the selected file's name, MIME type, byte size, and content preview.
4. Start another task and enter `创建 test-plan.md，内容是：Files capability 已通过。不要创建日历、路线或提醒。`
5. Confirm, expand the receipt, and choose **下载文件**. A supported browser uses its system save picker; otherwise it triggers the standard browser download.

These two Browser Test Mode adapters are real browser I/O, not iPhone Files validation. The iPhone Document Picker/FileSystem/Sharing adapters remain pending physical-device verification.

## Explicit preference smoke test

This test proves a different task topology: one confirmed task changes the context available to a later task without adding a scenario workflow.

1. Start a new task and enter `请记住：以后创建摘要文件时，我明确偏好 Markdown 格式。`
2. Verify Review says `保存偏好：Markdown`, confirm, and verify an `明确偏好` receipt appears.
3. Start another task and enter `创建一份摘要文件，内容是：Personal Context 已生效。文件名你决定。`
4. Verify Review shows `参考偏好` and the live Gemini proposal creates a Markdown file such as `summary.md`.
5. Confirm and verify the result-first file receipt. In Browser Test Mode the encrypted preference persistence, Gemini planning, task revision, confirmation, and Blob-backed file result are real; iPhone SecureStore and Files integration still require physical-device validation.

The product does not infer preferences from activity in this milestone. Only values saved through the explicit preference capability are supplied to later planning.

## Per-attempt approval smoke test

1. Start a new task and enter `安全演示：准备向 alex@example.com 发送“项目已经完成”，但不要真实发送；我要验证高风险发送操作在执行前必须单独确认。`
2. Verify Live Gemini proposes the approval-demo action and Review clearly says that a second approval is required and that the reference action will not send externally.
3. Confirm the plan. Execution must pause on a separate `需要批准` surface showing recipient and body.
4. Choose **拒绝并返回修改**. Verify the task returns to Review, nothing executes, and the plan can be modified or confirmed again.
5. Confirm again, then choose **单独批准并继续**. Verify the receipt says the approval boundary was tested and no message was sent.

This validates high-impact plan → review → plan confirmation → per-attempt approval/refusal → receipt. It does not validate Gmail, SMS, or any real external send.

## Time-trigger continuation smoke test

1. Pick an ISO timestamp two minutes in the future and enter `在 <timestamp> 创建一条 Taskspace 笔记，标题是 时间触发验证，内容是 真实时间条件已经满足。不要创建日历或提醒。`
2. Verify Review shows a visible trigger condition and a single note action.
3. Confirm. The task must enter `等待中`; no note or receipt may exist before the displayed time.
4. Leave the page open, or refresh it to test local recovery. At/after the timestamp, the same task should continue automatically and produce the note receipt.

The browser clock, persisted task state, local note execution, and receipt are real. This is not a cloud background scheduler: if the browser/app is closed at the trigger time, it resumes when the task is next restored. External-condition triggers are not implemented in this milestone.

## Recurring task smoke test

1. Choose an ISO timestamp about one minute ahead and enter `重复任务测试：从 <timestamp> 开始，每 1 分钟创建一条 Taskspace 笔记，标题是 周期验证，内容是 本次 occurrence 已完成。不要创建日历或提醒。`
2. Verify Review shows `每 1 分钟` and the first run time, then confirm.
3. Observe at least two runs. The task must return to waiting after each run, increment `已完成 N 次`, preserve each occurrence receipt, and show a later next-run time.
4. Stop the task from the Dynamic Island. Verify prior occurrence results remain visible and no next run is presented as active.

Minute recurrence is an explicit QA cadence. Daily and weekly use the same topology. Timing remains client-resumed rather than cloud scheduled, and missed intervals are skipped instead of replayed in a burst.

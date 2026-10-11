import assert from 'node:assert/strict';
import test from 'node:test';

import { interviewTask } from '../domain/fixture';
import type { Task } from '../domain/task';
import { createExecutionPresentationModel, createTaskPresentationModel } from './taskPresentation';
import { buildExplicitPreferenceContext } from '../personalization/explicitPreferenceContext';

const base: Task = {
  id: 'task', request: '安排周五活动', phase: 'needs_decision', revision: 2,
  facts: { title: '周五活动', startsAt: '', address: '', preparation: [] },
  steps: [], stopRequested: false, updatedAt: '2026-09-20T00:00:00.000Z',
  pendingDecision: { id: 'when', prompt: '周五几点下班？', options: ['17:00', '18:00'] },
};

test('presentation model derives decision copy without changing the task', () => {
  const model = createTaskPresentationModel(base);
  assert.equal(model.mode, 'decision');
  assert.equal(model.headline, '周五几点下班？');
  assert.deepEqual(model.decisionOptions, ['17:00', '18:00']);
  assert.equal(base.phase, 'needs_decision');
});

test('presentation localizes a missing-origin decision for a Chinese task', () => {
  const task: Task = {
    ...base,
    request: '明天下午去攀岩，请先问我从哪里出发',
    pendingDecision: { id: 'origin', prompt: 'What departure location or address should I use?', options: [] },
  };
  const model = createTaskPresentationModel(task);
  assert.equal(model.headline, '你想从哪里出发？');
});

test('presentation model renders generic capability steps in review', () => {
  const task: Task = {
    ...base, phase: 'ready', pendingDecision: undefined,
    steps: [{ id: 'calendar', capabilityId: 'system.calendar.createEvent', title: '加入周五活动', risk: 'write', status: 'waiting', dependsOn: [], input: { startsAt: 'Friday 17:30' } }],
  };
  const model = createTaskPresentationModel(task);
  assert.equal(model.mode, 'review');
  assert.equal(model.rows[0].annotation, 'Calendar');
  assert.equal(model.rows[0].secondary, 'Friday 17:30');
});

test('review presentation leads with the user sequence for a multi-stop plan', () => {
  const task: Task = {
    ...base, phase: 'ready', pendingDecision: undefined,
    steps: [
      { id: 'climb', capabilityId: 'system.calendar.createEvent', title: '创建攀岩日程', risk: 'write', status: 'waiting', dependsOn: [], input: { title: '去攀岩', startDate: '2026-09-25T17:30:00-07:00', endDate: '2026-09-25T19:00:00-07:00', location: 'The Hive' } },
      { id: 'shop', capabilityId: 'system.calendar.createEvent', title: '创建购物日程', risk: 'write', status: 'waiting', dependsOn: [], input: { title: '买衣服', startDate: '2026-09-25T19:30:00-07:00', endDate: '2026-09-25T20:30:00-07:00', location: 'Pacific Centre' } },
      { id: 'route-climb', capabilityId: 'maps.route.estimate', title: '计算前往攀岩馆路线', risk: 'read', status: 'waiting', dependsOn: ['climb'], input: { origin: 'Pacific Centre', destination: 'The Hive', arriveBy: '2026-09-25T19:30:00-07:00' } },
    ],
  };
  const model = createTaskPresentationModel(task);
  assert.deepEqual(model.sequence.map((item) => item.primary), ['去攀岩', '买衣服', '前往 The Hive']);
  assert.equal(model.overview?.places, 'The Hive → Pacific Centre → The Hive');
  assert.match(model.overview?.arrivalTarget ?? '', /19:30.*The Hive/);
  assert.deepEqual(model.sequence[0].executionDetails, ['日历写入']);
});

test('review shows every activity and maps an explicit home deadline instead of a calendar start', () => {
  const task: Task = {
    ...base,
    request: '周六下午1点买攀岩鞋，然后去 The Hive 攀岩，晚上8点前回家',
    goal: { id: 'climbing-day', summary: '买攀岩鞋并去攀岩', desiredOutcome: '完成购物和攀岩并在晚上8点前回家' },
    phase: 'ready', pendingDecision: undefined,
    steps: [
      { id: 'shop', capabilityId: 'system.calendar.createEvent', title: '创建购物日程', risk: 'write', status: 'waiting', dependsOn: [], input: { title: '买攀岩鞋', startDate: '2026-09-26T13:00:00-07:00', endDate: '2026-09-26T14:00:00-07:00', location: 'Pacific Centre' } },
      { id: 'route-hive', capabilityId: 'maps.route.estimate', title: '前往 The Hive', risk: 'read', status: 'waiting', dependsOn: ['shop'], input: { origin: 'Pacific Centre', destination: 'The Hive', arriveBy: '2026-09-26T15:00:00-07:00' } },
      { id: 'climb', capabilityId: 'system.calendar.createEvent', title: '创建攀岩日程', risk: 'write', status: 'waiting', dependsOn: ['route-hive'], input: { title: '攀岩', startDate: '2026-09-26T15:00:00-07:00', endDate: '2026-09-26T18:00:00-07:00', location: 'The Hive' } },
      { id: 'route-home', capabilityId: 'maps.route.estimate', title: '回家', risk: 'read', status: 'waiting', dependsOn: ['climb'], input: { origin: 'The Hive', destination: '家', arriveBy: '2026-09-26T20:00:00-07:00' } },
    ],
  };
  const model = createTaskPresentationModel(task);
  assert.deepEqual(model.sequence.map((item) => item.primary), ['买攀岩鞋', '前往 The Hive', '攀岩', '回家']);
  assert.deepEqual(model.sequence.map((item) => item.annotation), ['周六 13:00 – 14:00', '周六 15:00', '周六 15:00 – 18:00', '周六 20:00']);
  assert.equal(model.overview?.places, 'Pacific Centre → The Hive → 家');
  assert.equal(model.overview?.arrivalTarget, '最晚周六 20:00 回到家');
  assert.equal(model.overview?.time, '周六 13:00 – 20:00');
});

test('review omits arrival target when there is no explicit deadline or route arrival constraint', () => {
  const task: Task = {
    ...base, request: '周六下午去攀岩', phase: 'ready', pendingDecision: undefined,
    steps: [{ id: 'climb', capabilityId: 'system.calendar.createEvent', title: '创建攀岩日程', risk: 'write', status: 'waiting', dependsOn: [], input: { title: '攀岩', startDate: '2026-09-26T15:00:00-07:00', endDate: '2026-09-26T18:00:00-07:00', location: 'The Hive' } }],
  };
  const model = createTaskPresentationModel(task);
  assert.equal(model.overview?.arrivalTarget, undefined);
});

test('review exposes confirmed personal context without treating it as an action', () => {
  const preference = buildExplicitPreferenceContext([{
    key: '文件格式', value: 'Markdown', category: 'files', updatedAt: '2026-09-20T00:00:00.000Z',
    taskId: 'preference-task', idempotencyKey: 'preference-attempt',
  }]);
  assert.ok(preference);
  const task: Task = {
    ...base, request: '创建一份摘要文件', phase: 'ready', pendingDecision: undefined,
    context: [{ id: preference.id ?? 'preferences', kind: preference.kind, sourceApp: preference.sourceApp, title: preference.title, data: { content: preference.content } }],
    steps: [{ id: 'file', capabilityId: 'files.document.create', title: '创建摘要', risk: 'write', status: 'waiting', dependsOn: [], input: { fileName: '摘要.md', content: '内容' } }],
  };
  const model = createTaskPresentationModel(task);
  assert.equal(model.overview?.preferences, '文件格式：Markdown');
  assert.deepEqual(model.sequence.map((item) => item.primary), ['创建文件「摘要.md」']);
});

test('review describes an explicit preference write as a user action instead of a generic step', () => {
  const task: Task = {
    ...base, request: '请记住我偏好 Markdown', phase: 'ready', pendingDecision: undefined,
    steps: [{ id: 'save-preference', capabilityId: 'taskspace.preferences.set', title: '保存文件格式偏好', risk: 'write', status: 'waiting', dependsOn: [], input: { key: '文件格式', value: 'Markdown', category: 'files' } }],
  };
  const model = createTaskPresentationModel(task);
  assert.equal(model.sequence[0].primary, '保存偏好：Markdown');
  assert.equal(model.sequence[0].secondary, '文件格式 · files');
});

test('recovery review preserves completed work as a result rather than a future action', () => {
  const task: Task = {
    ...base, phase: 'ready', pendingDecision: undefined,
    steps: [{
      id: 'note', capabilityId: 'taskspace.notes.create', title: '创建笔记', risk: 'write', status: 'completed', dependsOn: [], input: { title: 'beta recovery', content: '保留结果' },
      receipt: { attemptId: 'a', idempotencyKey: 'k', completedAt: '2026-09-20T00:00:00.000Z', summary: '笔记已保存' },
    }],
  };
  const model = createTaskPresentationModel(task);
  assert.equal(model.sequence[0].primary, '创建笔记「beta recovery」');
  assert.equal(model.sequence[0].annotation, '已完成');
  assert.match(model.sequence[0].secondary ?? '', /不会重复执行/);
});

test('calendar receipt leads with the outcome instead of the capability name', () => {
  const task: Task = {
    ...base, phase: 'completed', pendingDecision: undefined,
    steps: [{
      id: 'calendar', capabilityId: 'system.calendar.createEvent', title: '创建日程', risk: 'write', status: 'completed', dependsOn: [],
      input: { title: '攀岩', startDate: '2026-09-25T15:00:00-07:00', endDate: '2026-09-25T18:00:00-07:00', location: 'The Hive' },
      receipt: { attemptId: 'a', idempotencyKey: 'k', completedAt: '2026-09-20T00:00:00.000Z', summary: '日程已创建' },
    }],
  };
  const model = createExecutionPresentationModel(task);
  assert.equal(model.steps[0].result?.title, '已安排：攀岩');
  assert.match(model.steps[0].result?.metadata ?? '', /The Hive/);
});

test('review and execution expose a real time trigger as a waiting task', () => {
  const task: Task = {
    ...base, phase: 'ready', pendingDecision: undefined,
    triggers: [{ id: 'later', kind: 'time', configuration: { runAt: '2026-09-21T12:00:00Z' } }],
    steps: [{ id: 'note', capabilityId: 'taskspace.notes.create', title: '创建提示笔记', risk: 'write', status: 'waiting', dependsOn: [], input: { title: '提示', content: '条件已满足' } }],
  };
  assert.match(createTaskPresentationModel(task).overview?.trigger ?? '', /后继续/);
  task.phase = 'waiting';
  const waiting = createExecutionPresentationModel(task);
  assert.equal(waiting.mode, 'waiting');
  assert.equal(waiting.islandState, '等待中');
});

test('recurring waiting task exposes next run and prior occurrence result', () => {
  const task: Task = {
    ...base, phase: 'waiting', pendingDecision: undefined,
    triggers: [{ id: 'repeat', kind: 'time', configuration: { runAt: '2026-09-21T12:00:00Z', recurrence: { frequency: 'daily', interval: 1 } } }],
    triggerState: { nextRunAt: '2026-09-22T12:00:00Z', occurrence: 2 },
    occurrences: [{ sequence: 1, scheduledFor: '2026-09-21T12:00:00Z', completedAt: '2026-09-21T12:00:02Z', status: 'completed', failedStepIds: [], receipts: [{ stepId: 'note', receipt: { attemptId: 'a1', idempotencyKey: 'k1', completedAt: '2026-09-21T12:00:02Z', summary: '已保存第一条笔记' } }] }],
    steps: [{ id: 'note', capabilityId: 'taskspace.notes.create', title: '创建每日笔记', risk: 'write', status: 'waiting', dependsOn: [], input: { title: '每日', content: '记录' } }],
  };
  const model = createExecutionPresentationModel(task);
  assert.equal(model.recurrence?.label, '每 1 天');
  assert.equal(model.recurrence?.completedRuns, 1);
  assert.deepEqual(model.pastOccurrences[0].summaries, ['已保存第一条笔记']);
  task.phase = 'stopped'; task.stopRequested = true;
  assert.equal(createExecutionPresentationModel(task).recurrence?.nextRunAt, undefined);
});

test('execution presentation is derived only from step status and receipts', () => {
  const task: Task = {
    ...base, phase: 'partially_completed', pendingDecision: undefined,
    steps: [
      { id: 'one', capabilityId: 'system.calendar.createEvent', title: '创建日程', risk: 'write', status: 'completed', dependsOn: [], input: {}, receipt: { attemptId: 'a', idempotencyKey: 'k', completedAt: '2026-09-20T00:00:00.000Z', summary: '日程已创建' } },
      { id: 'two', capabilityId: 'system.reminder.schedule', title: '设置提醒', risk: 'write', status: 'failed', dependsOn: ['one'], input: {} },
    ],
  };
  const model = createExecutionPresentationModel(task);
  assert.equal(model.mode, 'partial_failure');
  assert.equal(model.completedCount, 1);
  assert.equal(model.steps[0].receiptSummary, '日程已创建');
  assert.equal(model.steps[1].statusLabel, '未完成');
});

test('eligible always-confirmed action becomes an explicit consequence-first approval state', () => {
  const task: Task = {
    ...base, phase: 'executing', pendingDecision: undefined,
    steps: [{
      id: 'send-demo', capabilityId: 'taskspace.messaging.approvalDemo', title: '演示向 Alex 发送消息',
      risk: 'external-action', status: 'waiting', dependsOn: [], input: { recipient: 'alex@example.com', body: '项目已经完成' },
      policy: { executor: 'device', interactionMode: 'structured', confirmation: 'always', scopes: ['taskspace.messaging.approval-demo'] },
    }],
  };
  const model = createExecutionPresentationModel(task);
  assert.equal(model.mode, 'approval');
  assert.equal(model.pendingApproval?.stepId, 'send-demo');
  assert.match(model.pendingApproval?.detail ?? '', /alex@example.com/);
});

test('stopped presentation preserves completed receipts and the stopped boundary', () => {
  const task: Task = {
    ...base, phase: 'stopped', pendingDecision: undefined, stopRequested: true,
    steps: [
      { id: 'done', capabilityId: 'system.calendar.createEvent', title: '创建日程', risk: 'write', status: 'completed', dependsOn: [], input: {}, receipt: { attemptId: 'a', idempotencyKey: 'k', completedAt: '2026-09-20T00:00:00.000Z', summary: '日程已创建' } },
      { id: 'halted', capabilityId: 'system.reminder.schedule', title: '设置提醒', risk: 'write', status: 'stopped', dependsOn: ['done'], input: {} },
    ],
  };
  const model = createExecutionPresentationModel(task);
  assert.equal(model.mode, 'stopped');
  assert.equal(model.completedCount, 1);
  assert.equal(model.steps[0].receiptSummary, '日程已创建');
  assert.equal(model.steps[1].statusLabel, '已停止');
});

test('file receipt leads with the usable result and keeps technical metadata secondary', () => {
  const task = structuredClone(interviewTask);
  task.phase = 'completed';
  task.steps = [{
    id: 'file', capabilityId: 'files.document.create', title: '创建摘要文件', risk: 'write', status: 'completed', dependsOn: [], input: {},
    receipt: {
      attemptId: 'attempt-file', idempotencyKey: 'file-key', completedAt: '2026-09-20T00:00:00.000Z', summary: '已生成可下载文件「摘要.md」',
      externalId: 'browser-download:attempt-file', output: { fileName: '摘要.md', mimeType: 'text/markdown', sizeBytes: 2048, contentPreview: '# 摘要\n完成。', content: '# 摘要\n完成。', source: 'browser-download' },
    },
  }];
  const model = createExecutionPresentationModel(task);
  assert.equal(model.steps[0].result?.title, '摘要.md');
  assert.equal(model.steps[0].result?.metadata, 'text/markdown · 2.0 KB');
  assert.equal(model.steps[0].result?.actionLabel, '下载文件');
  assert.equal(model.steps[0].externalId, 'browser-download:attempt-file');
});

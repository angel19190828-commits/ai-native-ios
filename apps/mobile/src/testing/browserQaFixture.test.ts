import assert from 'node:assert/strict';
import test from 'node:test';

import { createBrowserQaProposal } from './browserQaFixture';

test('browser QA fixture requests origin before producing capability steps', () => {
  const proposal = createBrowserQaProposal({
    goal: '根据群聊安排周五晚餐', locale: 'zh-CN', timeZone: 'America/Vancouver',
    context: [{ kind: 'message', content: '六个人去 Miku 吃饭' }],
  });
  assert.equal(proposal.steps.length, 0);
  assert.equal(proposal.decisions[0]?.id, 'origin');
});

test('browser QA fixture preserves production capability order after decision', () => {
  const proposal = createBrowserQaProposal({
    goal: '根据群聊安排周五晚餐', locale: 'zh-CN', timeZone: 'America/Vancouver',
    context: [
      { kind: 'message', content: '六个人去 Miku 吃饭' },
      { kind: 'direct-input', title: '你从哪里出发？', content: '1285 W Pender Street' },
    ],
  });
  assert.deepEqual(proposal.steps.map((step) => step.capabilityId), [
    'system.calendar.createEvent', 'maps.route.estimate', 'system.reminder.schedule',
  ]);
  assert.deepEqual(proposal.steps[2]?.dependsOn, ['commute']);
});

test('browser QA fixture accepts a review-time change as a new proposal', () => {
  const proposal = createBrowserQaProposal({
    goal: '安排面试', locale: 'zh-CN', timeZone: 'America/Vancouver',
    context: [
      { kind: 'email', content: '面试地址 555 Burrard Street' },
      { kind: 'direct-input', title: '出发地点', content: '1285 W Pender Street' },
      { kind: 'direct-input', title: '修改：创建面试日程', content: '改成上午 11:30' },
    ],
  });
  const localTime = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Vancouver', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(String(proposal.steps[0]?.input.startDate)));
  assert.equal(localTime, '11:30');
});

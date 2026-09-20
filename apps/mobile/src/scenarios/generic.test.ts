import assert from 'node:assert/strict';
import test from 'node:test';

import { genericProposalToPlanDefinition } from './generic';

test('generic proposal preserves shared context and derives only a presentation projection', () => {
  const plan = genericProposalToPlanDefinition({
    request: '安排周五聚餐', now: '2026-09-19T20:00:00Z', origin: 'Office',
    context: [{ id: 'chat', kind: 'shared-content', sourceApp: 'Messages', content: '周五七点在 Miku，六个人' }],
    proposal: {
      summary: '周五聚餐', desiredOutcome: '创建聚餐日程和提醒', triggers: [{ id: 'manual', kind: 'manual', configuration: {} }], decisions: [],
      steps: [{
        id: 'calendar', capabilityId: 'system.calendar.createEvent', title: '创建聚餐日程', risk: 'write',
        policy: { executor: 'device', interactionMode: 'structured', confirmation: 'once_per_plan', scopes: ['calendar.write'] }, dependsOn: [],
        input: { title: 'Weekend Dinner', startDate: '2026-09-25T19:00:00-07:00', endDate: '2026-09-25T21:00:00-07:00', location: 'Miku Vancouver' },
      }],
    },
  });
  assert.equal(plan.context[0].kind, 'shared-content');
  assert.equal(plan.context[0].sourceApp, 'Messages');
  assert.equal(plan.presentation.address, 'Miku Vancouver');
  assert.equal(plan.steps[0].capabilityId, 'system.calendar.createEvent');
});

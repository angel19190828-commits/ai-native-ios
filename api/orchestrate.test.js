const assert = require('node:assert/strict');
const test = require('node:test');

const handler = require('./orchestrate');
const { validateCapabilityInput } = require('./_capabilities');

function response() {
  return {
    statusCode: 200, headers: {}, body: undefined,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; },
  };
}

const rawProposal = {
  summary: '安排明天的会面', desiredOutcome: '日历中有已确认的会面和提醒',
  triggers: [{ id: 'manual', kind: 'manual', configurationJson: '{}' }], decisions: [],
  steps: [
    { id: 'calendar', title: '创建会面', capabilityId: 'system.calendar.createEvent', dependsOn: [], bindings: [], inputJson: JSON.stringify({ title: '会面', startDate: '2026-09-20T10:00:00-07:00', endDate: '2026-09-20T11:00:00-07:00' }) },
    { id: 'reminder', title: '设置提醒', capabilityId: 'system.reminder.schedule', dependsOn: ['calendar'], bindings: [], inputJson: JSON.stringify({ eventStartsAt: '2026-09-20T10:00:00-07:00', preparation: [] }) },
  ],
};

test('normalizes a direct goal and typed context', () => {
  const input = handler.normalizeRequest({ goal: '安排聚餐', context: [{ kind: 'message', content: '周五七点，六个人' }] });
  assert.equal(input.goal, '安排聚餐');
  assert.equal(input.context[0].kind, 'message');
  assert.equal(input.context[0].id, 'context-1');
});

test('time triggers require one exact ISO runAt configuration', () => {
  const proposal = handler.validateProposal({
    ...rawProposal,
    triggers: [{ id: 'later', kind: 'time', configurationJson: '{"runAt":"2026-09-21T12:00:00Z"}' }],
  });
  assert.equal(proposal.triggers[0].configuration.runAt, '2026-09-21T12:00:00Z');
  assert.throws(() => handler.validateProposal({
    ...rawProposal,
    triggers: [{ id: 'later', kind: 'time', configurationJson: '{"localTime":"12:00"}' }],
  }), /time trigger configuration/);
  const recurring = handler.validateProposal({
    ...rawProposal,
    triggers: [{ id: 'daily', kind: 'time', configurationJson: '{"runAt":"2026-09-21T12:00:00Z","recurrence":{"frequency":"daily","interval":1}}' }],
  });
  assert.deepEqual(recurring.triggers[0].configuration.recurrence, { frequency: 'daily', interval: 1 });
  assert.throws(() => handler.validateProposal({
    ...rawProposal,
    triggers: [{ id: 'bad-repeat', kind: 'time', configurationJson: '{"runAt":"2026-09-21T12:00:00Z","recurrence":{"frequency":"hourly","interval":0}}' }],
  }), /recurrence configuration/);
});

test('catalog rejects unknown capabilities and unknown arguments', () => {
  assert.throws(() => validateCapabilityInput('payments.checkout', {}), /not registered/);
  assert.throws(() => validateCapabilityInput('system.calendar.createEvent', {
    title: 'Meeting', startDate: '2026-09-20T10:00:00Z', endDate: '2026-09-20T11:00:00Z', secret: 'no',
  }), /unknown arguments/);
});

test('catalog validates generic content artifacts without pretending to send externally', () => {
  const note = validateCapabilityInput('taskspace.notes.create', { title: '研究摘要', content: '三个要点', tags: ['研究'] });
  assert.equal(note.descriptor.scopes[0], 'taskspace.notes.write');
  const draft = validateCapabilityInput('taskspace.messaging.createDraft', { recipient: 'Alex', body: '明天见' });
  assert.equal(draft.input.body, '明天见');
  const preference = validateCapabilityInput('taskspace.preferences.set', { key: 'food', value: '素食' });
  assert.equal(preference.input.value, '素食');
  assert.throws(() => validateCapabilityInput('taskspace.messaging.createDraft', { recipient: 'Alex' }), /body is invalid/);
});

test('high-impact reference action is always-confirmed and cannot claim a real send', () => {
  const demo = validateCapabilityInput('taskspace.messaging.approvalDemo', {
    recipient: 'alex@example.com', body: '项目已经完成',
  });
  assert.equal(demo.descriptor.risk, 'external-action');
  assert.equal(demo.descriptor.confirmation, 'always');
  assert.match(demo.descriptor.description, /never sends/);
});

test('catalog validates real file read and create capabilities with receipt binding support', () => {
  const read = validateCapabilityInput('files.document.read', { acceptedTypes: ['text/plain'], maxBytes: 100000 });
  assert.equal(read.descriptor.risk, 'read');
  assert.equal(read.input.maxBytes, 100000);
  const create = validateCapabilityInput('files.document.create', { fileName: 'copy.md' }, { deferredKeys: ['content'] });
  assert.equal(create.input.content, undefined);
  assert.equal(create.descriptor.scopes[0], 'files.write.user-export');
  assert.throws(() => validateCapabilityInput('files.document.read', { acceptedTypes: ['application/octet-stream'] }), /acceptedTypes/);
  assert.throws(() => validateCapabilityInput('files.document.create', { fileName: 'unsafe.exe', content: 'x' }), /extension/);
});

test('server attaches capability risk and validates an acyclic proposal', () => {
  const proposal = handler.validateProposal(rawProposal);
  assert.deepEqual(proposal.steps.map((step) => step.risk), ['write', 'write']);
  assert.deepEqual(proposal.steps[0].policy, { executor: 'device', interactionMode: 'structured', confirmation: 'once_per_plan', scopes: ['calendar.write'] });
  assert.deepEqual(proposal.steps[1].dependsOn, ['calendar']);
});

test('validates receipt bindings only for declared dependencies and capability inputs', () => {
  const proposal = handler.validateProposal({ ...rawProposal, steps: [
    rawProposal.steps[0],
    {
      ...rawProposal.steps[1], inputJson: JSON.stringify({ preparation: [] }),
      bindings: [{ targetKey: 'eventStartsAt', fromStepId: 'calendar', outputKey: 'startDate', required: true }],
    },
  ] });
  assert.deepEqual(proposal.steps[1].bindings[0], {
    targetKey: 'eventStartsAt', fromStepId: 'calendar', outputKey: 'startDate', required: true,
  });
  assert.equal(proposal.steps[1].input.eventStartsAt, undefined);

  assert.throws(() => handler.validateProposal({ ...rawProposal, steps: [
    rawProposal.steps[0],
    { ...rawProposal.steps[1], bindings: [{ targetKey: 'unknownField', fromStepId: 'calendar', outputKey: 'startDate', required: true }] },
  ] }), /does not support binding target/);
  assert.throws(() => handler.validateProposal({ ...rawProposal, steps: [
    rawProposal.steps[0],
    { ...rawProposal.steps[1], bindings: [{ targetKey: 'eventStartsAt', fromStepId: 'not-a-dependency', outputKey: 'startDate', required: true }] },
  ] }), /step binding is invalid/);
});

test('required decisions may safely defer all execution steps', () => {
  const proposal = handler.validateProposal({
    summary: '安排旅行', desiredOutcome: '形成可确认的旅行计划', triggers: [], steps: [],
    decisions: [{ id: 'destination', prompt: '你想去哪里？', options: [], required: true }],
  });
  assert.equal(proposal.steps.length, 0);
  assert.equal(proposal.decisions[0].required, true);
});

test('a required decision safely defers known capability steps with missing input', () => {
  const proposal = handler.validateProposal({
    ...rawProposal,
    decisions: [{ id: 'origin', prompt: '你想从哪里出发？', options: [], required: true }],
    steps: [{
      id: 'route', title: '估算路线', capabilityId: 'maps.route.estimate', dependsOn: [], bindings: [],
      inputJson: JSON.stringify({ destination: 'The Hive', arriveBy: '2026-09-22T15:00:00-07:00', mode: 'transit' }),
    }],
  });
  assert.equal(proposal.steps.length, 0);
  assert.equal(proposal.decisions[0].id, 'origin');
});

test('rejects dependency cycles and model-selected unknown capabilities', () => {
  assert.throws(() => handler.validateProposal({ ...rawProposal, steps: [
    { ...rawProposal.steps[0], dependsOn: ['reminder'] }, rawProposal.steps[1],
  ] }), /cycle/);
  assert.throws(() => handler.validateProposal({ ...rawProposal, steps: [
    { ...rawProposal.steps[0], capabilityId: 'external.unregistered.run' },
  ] }), /not registered/);
  assert.throws(() => handler.validateProposal({ ...rawProposal, steps: [
    { ...rawProposal.steps[0], id: '../unsafe' },
  ] }), /step ID is invalid/);
});

test('endpoint returns only a server-validated proposal', async (context) => {
  process.env.NODE_ENV = 'test'; process.env.GEMINI_API_KEY = 'test-key';
  const originalFetch = global.fetch; context.after(() => { global.fetch = originalFetch; });
  global.fetch = async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(rawProposal) }] } }] }) });
  const res = response();
  await handler({ method: 'POST', headers: {}, body: { goal: '安排明天的会面', context: [] } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.proposal.steps[0].capabilityId, 'system.calendar.createEvent');
  assert.equal(res.body.proposal.steps[0].risk, 'write');
});

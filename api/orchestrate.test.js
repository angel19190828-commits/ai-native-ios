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

test('catalog rejects unknown capabilities and unknown arguments', () => {
  assert.throws(() => validateCapabilityInput('payments.checkout', {}), /not registered/);
  assert.throws(() => validateCapabilityInput('system.calendar.createEvent', {
    title: 'Meeting', startDate: '2026-09-20T10:00:00Z', endDate: '2026-09-20T11:00:00Z', secret: 'no',
  }), /unknown arguments/);
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

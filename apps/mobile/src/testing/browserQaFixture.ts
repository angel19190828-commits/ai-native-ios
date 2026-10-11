import type { OrchestrateInput, OrchestrationProposal } from '../api/orchestratorClient';

const policy = (executor: 'device' | 'server', scopes: string[]) => ({
  executor,
  interactionMode: 'structured' as const,
  confirmation: 'once_per_plan' as const,
  scopes,
});

const latestContent = (input: OrchestrateInput, title: string) => [...input.context]
  .reverse()
  .find((item) => item.title?.includes(title))?.content;

const hasOrigin = (input: OrchestrateInput) => input.context.some((item) =>
  item.title === '出发地点' || item.title?.includes('从哪里出发') || item.title?.includes('出发地点'));

const modifiedTime = (input: OrchestrateInput, fallback: string) => {
  const instruction = latestContent(input, '修改');
  if (!instruction) return fallback;
  const match = instruction.match(/(?:晚上|下午)?\s*(\d{1,2})(?:[:：点](\d{1,2}))?/);
  if (!match) return fallback;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  if (/(晚上|下午)/.test(instruction) && hour < 12) hour += 12;
  const next = new Date(fallback);
  next.setHours(hour, minute, 0, 0);
  return next.toISOString();
};

/**
 * Deterministic QA fixture for Windows browser testing only. It exercises the
 * production plan compiler and state machine without presenting itself as AI.
 */
export function createBrowserQaProposal(input: OrchestrateInput): OrchestrationProposal {
  const combined = `${input.goal}\n${input.context.map((item) => item.content).join('\n')}`;
  const dinner = /(聚餐|晚餐|吃饭|Miku)/i.test(combined);
  const destination = dinner ? 'Miku Vancouver, 200 Granville Street' : '555 Burrard Street, Vancouver';
  const baseStart = dinner ? '2027-07-30T19:00:00-07:00' : '2027-07-28T10:30:00-07:00';
  const startDate = modifiedTime(input, baseStart);
  const endDate = new Date(Date.parse(startDate) + (dinner ? 120 : 60) * 60_000).toISOString();
  const origin = [...input.context].reverse().find((item) => item.title === '出发地点')?.content
    ?? latestContent(input, '从哪里出发');

  if (!hasOrigin(input)) {
    return {
      summary: dinner ? '周五晚餐安排' : '面试安排',
      desiredOutcome: dinner ? '与 6 位朋友按时到达晚餐地点' : '按时到达面试并完成准备',
      triggers: [{ id: 'manual-review', kind: 'manual', configuration: {} }],
      decisions: [{ id: 'origin', prompt: '你从哪里出发？', options: [], required: true }],
      steps: [],
    };
  }

  return {
    summary: dinner ? '周五晚餐安排' : '面试安排',
    desiredOutcome: dinner ? '与 6 位朋友按时到达晚餐地点' : '按时到达面试并完成准备',
    triggers: [{ id: 'manual-review', kind: 'manual', configuration: {} }],
    decisions: [],
    steps: [
      {
        id: 'calendar', capabilityId: 'system.calendar.createEvent', title: dinner ? '创建晚餐日程' : '创建面试日程', risk: 'write',
        policy: policy('device', ['calendar.write']), dependsOn: [],
        input: { title: dinner ? 'Weekend Dinner · 6 人' : 'Alex 面试', startDate, endDate, location: destination },
      },
      {
        id: 'commute', capabilityId: 'maps.route.estimate', title: '计算通勤与建议出发时间', risk: 'read',
        policy: policy('server', ['location.route']), dependsOn: ['calendar'],
        input: { origin: origin ?? 'Vancouver', destination, arriveBy: startDate, arrivalMinutesEarly: dinner ? 0 : 15 },
      },
      {
        id: 'reminders', capabilityId: 'system.reminder.schedule', title: '设置准备与出发提醒', risk: 'write',
        policy: policy('device', ['notifications.schedule']), dependsOn: ['commute'],
        bindings: [{ targetKey: 'routeDepartureAt', fromStepId: 'commute', outputKey: 'departureAt', required: true }],
        input: { eventStartsAt: startDate, preparationMinutesBeforeDeparture: 30, preparation: dinner ? ['确认人数'] : ['携带作品集'] },
      },
    ],
  };
}

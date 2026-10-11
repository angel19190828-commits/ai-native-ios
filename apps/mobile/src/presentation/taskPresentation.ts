import type { Task } from '../domain/task';
import { explicitPreferenceSummary } from '../personalization/explicitPreferenceContext';
import { nextTaskRunAt, taskRecurrence } from '../domain/timeTrigger';

export interface TaskPresentationRow {
  id: string;
  annotation: string;
  primary: string;
  secondary?: string;
  glyph: string;
}

export interface TaskPresentationModel {
  mode: 'planning' | 'decision' | 'review';
  islandTitle: string;
  islandState: string;
  eyebrow: string;
  headline: string;
  supportingText?: string;
  revisionLabel: string;
  decisionOptions: string[];
  overview?: {
    time?: string;
    places?: string;
    arrivalTarget?: string;
    constraints?: string;
    preferences?: string;
    trigger?: string;
  };
  sequence: Array<TaskPresentationRow & { executionDetails: string[] }>;
  rows: TaskPresentationRow[];
}

export interface ExecutionPresentationStep {
  id: string;
  title: string;
  capability: string;
  glyph: string;
  status: Task['steps'][number]['status'];
  statusLabel: string;
  receiptSummary?: string;
  receiptAt?: string;
  externalId?: string;
  result?: {
    title: string;
    metadata?: string;
    preview?: string;
    actionLabel?: string;
    actionOutput?: Record<string, unknown>;
  };
}

export interface ExecutionPresentationModel {
  mode: 'waiting' | 'execution' | 'approval' | 'receipt' | 'partial_failure' | 'failed' | 'stopped';
  islandTitle: string;
  islandState: string;
  eyebrow: string;
  headline: string;
  supportingText: string;
  completedCount: number;
  totalCount: number;
  steps: ExecutionPresentationStep[];
  pendingApproval?: { stepId: string; title: string; consequence: string; detail: string };
  recurrence?: { label: string; completedRuns: number; nextRunAt?: string };
  pastOccurrences: Array<{ sequence: number; completedAt: string; status: 'completed' | 'failed'; summaries: string[] }>;
}

const capabilityCopy: Record<string, { label: string; glyph: string }> = {
  'system.calendar.createEvent': { label: 'Calendar', glyph: '▣' },
  'maps.route.estimate': { label: '通勤安排', glyph: '⌁' },
  'system.reminder.schedule': { label: '提醒', glyph: '♧' },
  'taskspace.notes.create': { label: 'Taskspace 笔记', glyph: '▤' },
  'taskspace.messaging.createDraft': { label: '消息草稿', glyph: '◇' },
  'taskspace.messaging.approvalDemo': { label: '发送批准演示', glyph: '!' },
  'taskspace.preferences.set': { label: '明确偏好', glyph: '☆' },
  'files.document.read': { label: '文件读取', glyph: '▧' },
  'files.document.create': { label: '文件创建', glyph: '⇩' },
};

const formatBytes = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const executionResult = (step: Task['steps'][number]): ExecutionPresentationStep['result'] => {
  const output = step.receipt?.output ?? {};
  if (step.capabilityId === 'files.document.read' || step.capabilityId === 'files.document.create') {
    if (!step.receipt?.output) return undefined;
    const fileName = text(output.fileName) ?? '文件';
    return {
      title: fileName,
      metadata: [text(output.mimeType), formatBytes(output.sizeBytes)].filter(Boolean).join(' · ') || undefined,
      preview: text(output.contentPreview),
      actionLabel: step.capabilityId === 'files.document.create' ? (output.source === 'browser-download' ? '下载文件' : '打开或分享文件') : undefined,
      actionOutput: step.capabilityId === 'files.document.create' ? output : undefined,
    };
  }
  if (step.capabilityId === 'taskspace.notes.create' || step.capabilityId === 'taskspace.messaging.createDraft') {
    return { title: text(output.title) ?? step.receipt?.summary ?? step.title, preview: text(output.contentPreview) };
  }
  if (step.capabilityId === 'taskspace.messaging.approvalDemo') {
    return { title: '没有发送任何消息', metadata: step.receipt?.summary };
  }
  if (step.capabilityId === 'system.calendar.createEvent') {
    return {
      title: `已安排：${text(step.input.title) ?? step.title}`,
      metadata: [dateRange(step.input.startDate, step.input.endDate), text(step.input.location)].filter(Boolean).join(' · ') || undefined,
      preview: step.receipt?.summary,
    };
  }
  if (step.capabilityId === 'maps.route.estimate') {
    return {
      title: `路线：${text(step.input.origin) ?? '出发地'} → ${text(step.input.destination) ?? '目的地'}`,
      metadata: temporalValue(output.departureAt) ? `${dateTime(output.departureAt)} 出发` : undefined,
      preview: step.receipt?.summary,
    };
  }
  if (step.capabilityId === 'system.reminder.schedule') {
    return { title: '准备与出发提醒已设置', preview: step.receipt?.summary };
  }
  if (step.capabilityId === 'taskspace.preferences.set') {
    return { title: text(output.value) ?? step.receipt?.summary ?? step.title, metadata: '用户明确保存的偏好' };
  }
  return undefined;
};

const text = (value: unknown) => typeof value === 'string' ? value : undefined;

const dateTime = (value: unknown) => {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return undefined;
  return new Date(value).toLocaleString('zh-CN', { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
    .replace(/(周[一二三四五六日天])(\d)/u, '$1 $2');
};

const dateRange = (start: unknown, end: unknown) => {
  const from = dateTime(start); const to = dateTime(end);
  const endTime = typeof end === 'string' && !Number.isNaN(Date.parse(end))
    ? new Date(end).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }) : undefined;
  return from && to && endTime ? `${from} – ${endTime}` : from;
};

const temporalValue = (value: unknown) => typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : undefined;

const timelineRange = (steps: Task['steps']) => {
  const starts = steps.flatMap((step) => {
    const value = temporalValue(step.input.startDate) ?? temporalValue(step.input.arriveBy);
    return value ? [value] : [];
  });
  const ends = steps.flatMap((step) => {
    const value = temporalValue(step.input.endDate) ?? temporalValue(step.input.arriveBy) ?? temporalValue(step.input.startDate);
    return value ? [value] : [];
  });
  if (!starts.length || !ends.length) return undefined;
  const first = starts.reduce((left, right) => Date.parse(left) <= Date.parse(right) ? left : right);
  const last = ends.reduce((left, right) => Date.parse(left) >= Date.parse(right) ? left : right);
  return dateRange(first, last);
};

const isHome = (value?: string) => Boolean(value && /(?:^|\b)(?:home)(?:$|\b)|家|住所|住处/iu.test(value));

const explicitDeadline = (task: Task, anchor: string | undefined) => {
  const source = [task.request, task.goal?.summary, task.goal?.desiredOutcome].filter(Boolean).join('。');
  const match = source.match(/(?:晚上|晚间|夜里)?\s*(\d{1,2})(?:\s*[:：点时]\s*(\d{1,2})?\s*分?)?\s*(?:之前|以前|前)/u);
  if (!match || !anchor) return undefined;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const prefix = source.slice(Math.max(0, (match.index ?? 0) - 4), (match.index ?? 0) + match[0].length);
  if (/晚上|晚间|夜里/u.test(prefix) && hour < 12) hour += 12;
  if (hour > 23 || minute > 59) return undefined;
  const anchorMatch = anchor.match(/^(\d{4}-\d{2}-\d{2})T.*?([+-]\d{2}:\d{2}|Z)$/u);
  if (!anchorMatch) return undefined;
  const deadline = `${anchorMatch[1]}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00${anchorMatch[2]}`;
  if (Number.isNaN(Date.parse(deadline))) return undefined;
  return { deadline, destination: /回家|到家|回到家/u.test(source) ? '家' : undefined };
};

const hasChinese = (value?: string) => Boolean(value && /[\u3400-\u9fff]/u.test(value));

const localizePhrase = (value: string, chinese: boolean) => {
  if (!chinese || hasChinese(value)) return value;
  const lower = value.toLocaleLowerCase();
  if (lower.includes('climbing shoes')) return '携带攀岩鞋';
  if (lower.includes('portfolio')) return '携带作品集';
  return value;
};

const presentActionTitle = (value: string, location: string | undefined, chinese: boolean, index: number) => {
  if (!chinese || hasChinese(value)) return value;
  const lower = value.toLocaleLowerCase();
  if (lower.includes('shop') || lower.includes('buy clothes')) return location ? `在 ${location} 买衣服` : '买衣服';
  if (lower.includes('climb')) return location ? `在 ${location} 攀岩` : '去攀岩';
  if (lower.includes('dinner') || lower.includes('restaurant')) return location ? `在 ${location} 聚餐` : '安排聚餐';
  if (lower.includes('interview')) return location ? `前往 ${location} 面试` : '参加面试';
  if (isHome(location)) return '回家';
  return location ? `前往 ${location}` : `计划步骤 ${index + 1}`;
};

const presentDecisionPrompt = (prompt: string, chinese: boolean) => {
  if (!chinese || hasChinese(prompt)) return prompt;
  const lower = prompt.toLocaleLowerCase();
  if (lower.includes('departure') && (lower.includes('location') || lower.includes('address'))) return '你想从哪里出发？';
  return prompt;
};

const executionStepTitle = (step: Task['steps'][number]) => {
  if (step.capabilityId === 'files.document.read') return '读取你选择的文件';
  if (step.capabilityId === 'files.document.create') return `创建文件「${text(step.input.fileName) ?? '新文件'}」`;
  if (step.capabilityId === 'taskspace.notes.create') return `创建笔记「${text(step.input.title) ?? '新笔记'}」`;
  if (step.capabilityId === 'taskspace.messaging.createDraft') return `创建${text(step.input.recipient) ? `给 ${text(step.input.recipient)} 的` : ''}消息草稿`;
  return step.title;
};

const summarizeInput = (input: Record<string, unknown>) => {
  const preferred = ['title', 'subject', 'recipient', 'value', 'startsAt', 'location', 'address', 'origin', 'preparation'];
  const values = preferred.flatMap((key) => {
    const value = input[key];
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
    return typeof value === 'string' ? [value] : [];
  });
  return values.slice(0, 3).join(' · ');
};

export function createTaskPresentationModel(task: Task): TaskPresentationModel {
  const planning = task.phase === 'planning' || task.phase === 'draft';
  const decision = task.phase === 'needs_decision' ? task.pendingDecision : undefined;
  const chinese = hasChinese(task.request);
  const rows: TaskPresentationRow[] = task.steps.map((step, index) => {
    const capability = capabilityCopy[step.capabilityId] ?? { label: step.capabilityId, glyph: String(index + 1) };
    const receipt = step.receipt?.summary;
    return {
      id: step.id,
      annotation: capability.label,
      primary: step.title,
      secondary: receipt ?? (summarizeInput(step.input) || undefined),
      glyph: capability.glyph,
    };
  });

  if (!rows.length && task.facts.title) {
    rows.push({
      id: 'task-summary', annotation: '目标', primary: task.facts.title,
      secondary: [text(task.facts.startsAt), text(task.facts.address)].filter(Boolean).join(' · ') || undefined,
      glyph: 'AI',
    });
  }

  // The planner's TaskStep array is the canonical order for a revision. Do not
  // re-sort it in presentation: doing so can keep an old temporal order after
  // a user explicitly asks Gemini to reorder the plan.
  const calendarSteps = task.steps.filter((step) => step.capabilityId === 'system.calendar.createEvent');
  const routeSteps = task.steps.filter((step) => step.capabilityId === 'maps.route.estimate');
  const reminderSteps = task.steps.filter((step) => step.capabilityId === 'system.reminder.schedule');
  const sequenceSource = task.steps.filter((step) => step.capabilityId !== 'system.reminder.schedule');
  const sequence = sequenceSource.map((step, index) => {
    const location = text(step.input.location) ?? text(step.input.destination) ?? text(step.input.address);
    const matchingReminders = reminderSteps.filter((reminder) => reminder.dependsOn.includes(step.id)
      || text(reminder.input.eventStartsAt) === text(step.input.startDate));
    const preparation = matchingReminders.flatMap((reminder) => Array.isArray(reminder.input.preparation)
      ? reminder.input.preparation.filter((item): item is string => typeof item === 'string').map((item) => localizePhrase(item, chinese)) : []);
    const rawTitle = text(step.input.title) ?? step.title;
    const fileName = text(step.input.fileName);
    const preferenceValue = text(step.input.value);
    const actionTitle = step.capabilityId === 'files.document.read'
      ? '选择并读取文件'
      : step.capabilityId === 'files.document.create'
        ? `创建文件「${fileName ?? '新文件'}」`
        : step.capabilityId === 'taskspace.notes.create'
          ? `创建笔记「${text(step.input.title) ?? '新笔记'}」`
        : step.capabilityId === 'taskspace.messaging.createDraft'
          ? `创建${text(step.input.recipient) ? `给 ${text(step.input.recipient)} 的` : ''}消息草稿`
        : step.capabilityId === 'taskspace.preferences.set'
          ? `保存偏好：${preferenceValue ?? '待确认内容'}`
        : step.capabilityId === 'taskspace.messaging.approvalDemo'
          ? `批准后发送给 ${text(step.input.recipient) ?? '指定对象'}（安全演示，不会真实发送）`
        : step.capabilityId === 'maps.route.estimate'
          ? isHome(location) ? '回家' : location ? `前往 ${location}` : '前往目的地'
        : presentActionTitle(rawTitle, location, chinese, index);
    const detail = step.capabilityId.startsWith('files.')
      ? [text(step.input.mimeType), step.capabilityId === 'files.document.read' ? '执行时由你选择真实文件' : undefined].filter(Boolean).join(' · ') || undefined
      : step.capabilityId === 'taskspace.preferences.set'
        ? [text(step.input.key), text(step.input.category)].filter(Boolean).join(' · ') || '仅保存用户明确确认的偏好'
      : step.capabilityId === 'taskspace.messaging.approvalDemo'
        ? '真实后果：需要执行前再次批准；本次安全演示不会对外发送'
      : [location, preparation.length ? `准备：${preparation.join('、')}` : undefined].filter(Boolean).join(' · ') || undefined;
    return {
      id: step.id,
      annotation: step.status === 'completed' ? '已完成' : dateRange(step.input.startDate ?? step.input.arriveBy, step.input.endDate) ?? `第 ${index + 1} 步`,
      primary: actionTitle,
      secondary: step.status === 'completed'
        ? ['结果已保留，确认后不会重复执行', detail].filter(Boolean).join(' · ')
        : detail,
      glyph: String(index + 1),
      executionDetails: [
        step.capabilityId === 'system.calendar.createEvent' ? '日历写入' : capabilityCopy[step.capabilityId]?.label,
        ...matchingReminders.map(() => '提醒设置'),
      ].filter((item): item is string => Boolean(item)),
    };
  });
  const schedulingPlan = calendarSteps.length > 0 || routeSteps.length > 0 || reminderSteps.length > 0;
  const locations = schedulingPlan ? sequenceSource.reduce<string[]>((result, step) => {
    const location = text(step.input.location) ?? text(step.input.destination) ?? text(step.input.address);
    if (location && result[result.length - 1] !== location) result.push(location);
    return result;
  }, []) : [];
  const preparation = reminderSteps.flatMap((step) => Array.isArray(step.input.preparation)
    ? step.input.preparation.filter((item): item is string => typeof item === 'string').map((item) => localizePhrase(item, chinese)) : []);
  const temporalAnchor = sequenceSource.flatMap((step) => [
    temporalValue(step.input.endDate), temporalValue(step.input.arriveBy), temporalValue(step.input.startDate),
  ]).filter((value): value is string => Boolean(value)).reduce<string | undefined>((latest, value) => !latest || Date.parse(value) > Date.parse(latest) ? value : latest, undefined);
  const userDeadline = explicitDeadline(task, temporalAnchor);
  const deadlineRoute = userDeadline?.destination
    ? [...routeSteps].reverse().find((step) => isHome(text(step.input.destination)) && temporalValue(step.input.arriveBy))
    : undefined;
  const constrainedRoute = deadlineRoute ?? [...routeSteps].reverse().find((step) => temporalValue(step.input.arriveBy));
  const arrivalTarget = userDeadline
    ? `${dateTime(deadlineRoute?.input.arriveBy ?? userDeadline.deadline)} ${userDeadline.destination ? '回到家' : '前完成'}`
    : constrainedRoute
      ? `${dateTime(constrainedRoute.input.arriveBy)} 到达 ${text(constrainedRoute.input.destination) ?? '目的地'}`
      : undefined;
  const preferences = explicitPreferenceSummary(task.context);
  const runAt = nextTaskRunAt(task);
  const recurrence = taskRecurrence(task);
  const recurrenceLabel = recurrence
    ? recurrence.frequency === 'minute' ? `每 ${recurrence.interval} 分钟`
      : recurrence.frequency === 'daily' ? `每 ${recurrence.interval} 天`
        : `每 ${recurrence.interval} 周`
    : undefined;
  const overview = sequence.length && (schedulingPlan || preferences || runAt) ? {
    time: schedulingPlan ? timelineRange(sequenceSource) : undefined,
    places: locations.length ? locations.join(' → ') : undefined,
    arrivalTarget: arrivalTarget ? `${userDeadline ? '最晚' : ''}${arrivalTarget}` : undefined,
    constraints: schedulingPlan && preparation.length ? preparation.join('、') : schedulingPlan && !chinese ? task.goal?.desiredOutcome : undefined,
    preferences,
    trigger: runAt ? `${recurrenceLabel ? `${recurrenceLabel} · 首次 ` : ''}${dateTime(runAt) ?? runAt}${recurrenceLabel ? '' : ' 后继续'}` : undefined,
  } : undefined;

  return {
    mode: planning ? 'planning' : decision ? 'decision' : 'review',
    islandTitle: chinese && !hasChinese(task.facts.title) ? '你的计划' : task.facts.title || task.goal?.summary || 'AI 任务',
    islandState: planning ? '正在规划' : decision ? '需要决定' : '等待确认',
    eyebrow: planning ? 'AI 正在更新这项任务' : decision ? '任务已暂停 · 等待你的决定' : `计划 revision ${task.revision}`,
    headline: planning ? '正在根据你的要求更新计划。' : decision ? presentDecisionPrompt(decision.prompt, chinese) : '安排整理好了。点选内容，或直接告诉我怎么改。',
    supportingText: planning
      ? '当前任务、上下文与已保存状态保持不变。'
      : decision
      ? '回答后，Gemini 会基于同一个任务重新规划。'
      : task.steps.some((step) => step.status === 'completed')
        ? '已完成结果会保留；确认后只执行尚未完成的操作。'
      : chinese ? (calendarSteps.length || routeSteps.length ? '确认时间、地点和顺序后，AI 才会执行相关操作。' : '确认结果与操作后，AI 才会开始执行。') : task.goal?.desiredOutcome,
    revisionLabel: `Revision ${task.revision}`,
    decisionOptions: decision?.options ?? [],
    overview,
    sequence,
    rows,
  };
}

const statusCopy: Record<Task['steps'][number]['status'], string> = {
  waiting: '等待', running: '正在执行', needs_decision: '需要决定', completed: '已完成', failed: '未完成', stopped: '已停止',
};

export function createExecutionPresentationModel(task: Task): ExecutionPresentationModel {
  const recurrence = taskRecurrence(task);
  const recurrenceLabel = recurrence
    ? recurrence.frequency === 'minute' ? `每 ${recurrence.interval} 分钟`
      : recurrence.frequency === 'daily' ? `每 ${recurrence.interval} 天`
        : `每 ${recurrence.interval} 周`
    : undefined;
  const pendingApprovalStep = task.phase === 'executing' ? task.steps.find((step) =>
    step.status === 'waiting' && step.policy?.confirmation === 'always' && !step.approval
    && step.dependsOn.every((id) => task.steps.find((candidate) => candidate.id === id)?.status === 'completed')) : undefined;
  const mode: ExecutionPresentationModel['mode'] = task.phase === 'waiting'
    ? 'waiting'
    : pendingApprovalStep
    ? 'approval'
    : task.phase === 'executing' ? 'execution'
    : task.phase === 'completed'
      ? 'receipt'
      : task.phase === 'partially_completed'
        ? 'partial_failure'
        : task.phase === 'failed'
          ? 'failed'
          : 'stopped';
  const completedCount = task.steps.filter((step) => step.status === 'completed').length;
  const copy = {
    waiting: ['任务正在等待条件。', '条件满足后会从同一个已确认任务继续，并保存执行回执。'],
    execution: ['正在执行已确认的安排。', '每一步完成后都会保存可恢复的回执。'],
    approval: ['执行前需要你单独确认。', '这项操作会产生外部影响；确认只对当前内容和当前版本有效。'],
    receipt: ['任务已经完成。', '所有执行结果和回执都保存在这项任务中。'],
    partial_failure: ['部分操作没有完成。', '已经完成的操作不会重复执行；你可以针对失败步骤告诉 AI 如何调整。'],
    failed: ['这项任务没有完成。', '系统已停止继续派发操作。你可以调整计划后重新确认。'],
    stopped: ['任务已停止。', '已经完成的操作和回执仍然保留，剩余步骤没有继续执行。'],
  }[mode];
  return {
    mode,
    islandTitle: task.facts.title || task.goal?.summary || 'AI 任务',
    islandState: mode === 'waiting' ? '等待中' : mode === 'approval' ? '需要批准' : mode === 'execution' ? '执行中' : mode === 'receipt' ? '已完成' : mode === 'stopped' ? '已停止' : '需要处理',
    eyebrow: mode === 'waiting' ? `等待至 ${dateTime(nextTaskRunAt(task)) ?? '条件满足'}` : mode === 'approval' ? '高影响操作 · 等待逐次批准' : mode === 'execution' ? `正在写入 · ${completedCount}/${task.steps.length}` : mode === 'receipt' ? '执行回执' : mode === 'stopped' ? '任务已停止' : '部分完成 · 需要处理',
    headline: copy[0], supportingText: copy[1], completedCount, totalCount: task.steps.length,
    recurrence: recurrence ? { label: recurrenceLabel!, completedRuns: task.occurrences?.length ?? 0, nextRunAt: task.phase === 'stopped' ? undefined : nextTaskRunAt(task) } : undefined,
    pastOccurrences: (task.occurrences ?? []).map((occurrence) => ({
      sequence: occurrence.sequence, completedAt: occurrence.completedAt,
      status: occurrence.status === 'failed' ? 'failed' as const : 'completed' as const,
      summaries: occurrence.receipts.length ? occurrence.receipts.map(({ receipt }) => receipt.summary)
        : occurrence.status === 'failed' ? ['本次运行失败，未产生回执'] : [],
    })).reverse(),
    pendingApproval: pendingApprovalStep ? {
      stepId: pendingApprovalStep.id,
      title: pendingApprovalStep.title,
      consequence: `将执行：${pendingApprovalStep.title}`,
      detail: [typeof pendingApprovalStep.input.recipient === 'string' ? `对象：${pendingApprovalStep.input.recipient}` : undefined,
        typeof pendingApprovalStep.input.body === 'string' ? `内容：${pendingApprovalStep.input.body}` : undefined].filter(Boolean).join('\n'),
    } : undefined,
    steps: task.steps.map((step, index) => {
      const capability = capabilityCopy[step.capabilityId] ?? { label: step.capabilityId, glyph: String(index + 1) };
      return {
        id: step.id, title: executionStepTitle(step), capability: capability.label, glyph: capability.glyph,
        status: step.status, statusLabel: statusCopy[step.status], receiptSummary: step.receipt?.summary,
        receiptAt: step.receipt?.completedAt, externalId: step.receipt?.externalId, result: executionResult(step),
      };
    }),
  };
}

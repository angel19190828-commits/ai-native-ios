import type { OrchestrationContextInput } from '../api/orchestratorClient';
import type { TaskContext } from '../domain/orchestration';
import type { ExplicitPreference } from '../storage/contentArtifactStore';

export const PERSONAL_CONTEXT_SOURCE = 'Taskspace Personal Context';
const MAX_PREFERENCES = 12;
const MAX_CONTEXT_CHARS = 4000;

export function buildExplicitPreferenceContext(preferences: ExplicitPreference[]): OrchestrationContextInput | undefined {
  const selected = preferences.slice(-MAX_PREFERENCES).map(({ key, value, category }) => ({
    key: key.slice(0, 100), value: value.slice(0, 500), ...(category ? { category: category.slice(0, 100) } : {}),
  }));
  while (selected.length) {
    const content = JSON.stringify({ type: 'explicit-preferences', preferences: selected });
    if (content.length <= MAX_CONTEXT_CHARS) return {
      id: 'explicit-preferences', kind: 'app-content', sourceApp: PERSONAL_CONTEXT_SOURCE,
      title: '用户明确确认的偏好；仅在与当前目标相关时参考', content,
    };
    selected.shift();
  }
  return undefined;
}

export function explicitPreferenceSummary(context: TaskContext[] | undefined) {
  const item = context?.find((candidate) => candidate.sourceApp === PERSONAL_CONTEXT_SOURCE);
  const content = item?.data.content;
  if (typeof content !== 'string') return undefined;
  try {
    const parsed = JSON.parse(content) as { type?: unknown; preferences?: unknown };
    if (parsed.type !== 'explicit-preferences' || !Array.isArray(parsed.preferences)) return undefined;
    const values = parsed.preferences.flatMap((preference) => {
      if (!preference || typeof preference !== 'object') return [];
      const { key, value } = preference as Record<string, unknown>;
      return typeof key === 'string' && typeof value === 'string' ? [`${key}：${value}`] : [];
    });
    return values.length ? values.join('、') : undefined;
  } catch {
    return undefined;
  }
}

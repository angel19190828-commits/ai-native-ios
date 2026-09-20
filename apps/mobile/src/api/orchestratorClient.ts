import type { PlanDecision, PlanStepDefinition, TaskTrigger } from '../domain/orchestration';
import { AiApiError } from './aiClient';

export interface OrchestrationContextInput {
  id?: string;
  kind: 'direct-input' | 'email' | 'message' | 'webpage' | 'app-content' | 'shared-content';
  sourceApp?: string;
  title?: string;
  content: string;
}

export interface OrchestrationProposal {
  summary: string;
  desiredOutcome: string;
  triggers: TaskTrigger[];
  decisions: PlanDecision[];
  steps: PlanStepDefinition[];
}

export interface OrchestrateInput {
  goal: string;
  context: OrchestrationContextInput[];
  locale: string;
  timeZone: string;
  now?: string;
  signal?: AbortSignal;
}

export interface OrchestrateResponse {
  proposal: OrchestrationProposal;
  requestId: string;
  model: string;
  catalogVersion: string;
}

interface ClientOptions {
  baseUrl: string;
  getAccessToken?: () => Promise<string | undefined>;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

const risks = new Set(['read', 'write', 'external-action', 'destructive']);
const triggerKinds = new Set(['manual', 'time', 'event', 'condition']);
const executors = new Set(['device', 'server']);
const confirmations = new Set(['never', 'once_per_plan', 'always']);

const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const isOrchestrationProposal = (value: unknown): value is OrchestrationProposal => {
  if (!object(value) || typeof value.summary !== 'string' || typeof value.desiredOutcome !== 'string') return false;
  if (!Array.isArray(value.triggers) || !value.triggers.every((trigger) => object(trigger)
    && typeof trigger.id === 'string' && triggerKinds.has(String(trigger.kind)) && object(trigger.configuration))) return false;
  if (!Array.isArray(value.decisions) || !value.decisions.every((decision) => object(decision)
    && typeof decision.id === 'string' && typeof decision.prompt === 'string' && Array.isArray(decision.options)
    && decision.options.every((option) => typeof option === 'string') && typeof decision.required === 'boolean')) return false;
  if (!Array.isArray(value.steps) || !value.steps.every((step) => object(step)
    && typeof step.id === 'string' && typeof step.title === 'string' && typeof step.capabilityId === 'string'
    && risks.has(String(step.risk)) && object(step.policy)
    && executors.has(String(step.policy.executor)) && confirmations.has(String(step.policy.confirmation))
    && Array.isArray(step.policy.scopes) && step.policy.scopes.every((scope) => typeof scope === 'string')
    && Array.isArray(step.dependsOn)
    && step.dependsOn.every((dependency) => typeof dependency === 'string') && object(step.input))) return false;
  return value.steps.length > 0 || value.decisions.some((decision) => decision.required && decision.resolvedValue === undefined);
};

export class OrchestratorApiClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: ClientOptions) {
    this.fetchImpl = options.fetch ?? fetch;
  }

  async propose(input: OrchestrateInput): Promise<OrchestrateResponse> {
    if (!input.goal.trim()) throw new AiApiError('invalid_goal');
    const token = await this.options.getAccessToken?.();
    const controller = new AbortController();
    const abort = () => controller.abort();
    input.signal?.addEventListener('abort', abort, { once: true });
    if (input.signal?.aborted) controller.abort();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 18000);
    try {
      const response = await this.fetchImpl(`${this.options.baseUrl.replace(/\/$/, '')}/api/orchestrate`, {
        method: 'POST', signal: controller.signal,
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          goal: input.goal, context: input.context, locale: input.locale, timeZone: input.timeZone,
          now: input.now ?? new Date().toISOString(),
        }),
      });
      const payload = await response.json() as Partial<OrchestrateResponse> & { error?: { code?: string; requestId?: string } };
      if (!response.ok) throw new AiApiError(payload.error?.code ?? 'request_failed', response.status, payload.error?.requestId);
      if (!isOrchestrationProposal(payload.proposal) || typeof payload.requestId !== 'string'
        || typeof payload.model !== 'string' || typeof payload.catalogVersion !== 'string') {
        throw new AiApiError('invalid_response', response.status);
      }
      return payload as OrchestrateResponse;
    } catch (error) {
      if (error instanceof AiApiError) throw error;
      if (controller.signal.aborted) throw new AiApiError(input.signal?.aborted ? 'cancelled' : 'timeout');
      throw new AiApiError('network_unavailable');
    } finally {
      clearTimeout(timer);
      input.signal?.removeEventListener('abort', abort);
    }
  }
}

export type PlannedKind = 'appointment' | 'meeting' | 'deadline';
export type MissingPlanField = 'startsAt' | 'endsAt' | 'location' | 'origin';

export interface ProposedPlan {
  title: string;
  kind: PlannedKind;
  startsAt: string;
  endsAt: string;
  location: string;
  arrivalMinutesEarly: number;
  preparation: string[];
  missingFields: MissingPlanField[];
  sourceSummary: string;
}

interface PlanResponse {
  plan: ProposedPlan;
  requestId: string;
  model: string;
}

export class AiApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status?: number,
    public readonly requestId?: string,
  ) {
    super(`AI API request failed: ${code}`);
    this.name = 'AiApiError';
  }
}

export interface PlanInvitationInput {
  sourceText: string;
  locale: string;
  timeZone: string;
  now?: string;
  signal?: AbortSignal;
}

interface ClientOptions {
  baseUrl: string;
  getAccessToken?: () => Promise<string | undefined>;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

const isPlan = (value: unknown): value is ProposedPlan => {
  if (!value || typeof value !== 'object') return false;
  const plan = value as Partial<ProposedPlan>;
  return typeof plan.title === 'string'
    && ['appointment', 'meeting', 'deadline'].includes(plan.kind ?? '')
    && typeof plan.startsAt === 'string'
    && typeof plan.endsAt === 'string'
    && typeof plan.location === 'string'
    && typeof plan.arrivalMinutesEarly === 'number'
    && Array.isArray(plan.preparation)
    && plan.preparation.every((item) => typeof item === 'string')
    && Array.isArray(plan.missingFields)
    && typeof plan.sourceSummary === 'string';
};

export class AiApiClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: ClientOptions) {
    this.fetchImpl = options.fetch ?? fetch;
  }

  async planInvitation(input: PlanInvitationInput): Promise<PlanResponse> {
    if (!input.sourceText.trim()) throw new AiApiError('invalid_source');
    const token = await this.options.getAccessToken?.();
    const controller = new AbortController();
    const abort = () => controller.abort();
    input.signal?.addEventListener('abort', abort, { once: true });
    if (input.signal?.aborted) controller.abort();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 15000);

    try {
      if (controller.signal.aborted) throw new AiApiError('cancelled');
      const response = await this.fetchImpl(`${this.options.baseUrl.replace(/\/$/, '')}/api/plan`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        signal: controller.signal,
        body: JSON.stringify({
          sourceText: input.sourceText,
          locale: input.locale,
          timeZone: input.timeZone,
          now: input.now ?? new Date().toISOString(),
        }),
      });
      const payload = await response.json() as Partial<PlanResponse> & {
        error?: { code?: string; requestId?: string };
      };
      if (!response.ok) {
        throw new AiApiError(payload.error?.code ?? 'request_failed', response.status, payload.error?.requestId);
      }
      if (!isPlan(payload.plan) || typeof payload.requestId !== 'string' || typeof payload.model !== 'string') {
        throw new AiApiError('invalid_response', response.status);
      }
      return payload as PlanResponse;
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

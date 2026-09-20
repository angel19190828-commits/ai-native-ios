import { AiApiError } from './aiClient';

export interface RouteEstimate {
  departureAt: string;
  arrivalAt: string;
  durationSeconds: number;
  distanceMeters: number;
  transportMode: 'transit';
  encodedPolyline?: string;
}

export class RouteApiClient {
  constructor(private readonly options: { baseUrl: string; getAccessToken?: () => Promise<string | undefined>; fetch?: typeof fetch }) {}

  async estimate(input: { origin: string; destination: string; arriveBy: string; locale: string; signal: AbortSignal }) {
    const token = await this.options.getAccessToken?.();
    const response = await (this.options.fetch ?? fetch)(`${this.options.baseUrl.replace(/\/$/, '')}/api/route`, {
      method: 'POST',
      signal: input.signal,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(input),
    });
    const payload = await response.json() as { route?: RouteEstimate; requestId?: string; error?: { code?: string; requestId?: string } };
    if (!response.ok) throw new AiApiError(payload.error?.code ?? 'route_failed', response.status, payload.error?.requestId);
    const route = payload.route;
    if (!route || !Number.isFinite(route.durationSeconds) || !Number.isFinite(route.distanceMeters) || Number.isNaN(Date.parse(route.departureAt)) || Number.isNaN(Date.parse(route.arrivalAt))) {
      throw new AiApiError('route_invalid_response', response.status, payload.requestId);
    }
    return route;
  }
}


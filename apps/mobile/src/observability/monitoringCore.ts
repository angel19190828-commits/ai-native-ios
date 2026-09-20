export type MonitoringBreadcrumb = {
  timestamp?: number;
  category?: string;
  type?: string;
  level?: string;
  message?: string;
  data?: Record<string, unknown>;
};

export type MonitoringEvent = {
  user?: unknown;
  request?: unknown;
  contexts?: unknown;
  extra?: unknown;
  message?: string;
  transaction?: string;
  tags?: Record<string, string | number | boolean>;
  breadcrumbs?: MonitoringBreadcrumb[];
  exception?: {
    values?: Array<Record<string, unknown> & { value?: string }>;
  };
};

const SAFE_TAGS = new Set(['error_code', 'phase', 'capability', 'operation', 'release_channel']);
const STATIC_NAME = /^[a-z0-9_.:-]{1,80}$/i;

export function parseTraceSampleRate(value: string | undefined, fallback = 0.1): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
}

export function sanitizeBreadcrumb<T>(breadcrumb: T): T {
  const source = breadcrumb as MonitoringBreadcrumb;
  return {
    timestamp: source.timestamp,
    category: safeStaticName(source.category),
    type: safeStaticName(source.type),
    level: safeStaticName(source.level),
  } as T;
}

export function sanitizeErrorEvent<T>(event: T): T {
  const sanitized = stripPrivateFields(event as MonitoringEvent);
  if (sanitized.message) sanitized.message = '[redacted]';
  if (sanitized.exception?.values) {
    sanitized.exception = {
      ...sanitized.exception,
      values: sanitized.exception.values.map((value) => ({ ...value, value: '[redacted]' })),
    };
  }
  return sanitized as T;
}

export function sanitizeTransactionEvent<T>(event: T): T {
  const source = event as MonitoringEvent;
  const sanitized = stripPrivateFields(source);
  sanitized.transaction = safeStaticName(source.transaction) ?? 'taskspace.operation';
  return sanitized as T;
}

export function safeOperationalTags(tags: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(tags)
      .filter(([key, value]) => SAFE_TAGS.has(key) && safeStaticName(value))
      .map(([key, value]) => [key, value as string]),
  );
}

function stripPrivateFields<T extends MonitoringEvent>(event: T): T {
  const sanitized = { ...event };
  delete sanitized.user;
  delete sanitized.request;
  delete sanitized.contexts;
  delete sanitized.extra;
  sanitized.tags = Object.fromEntries(
    Object.entries(event.tags ?? {}).filter(([key, value]) => SAFE_TAGS.has(key) && safeStaticName(String(value))),
  );
  sanitized.breadcrumbs = event.breadcrumbs?.map(sanitizeBreadcrumb);
  return sanitized;
}

function safeStaticName(value: string | undefined): string | undefined {
  return value && STATIC_NAME.test(value) ? value : undefined;
}

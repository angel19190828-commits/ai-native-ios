import * as Sentry from '@sentry/react-native';

import {
  parseTraceSampleRate,
  safeOperationalTags,
  sanitizeBreadcrumb,
  sanitizeErrorEvent,
  sanitizeTransactionEvent,
} from './monitoringCore';

let monitoringEnabled = false;

export function initMonitoring(): boolean {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  monitoringEnabled = Boolean(dsn && /^https:\/\/[^\s@]+@[^\s/]+\/\d+$/.test(dsn));

  Sentry.init({
    dsn,
    enabled: monitoringEnabled,
    sendDefaultPii: false,
    enableAutoSessionTracking: true,
    enableAutoPerformanceTracing: monitoringEnabled,
    tracesSampleRate: parseTraceSampleRate(process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE),
    attachScreenshot: false,
    attachViewHierarchy: false,
    beforeBreadcrumb: (breadcrumb) => sanitizeBreadcrumb(breadcrumb),
    beforeSend: (event) => sanitizeErrorEvent(event),
    beforeSendTransaction: (event) => sanitizeTransactionEvent(event),
  });

  return monitoringEnabled;
}

export function captureOperationalError(
  errorCode: string,
  tags: { phase?: string; capability?: string; operation?: string } = {},
): void {
  if (!monitoringEnabled) return;
  Sentry.withScope((scope) => {
    scope.setTags(safeOperationalTags({ error_code: errorCode, ...tags }));
    Sentry.captureException(new Error(`taskspace:${errorCode}`));
  });
}

export function traceOperation<T>(name: string, operation: string, callback: () => T): T {
  if (!monitoringEnabled) return callback();
  return Sentry.startSpan({ name, op: operation }, callback);
}

export const withMonitoring = Sentry.wrap;

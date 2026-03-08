import * as Sentry from '@sentry/react';

const UUID_COMPAT_CATEGORY = 'browser_compat_uuid';
const reportedIssues = new Set<string>();

const getAppVersion = (): string => {
  if (typeof __APP_VERSION__ !== 'undefined') {
    return __APP_VERSION__;
  }
  return 'unknown';
};

const getUserAgent = (): string => {
  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    return navigator.userAgent;
  }
  return 'unknown';
};

const getStackSummary = (error: unknown, fallbackReason: string): string => {
  if (error instanceof Error && error.stack) {
    return error.stack.split('\n').slice(0, 4).join('\n');
  }
  return new Error(fallbackReason).stack?.split('\n').slice(0, 4).join('\n') || 'no-stack';
};

const reportUuidCompatIssue = (functionPoint: string, reason: string, error?: unknown) => {
  const dedupeKey = `${functionPoint}:${reason}`;
  if (reportedIssues.has(dedupeKey)) return;
  reportedIssues.add(dedupeKey);

  const errorMessage = error instanceof Error ? error.message : reason;
  const stackSummary = getStackSummary(error, reason);
  const baseExtra = {
    functionPoint,
    ua: getUserAgent(),
    errorMessage,
    stackSummary,
    version: getAppVersion(),
    reason,
  };

  Sentry.captureMessage('UUID compatibility fallback', {
    level: 'warning',
    tags: {
      error_category: UUID_COMPAT_CATEGORY,
      function_point: functionPoint,
    },
    extra: baseExtra,
  });

  if (error instanceof Error) {
    Sentry.captureException(error, {
      tags: {
        error_category: UUID_COMPAT_CATEGORY,
        function_point: functionPoint,
      },
      extra: baseExtra,
    });
  }
};

const buildUuidByGetRandomValues = (functionPoint: string): string | null => {
  try {
    if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
      reportUuidCompatIssue(functionPoint, 'crypto.getRandomValues unavailable');
      return null;
    }

    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    // RFC 4122 v4 format bits.
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  } catch (error) {
    reportUuidCompatIssue(functionPoint, 'crypto.getRandomValues failed', error);
    return null;
  }
};

const buildDateMathFallback = (): string => {
  const timePart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 12);
  return `fallback-${timePart}-${randomPart}`;
};

export const generateClientId = (functionPoint = 'unknown'): string => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    reportUuidCompatIssue(functionPoint, 'crypto.randomUUID unavailable');
  } catch (error) {
    reportUuidCompatIssue(functionPoint, 'crypto.randomUUID failed', error);
  }

  const uuidByRandomValues = buildUuidByGetRandomValues(functionPoint);
  if (uuidByRandomValues) {
    return uuidByRandomValues;
  }

  try {
    reportUuidCompatIssue(functionPoint, 'fallback to Date.now + Math.random');
    return buildDateMathFallback();
  } catch (error) {
    reportUuidCompatIssue(functionPoint, 'Date.now + Math.random fallback failed', error);
    return `${Date.now()}-${Math.random()}`;
  }
};


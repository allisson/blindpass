import { env } from '../../env.js';

const NON_PRODUCTION_MIN_AUTH_LIMIT = 1000;
const DEFAULT_WINDOW = '15 minutes';
const DEFAULT_HOOK = 'preHandler' as const;

export function resolveAuthRateLimitMax(
  nodeEnv: 'development' | 'production' | 'test',
  max: number,
): number {
  return nodeEnv === 'production' ? max : Math.max(max, NON_PRODUCTION_MIN_AUTH_LIMIT);
}

export function authRateLimit(max: number, timeWindow = DEFAULT_WINDOW) {
  return {
    max: resolveAuthRateLimitMax(env.NODE_ENV, max),
    timeWindow,
    hook: DEFAULT_HOOK,
  };
}

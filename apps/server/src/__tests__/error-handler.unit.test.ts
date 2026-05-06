import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { errorHandler } from '../error-handler.js';

function buildApp() {
  const app = Fastify({ logger: false });
  app.setErrorHandler(errorHandler);
  app.get('/boom', async () => {
    throw new Error('DB connection refused');
  });
  return app;
}

describe('global setErrorHandler', () => {
  it('returns 500 with { error: "internal_error" } when a route throws', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: 'internal_error' });
  });

  it('logs the error via request.log', async () => {
    const logs: string[] = [];
    const app = Fastify({
      logger: {
        level: 'error',
        stream: {
          write: (line: string) => {
            logs.push(line);
          },
        },
      },
    });
    app.setErrorHandler(errorHandler);
    app.get('/boom', async () => {
      throw new Error('DB connection refused');
    });

    await app.inject({ method: 'GET', url: '/boom' });

    const errorLog = logs
      .map((l) => JSON.parse(l) as Record<string, unknown>)
      .find((l) => l['msg'] === 'Unhandled error');
    expect(errorLog).toBeDefined();
    expect(errorLog?.['err']).toBeDefined();
  });
});

import fp from 'fastify-plugin';

export interface Clock {
  now(): number;
}

declare module 'fastify' {
  interface FastifyInstance {
    clock: Clock;
  }
}

export const clockPlugin = fp(
  async (app) => {
    app.decorate('clock', { now: () => Date.now() });
  },
  { name: 'clock' },
);

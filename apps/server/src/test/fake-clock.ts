import type { Clock } from '../plugins/clock.js';

export const fixedClock = (ms: number): Clock => ({ now: () => ms });

export function advanceableClock(start = 0): { clock: Clock; advance: (ms: number) => void } {
  let t = start;
  return {
    clock: { now: () => t },
    advance: (ms: number) => {
      t += ms;
    },
  };
}

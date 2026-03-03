/**
 * Clock abstraction — Phase 6 Step 1
 *
 * Allows PlayheadController to run without real rAF (swapped for mock in tests).
 */

export type ClockCallback = (timestamp: number) => void;

export type Clock = {
  requestFrame: (cb: ClockCallback) => number;
  cancelFrame: (id: number) => void;
  now: () => number; // ms, like performance.now()
};

export const browserClock: Clock = {
  requestFrame: (cb) => requestAnimationFrame(cb),
  cancelFrame: (id) => cancelAnimationFrame(id),
  now: () => performance.now(),
};

export const nodeClock: Clock = {
  requestFrame: (cb) => {
    const id = setTimeout(() => cb(Date.now()), 16);
    return id as unknown as number;
  },
  cancelFrame: (id) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
};

// ---------------------------------------------------------------------------
// Test clock
// ---------------------------------------------------------------------------

export function createTestClock(): {
  clock: Clock;
  tick: (ms: number) => void;
  getCallbacks: () => ClockCallback[];
} {
  const pending: Array< { id: number; cb: ClockCallback }> = [];
  let idCounter = 0;
  let currentTime = 0;

  const clock: Clock = {
    requestFrame: (cb) => {
      const id = ++idCounter;
      pending.push({ id, cb });
      return id;
    },
    cancelFrame: (id) => {
      const idx = pending.findIndex((p) => p.id === id);
      if (idx !== -1) pending.splice(idx, 1);
    },
    now: () => currentTime,
  };

  function tick(ms: number): void {
    currentTime += ms;
    const toRun = [...pending];
    pending.length = 0;
    toRun.forEach((p) => p.cb(currentTime));
  }

  function getCallbacks(): ClockCallback[] {
    return pending.map((p) => p.cb);
  }

  return { clock, tick, getCallbacks };
}

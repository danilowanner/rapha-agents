export type BackoffOptions = {
  initial: number;
  min?: number;
  max: number;
  factor?: number; // growth factor
};

export type BackoffController = {
  readonly current: number;
  /** Increase the backoff (typically after an idle/no-op cycle). */
  increase(): number;
  /** Reset to the initial/min value (typically after useful work). */
  reset(): number;
};

/**
 * Creates a simple multiplicative backoff controller with ceiling and floor.
 */
export function createBackoff(options: BackoffOptions): BackoffController {
  const { initial, max, min = initial, factor = 1.5 } = options;
  let current = initial;
  function clamp(v: number) {
    return Math.min(max, Math.max(min, v));
  }
  return {
    get current() {
      return current;
    },
    increase() {
      current = clamp(Math.ceil(current * factor));
      return current;
    },
    reset() {
      current = clamp(initial);
      return current;
    },
  };
}

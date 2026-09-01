/**
 * Rate-estimator constants.
 *
 * These are the tunable knobs of the fail-closed contract. Bench numbers in
 * `core.test.ts` are pinned to these values — changing them means re-benching
 * and re-reviewing with IV Clinical Safety.
 */

// Rolling mean window (last N inter-drop intervals). Larger = smoother but
// slower to react to a real rate change; smaller = jitters more.
export const ROLLING_N = 4;

// Number of consecutive agreeing intervals required to declare `live`.
// One interval → settling. N agreeing intervals → live.
export const SETTLING_INTERVALS = 3;

// Each interval must be within ±TOL of the running mean to count as agreeing.
// 25% tolerates realistic gravity-IV wobble without flapping on genuine drift.
export const AGREEMENT_TOLERANCE = 0.25;

// Defensive floor on inter-drop interval. Anything faster is treated as a
// double-count (TEST-4 also applies its own refractory; this is a safety net).
export const MIN_INTERVAL_MS = 100;

// Slowest inter-drop interval we still credit as a real rate. 20 s = 3 gtt/min,
// comfortably below the 5 gtt/min slow-drip target from the issue (12 s).
export const MAX_INTERVAL_MS = 20_000;

// Live-hold: after `live`, if no drop arrives, keep publishing the last value
// (with `age` set) up to max(HOLD_MS_MIN, HOLD_MEAN_MULT × mean). Past that
// we drop to `unknown` — a dash is safer than a stale number.
export const HOLD_MS_MIN = 15_000;
export const HOLD_MEAN_MULT = 2.5;

// Supported drop factors (gtt/mL) and the default (macro adult set).
// mL/hr = drops/min × 60 / factor. Wrong factor triples volume — never
// change the default silently once shipped.
export const DROP_FACTORS = [10, 15, 20, 60] as const;
export const DEFAULT_DROP_FACTOR = 20;

export type DropFactor = (typeof DROP_FACTORS)[number];

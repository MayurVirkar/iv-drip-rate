/**
 * Pure rate-estimator core. Framework-free so it can be unit-tested with
 * synthetic drop streams (see core.test.ts).
 *
 * Contract (fail-closed):
 *   - `unknown`: no measurement is trustworthy — camera down, no drops seen,
 *     baseline invalid, or the last live value is too stale. UI renders a dash.
 *   - `settling`: we have at least one interval but not yet N agreeing.
 *   - `live`: last N intervals all agree within tolerance AND the most recent
 *     drop is inside the live-hold window.
 *
 *   Never emit `dropsPerMin: 0` or `mLPerHr: 0` when there is no confident
 *   measurement — always null + state:'unknown'. A nurse reads 0 as
 *   "infusion stopped".
 */

import {
  AGREEMENT_TOLERANCE,
  HOLD_MEAN_MULT,
  HOLD_MS_MIN,
  MAX_INTERVAL_MS,
  MIN_INTERVAL_MS,
  ROLLING_N,
  SETTLING_INTERVALS,
} from './constants';

export type EstimatorPhase = 'unknown' | 'settling' | 'live';

export interface EstimatorState {
  intervals: number[];
  lastDropAt: number | null;
  everLive: boolean;
  lastLiveMeanMs: number | null;
}

export interface Snapshot {
  dropsPerMin: number | null;
  mLPerHr: number | null;
  state: EstimatorPhase;
  age?: number;
}

export interface SnapshotInput {
  factor: number;
  cameraActive: boolean;
  baselineValid?: boolean;
}

export function createState(): EstimatorState {
  return {
    intervals: [],
    lastDropAt: null,
    everLive: false,
    lastLiveMeanMs: null,
  };
}

export function onDrop(state: EstimatorState, t: number): EstimatorState {
  const { lastDropAt } = state;
  if (lastDropAt === null) {
    return { ...state, lastDropAt: t };
  }
  const interval = t - lastDropAt;
  if (interval < MIN_INTERVAL_MS) {
    // Double-count guard — TEST-4 has its own refractory, this is defense in depth.
    return state;
  }
  if (interval > MAX_INTERVAL_MS) {
    // Rate too slow to credit — restart interval accumulator but remember `t`.
    return {
      ...state,
      intervals: [],
      lastDropAt: t,
      everLive: false,
      lastLiveMeanMs: null,
    };
  }
  const intervals = [...state.intervals, interval].slice(-ROLLING_N);
  return { ...state, intervals, lastDropAt: t };
}

function mean(xs: number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

function isSettled(intervals: number[]): { settled: boolean; meanMs: number } {
  const meanMs = mean(intervals);
  const lo = meanMs * (1 - AGREEMENT_TOLERANCE);
  const hi = meanMs * (1 + AGREEMENT_TOLERANCE);
  const settled =
    intervals.length >= SETTLING_INTERVALS &&
    intervals.every((iv) => iv >= lo && iv <= hi);
  return { settled, meanMs };
}

function holdCutoffMs(meanMs: number): number {
  return Math.max(HOLD_MS_MIN, HOLD_MEAN_MULT * meanMs);
}

function toMlPerHr(dropsPerMin: number, factor: number): number {
  return (dropsPerMin * 60) / factor;
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

function liveSnapshot(meanMs: number, age: number, factor: number): Snapshot {
  const dropsPerMin = 60_000 / meanMs;
  return {
    dropsPerMin: round1(dropsPerMin),
    mLPerHr: round1(toMlPerHr(dropsPerMin, factor)),
    state: 'live',
    age,
  };
}

const UNKNOWN: Snapshot = { dropsPerMin: null, mLPerHr: null, state: 'unknown' };

export function snapshot(
  state: EstimatorState,
  now: number,
  input: SnapshotInput,
): Snapshot {
  if (!input.cameraActive) return UNKNOWN;
  if (input.baselineValid === false) return UNKNOWN;
  if (state.lastDropAt === null) return UNKNOWN;

  const age = now - state.lastDropAt;

  if (state.intervals.length === 0) {
    // First drop only, or a MAX_INTERVAL_MS blowout reset the accumulator.
    return UNKNOWN;
  }

  const { settled, meanMs } = isSettled(state.intervals);

  if (settled) {
    // Even a well-settled stream must have seen a drop recently to stay live.
    if (age > holdCutoffMs(meanMs)) return UNKNOWN;
    return liveSnapshot(meanMs, age, input.factor);
  }

  // Not settled this instant. If we were ever live and are still inside the
  // last-known hold window, keep the last live value with `age` set — this is
  // the "hold" that prevents flapping when a single interval is off.
  if (state.everLive && state.lastLiveMeanMs !== null) {
    if (age <= holdCutoffMs(state.lastLiveMeanMs)) {
      return liveSnapshot(state.lastLiveMeanMs, age, input.factor);
    }
    return UNKNOWN;
  }

  return {
    dropsPerMin: null,
    mLPerHr: null,
    state: 'settling',
    age,
  };
}

/**
 * Called by the hook every frame — if a snapshot came back `live`, remember
 * that mean so live-hold can carry the value across a temporary gap.
 */
export function recordLiveIfNeeded(
  state: EstimatorState,
  snap: Snapshot,
): EstimatorState {
  if (snap.state !== 'live' || snap.dropsPerMin === null) return state;
  const meanMs = 60_000 / snap.dropsPerMin;
  if (state.everLive && state.lastLiveMeanMs === meanMs) return state;
  return { ...state, everLive: true, lastLiveMeanMs: meanMs };
}

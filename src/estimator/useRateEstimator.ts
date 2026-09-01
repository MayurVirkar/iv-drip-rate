import { useCallback, useEffect, useRef, useState } from 'react';

import { DEFAULT_DROP_FACTOR } from './constants';
import {
  createState,
  onDrop as coreOnDrop,
  recordLiveIfNeeded,
  snapshot as coreSnapshot,
  type EstimatorState,
  type Snapshot,
} from './core';

export interface UseRateEstimatorInput {
  cameraActive: boolean;
  baselineValid?: boolean;
  now?: () => number;
  tickMs?: number;
}

export interface UseRateEstimatorResult {
  snapshot: Snapshot;
  factor: number;
  setFactor: (f: number) => void;
  report: (t?: number) => void;
}

const UNKNOWN: Snapshot = { dropsPerMin: null, mLPerHr: null, state: 'unknown' };

export function useRateEstimator(input: UseRateEstimatorInput): UseRateEstimatorResult {
  const now = input.now ?? Date.now;
  const tickMs = input.tickMs ?? 500;

  const stateRef = useRef<EstimatorState>(createState());
  const [factor, setFactor] = useState(DEFAULT_DROP_FACTOR);
  const [snap, setSnap] = useState<Snapshot>(UNKNOWN);

  const inputRef = useRef(input);
  inputRef.current = input;
  const factorRef = useRef(factor);
  factorRef.current = factor;

  const refresh = useCallback(() => {
    const s = coreSnapshot(stateRef.current, now(), {
      factor: factorRef.current,
      cameraActive: inputRef.current.cameraActive,
      baselineValid: inputRef.current.baselineValid,
    });
    stateRef.current = recordLiveIfNeeded(stateRef.current, s);
    setSnap((prev) => (equal(prev, s) ? prev : s));
  }, [now]);

  const report = useCallback(
    (t?: number) => {
      stateRef.current = coreOnDrop(stateRef.current, t ?? now());
      refresh();
    },
    [now, refresh],
  );

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, tickMs);
    return () => window.clearInterval(id);
  }, [refresh, tickMs]);

  return { snapshot: snap, factor, setFactor, report };
}

function equal(a: Snapshot, b: Snapshot): boolean {
  return (
    a.state === b.state &&
    a.dropsPerMin === b.dropsPerMin &&
    a.mLPerHr === b.mLPerHr &&
    a.age === b.age
  );
}

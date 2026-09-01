// Pure drop detector: no DOM, no time source. Ingest one (luma, t) sample per
// video frame; emit a drop event when a brief dark dip is confirmed.
//
// Algorithm
// ---------
// 1. Slow rolling baseline via EMA on luma. Companion EMA on squared residual
//    yields the running variance; std = sqrt(var), floored by `minStd` so a
//    perfectly still baseline can't collapse the threshold onto itself.
// 2. Baseline and variance update ONLY while resting (not inside a dip), so
//    the drop itself doesn't poison the baseline.
// 3. Dip entry: `luma < baseline - kThreshold * std` after warmup and after
//    the refractory window from the previous drop's trough.
// 4. Dip exit / commit: emit when luma recovers above `baseline - hysteresis
//    * kThreshold * std`. Timestamp is the trough — the physically
//    meaningful moment the drop crossed the tripwire.
// 5. baseline_valid flips true after `warmupFrames`, drops to false if the
//    sample is out of `[minLuma, maxLuma]` (dark camera / solid stream / lens
//    saturation). While invalid, no drops are emitted — TEST-5's state
//    machine renders a dash.

export interface DetectorOptions {
  /** EMA weight for baseline. 0.02 ≈ 50-frame time constant. */
  emaAlpha: number;
  /** EMA weight for running variance. Match emaAlpha unless you know why. */
  varAlpha: number;
  /** Dip threshold in std units. 4σ trips only on real drops in bench data. */
  kThreshold: number;
  /** Minimum ms between two accepted drops (measured trough-to-trough). */
  refractoryMs: number;
  /** Frames before baseline_valid can flip true. */
  warmupFrames: number;
  /** Below this mean luma the scene is treated as dark/covered. */
  minLuma: number;
  /** Above this mean luma the scene is treated as over-exposed. */
  maxLuma: number;
  /** Std floor. Sub-sensor-noise stds must not drive threshold onto baseline. */
  minStd: number;
  /** Recovery fraction of kThreshold used for hysteresis exit. */
  hysteresis: number;
}

export const DEFAULT_OPTIONS: DetectorOptions = {
  emaAlpha: 0.02,
  varAlpha: 0.02,
  kThreshold: 4,
  refractoryMs: 120,
  warmupFrames: 30,
  minLuma: 15,
  maxLuma: 245,
  minStd: 1.5,
  hysteresis: 0.5,
};

export interface DetectorState {
  baseline: number | null;
  std: number | null;
  luma: number;
  baseline_valid: boolean;
  inDip: boolean;
  frameCount: number;
  dropCount: number;
  lastDropAt: number | null;
}

export interface DropEvent {
  t: number;
}

export type DropListener = (e: DropEvent) => void;

export interface Detector {
  ingest: (luma: number, t: number) => void;
  reset: () => void;
  onDrop: (cb: DropListener) => () => void;
  state: () => DetectorState;
  readonly options: DetectorOptions;
}

export function createDetector(userOpts: Partial<DetectorOptions> = {}): Detector {
  const options: DetectorOptions = { ...DEFAULT_OPTIONS, ...userOpts };
  const listeners = new Set<DropListener>();

  let baseline: number | null = null;
  let variance = 0;
  let luma = 0;
  let baselineValid = false;
  let inDip = false;
  let frameCount = 0;
  let dropCount = 0;
  let lastDropAt: number | null = null;
  let dipTroughT = 0;
  let dipTroughLuma = 0;

  function reset(): void {
    baseline = null;
    variance = 0;
    luma = 0;
    baselineValid = false;
    inDip = false;
    frameCount = 0;
    dropCount = 0;
    lastDropAt = null;
    dipTroughT = 0;
    dipTroughLuma = 0;
  }

  function currentStd(): number {
    return Math.max(options.minStd, Math.sqrt(variance));
  }

  function ingest(sampleLuma: number, t: number): void {
    luma = sampleLuma;
    frameCount += 1;

    const inRange = sampleLuma >= options.minLuma && sampleLuma <= options.maxLuma;
    if (!inRange) {
      // Dark / covered / saturated → invalidate. Do not emit; keep baseline as
      // is so we can recover quickly once the scene returns.
      baselineValid = false;
      inDip = false;
      return;
    }

    if (baseline === null) {
      baseline = sampleLuma;
      variance = 0;
      return;
    }

    const std = currentStd();
    const dipEnterThresh = baseline - options.kThreshold * std;
    const dipExitThresh = baseline - options.hysteresis * options.kThreshold * std;

    if (!inDip) {
      const residual = sampleLuma - baseline;
      baseline = baseline + options.emaAlpha * residual;
      variance = (1 - options.varAlpha) * variance + options.varAlpha * residual * residual;

      if (!baselineValid && frameCount >= options.warmupFrames) {
        baselineValid = true;
      }

      const refractoryOk =
        lastDropAt === null || t - lastDropAt >= options.refractoryMs;
      if (baselineValid && refractoryOk && sampleLuma < dipEnterThresh) {
        inDip = true;
        dipTroughT = t;
        dipTroughLuma = sampleLuma;
      }
    } else {
      if (sampleLuma < dipTroughLuma) {
        dipTroughLuma = sampleLuma;
        dipTroughT = t;
      }
      if (sampleLuma >= dipExitThresh) {
        inDip = false;
        dropCount += 1;
        lastDropAt = dipTroughT;
        const event: DropEvent = { t: dipTroughT };
        listeners.forEach((cb) => cb(event));
      }
    }
  }

  function state(): DetectorState {
    return {
      baseline,
      std: baseline === null ? null : currentStd(),
      luma,
      baseline_valid: baselineValid,
      inDip,
      frameCount,
      dropCount,
      lastDropAt,
    };
  }

  function onDrop(cb: DropListener): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }

  return { ingest, reset, onDrop, state, options };
}

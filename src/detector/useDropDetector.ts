import { useEffect, useRef, useState } from 'react';
import {
  createDetector,
  type Detector,
  type DetectorOptions,
  type DetectorState,
  type DropEvent,
} from './dropDetector';
import { createSampler, type Sampler } from './tripwireSampler';

type RVFCMetadata = {
  presentationTime?: number;
};

type VideoElementWithRVFC = HTMLVideoElement & {
  requestVideoFrameCallback?: (
    cb: (now: number, meta: RVFCMetadata) => void,
  ) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

export interface UseDropDetectorOptions extends Partial<DetectorOptions> {
  /** Detector is only wired when true — typically `camera.state === 'active'`. */
  enabled: boolean;
  /** Fires for every confirmed drop. Timestamp is the trough (performance.now). */
  onDrop?: (e: DropEvent) => void;
  /** Snapshot cadence for the returned React state, in ms. */
  snapshotEveryMs?: number;
}

export interface UseDropDetectorResult extends DetectorState {
  reset: () => void;
}

const EMPTY_SNAPSHOT: DetectorState = {
  baseline: null,
  std: null,
  luma: 0,
  baseline_valid: false,
  inDip: false,
  frameCount: 0,
  dropCount: 0,
  lastDropAt: null,
};

// Subscribes to the shared <video> ref from the camera module and feeds the
// pure detector one sample per frame. Prefers requestVideoFrameCallback so we
// only sample when a NEW frame is available (rAF would oversample and skew
// the baseline EMA time-constant with respect to real frame time).
export function useDropDetector(
  videoRef: React.RefObject<HTMLVideoElement>,
  containerRef: React.RefObject<HTMLElement>,
  {
    enabled,
    onDrop,
    snapshotEveryMs = 100,
    ...detectorOpts
  }: UseDropDetectorOptions,
): UseDropDetectorResult {
  const [snapshot, setSnapshot] = useState<DetectorState>(EMPTY_SNAPSHOT);
  const detectorRef = useRef<Detector | null>(null);

  // Latest onDrop without re-subscribing the frame loop.
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  // Freeze options for this activation. Callers that want to change tuning
  // constants at runtime should toggle `enabled` off/on.
  const optsRef = useRef<Partial<DetectorOptions>>(detectorOpts);

  useEffect(() => {
    if (!enabled) return;
    const video = videoRef.current as VideoElementWithRVFC | null;
    if (!video) return;

    const detector = createDetector(optsRef.current);
    const sampler: Sampler = createSampler();
    detectorRef.current = detector;

    const unsubDrop = detector.onDrop((e) => {
      onDropRef.current?.(e);
    });

    let cancelled = false;
    let vfcHandle: number | null = null;
    let rafHandle: number | null = null;
    let lastSnapshotAt = 0;

    const supportsVFC =
      typeof video.requestVideoFrameCallback === 'function';

    const tick = (t: number) => {
      if (cancelled) return;
      const container = containerRef.current;
      if (container && video.readyState >= 2 && !video.paused) {
        const rect = container.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          try {
            const luma = sampler.sample(video, {
              width: rect.width,
              height: rect.height,
            });
            if (luma !== null) {
              detector.ingest(luma, t);
            }
          } catch {
            // A drawImage on a not-yet-ready video can throw on some browsers
            // — swallow one frame and try again next tick.
          }
        }
      }

      if (t - lastSnapshotAt >= snapshotEveryMs) {
        lastSnapshotAt = t;
        setSnapshot(detector.state());
      }

      schedule();
    };

    const schedule = () => {
      if (cancelled) return;
      if (supportsVFC) {
        vfcHandle = video.requestVideoFrameCallback!(() => {
          tick(performance.now());
        });
      } else {
        rafHandle = requestAnimationFrame(tick);
      }
    };

    schedule();

    return () => {
      cancelled = true;
      if (vfcHandle !== null && video.cancelVideoFrameCallback) {
        video.cancelVideoFrameCallback(vfcHandle);
      }
      if (rafHandle !== null) {
        cancelAnimationFrame(rafHandle);
      }
      unsubDrop();
      detectorRef.current = null;
      setSnapshot(EMPTY_SNAPSHOT);
    };
    // detectorOpts intentionally excluded — see optsRef note above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, videoRef, containerRef, snapshotEveryMs]);

  return {
    ...snapshot,
    reset: () => {
      const d = detectorRef.current;
      if (!d) return;
      d.reset();
      setSnapshot(d.state());
    },
  };
}

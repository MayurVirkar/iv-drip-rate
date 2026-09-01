import { useEffect, useRef } from 'react';
import './App.css';
import { CameraView } from './camera/CameraView';
import { useCamera } from './camera/useCamera';
import { useWakeLock } from './camera/useWakeLock';
import ChamberGuideOverlay from './overlay/ChamberGuideOverlay';
import { DetectorDebugHud, useDropDetector } from './detector';
import { useRateEstimator, type Snapshot } from './estimator';
import { DropFactorSelector } from './DropFactorSelector';
import { DisclaimerGate, DisclaimerStrip } from './DisclaimerGate';

export default function App() {
  const camera = useCamera();
  useWakeLock(camera.state === 'active');

  const stageRef = useRef<HTMLElement>(null);

  const estimator = useRateEstimator({
    cameraActive: camera.state === 'active',
  });

  const detector = useDropDetector(camera.videoRef, stageRef, {
    enabled: camera.state === 'active',
    onDrop: (e) => estimator.report(e.t),
  });

  // Debug bridge — lets TEST-4's detector (or the DevTools console during
  // bench validation) push drops without a wiring change:
  //   window.__ivDrop.report()            // now
  //   window.__ivDrop.report(1234567.8)   // explicit ms
  useEffect(() => {
    (window as unknown as { __ivDrop?: unknown }).__ivDrop = {
      report: estimator.report,
      setFactor: estimator.setFactor,
    };
    return () => {
      delete (window as unknown as { __ivDrop?: unknown }).__ivDrop;
    };
  }, [estimator.report, estimator.setFactor]);

  const debug = isDebugEnabled();

  return (
    <DisclaimerGate>
      <div className="app">
        <DisclaimerStrip />

        <main className="stage" aria-label="Camera view" ref={stageRef}>
          <CameraView
            ref={camera.videoRef}
            state={camera.state}
            error={camera.error}
            onStart={camera.start}
          />
          <ChamberGuideOverlay />
          {debug && camera.state === 'active' && (
            <DetectorDebugHud state={detector} estimatorState={estimator.snapshot.state} />
          )}
        </main>

        <footer
          className="stats"
          aria-label="Live drip statistics"
          data-state={estimator.snapshot.state}
        >
          <Stat
            label="drops/min"
            value={formatRate(estimator.snapshot.dropsPerMin)}
            title={metaTitle(estimator.snapshot)}
          />
          <Stat
            label="mL/hr"
            value={formatRate(estimator.snapshot.mLPerHr)}
            title={metaTitle(estimator.snapshot)}
            extra={
              <DropFactorSelector
                value={estimator.factor}
                onChange={estimator.setFactor}
              />
            }
          />
        </footer>
      </div>
    </DisclaimerGate>
  );
}

function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('debug') === '1';
}

function Stat({
  label,
  value,
  hint,
  title,
  extra,
}: {
  label: string;
  value: string;
  hint?: string;
  title?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="stat" role="group" aria-label={label} title={title}>
      <div className="stat__value" aria-live="polite">
        {value}
      </div>
      <div className="stat__label">
        {label}
        {hint ? <span className="stat__hint"> ({hint})</span> : null}
      </div>
      {extra && <div className="stat__extra">{extra}</div>}
    </div>
  );
}

// Fail-closed formatting: null → em-dash. Never render 0.
function formatRate(v: number | null): string {
  if (v === null) return '—';
  return v.toFixed(v < 10 ? 1 : 0);
}

function metaTitle(snap: Snapshot): string {
  const age =
    snap.age !== undefined ? ` · ${(snap.age / 1000).toFixed(1)}s since last drop` : '';
  return `state: ${snap.state}${age}`;
}

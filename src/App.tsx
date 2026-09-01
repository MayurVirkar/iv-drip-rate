import { useEffect } from 'react';

import './App.css';
import { CameraView } from './camera/CameraView';
import { useCamera } from './camera/useCamera';
import { useWakeLock } from './camera/useWakeLock';
import { useRateEstimator, type Snapshot } from './estimator';

export default function App() {
  const camera = useCamera();
  useWakeLock(camera.state === 'active');

  const estimator = useRateEstimator({
    cameraActive: camera.state === 'active',
    // baselineValid comes from TEST-4's detector once wired.
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

  return (
    <div className="app">
      <header className="disclaimer" role="note">
        <strong>PLACEHOLDER — replaced by IV Clinical Safety.</strong>
        <span>
          {' '}
          Not a medical device. Prototype only — verify with a manual count before
          acting.
        </span>
      </header>

      <main className="stage" aria-label="Camera view">
        <CameraView
          ref={camera.videoRef}
          state={camera.state}
          error={camera.error}
          onStart={camera.start}
        />
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
        />
        <Stat label="factor" value={String(estimator.factor)} hint="gtt/mL" />
      </footer>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  title,
}: {
  label: string;
  value: string;
  hint?: string;
  title?: string;
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
